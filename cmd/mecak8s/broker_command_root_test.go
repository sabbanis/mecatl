package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

// TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical proves the
// actual command-root seam: canonical operator settings build the real ToolHive
// process, its complete bundle mounts on the one TLS listener, and all controls
// travel over the authenticated HTTP wire. No broker constructor, process,
// handler bundle, route, or Runtime callback is supplied by the test.
func TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical(t *testing.T) {
	cert, key, serverPEM := loopbackTLSFiles(t)
	fixture := newCommandRootScenario10Fixture(t, "scenario10-upstream-token-canary")
	roots := filepath.Join(t.TempDir(), "roots.pem")
	if err := os.WriteFile(roots, append(serverPEM, '\n'), 0o600); err != nil {
		t.Fatalf("write test CA roots: %v", err)
	}
	t.Setenv("SSL_CERT_FILE", roots)
	t.Setenv("MECATL_SCENARIO10_CLIENT_SECRET", "scenario10-client-secret-canary")

	cfg, err := parseFlags([]string{"--mock", "--http-addr", freeLoopbackPort(t), "--grpc-addr", freeLoopbackPort(t), "--tls-cert", cert, "--tls-key", key})
	if err != nil {
		t.Fatalf("parse command config: %v", err)
	}
	cfg.sessionLeaseK8sNamespace = ""
	cfg.oidc = cliconfig.OIDCConfig{Issuer: "https://identity.example", Audience: "mecak8s", NewValidator: func(context.Context, cliconfig.OIDCConfig) (server.PrincipalValidator, error) {
		return testPrincipalValidator{}, nil
	}}
	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte("mcp:\n  mode: broker\n  broker:\n    callback_url: https://"+cfg.httpAddr+"/exact/callback\n  servers:\n    - name: protected\n      url: "+fixture.backend.URL+"\n      auth:\n        mode: oauth\n        oauth:\n          issuer: "+fixture.gateway.URL+"\n          client:\n            mode: preregistered\n            preregistered:\n              id: scenario10-client\n              secret_env: MECATL_SCENARIO10_CLIENT_SECRET\n          scopes: [openid]\n          network: {}\n"), 0o600); err != nil {
		t.Fatalf("write broker settings: %v", err)
	}
	cfg.permissionConfigs = []string{settings}

	ac := appConfig(cfg, nil, observability{})
	ac.VMCPBrokerHTTPClient = newCommandRootClient(serverPEM)
	ac.MockProvider = mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall("mcp-call-safe-01", "mcp__protected__protected", json.RawMessage(`{}`))),
		mockllm.TextTurn("model final"),
	)
	ac.NoSoul, ac.NoUserModel, ac.PermissionsConventional, ac.AgentsConventional = true, true, false, false
	built, err := app.Build(t.Context(), ac)
	if err != nil {
		t.Fatalf("default app.Build from canonical broker settings: %v", err)
	}
	t.Cleanup(built.Close)
	if built.VMCPBroker == nil {
		t.Fatal("default app.Build did not construct the broker runtime")
	}

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() {
		done <- serve(ctx, cfg, built.Service, observability{}, built.VMCPBrokerHandlers, built.VMCPBrokerCallbackPath)
	}()
	t.Cleanup(func() { cancel(); <-done })
	client := newCommandRootClient(serverPEM)
	base := "https://" + cfg.httpAddr
	waitForCommandRoot(t, client, base+"/healthz")

	// Health, readiness, and the normal API remain on their existing routes.
	for _, path := range []string{"/healthz", "/readyz"} {
		response := mustGet(t, client, base+path, "")
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("%s status = %d, want health route untouched", path, response.StatusCode)
		}
	}
	sessionID := createCommandRootSession(t, client, base)
	parked := postSSE(t, client, base+"/v1/sessions/"+sessionID+"/prompt", `{"text":"read protected data scenario10-private-input"}`)
	assertCommandRootSafeProjection(t, parked, "scenario10-client-secret-canary", "scenario10-upstream-token-canary", "scenario10-private-input")
	authorizationID := authorizationIDFromSSE(t, parked)

	presentation := mustGet(t, client, base+"/v1/sessions/"+sessionID+"/mcp-authorizations/"+authorizationID+"/presentation", "")
	defer presentation.Body.Close()
	var browser struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(presentation.Body).Decode(&browser); err != nil || presentation.StatusCode != http.StatusOK || browser.URL == "" {
		t.Fatalf("presentation = status %d, url %q, err %v", presentation.StatusCode, browser.URL, err)
	}
	if !strings.HasPrefix(browser.URL, base+"/v1/mcp/broker/oauth/authorize?") || strings.Contains(browser.URL, "scenario10-client-secret-canary") {
		t.Fatalf("safe browser presentation = %q", browser.URL)
	}
	response, err := client.Get(browser.URL)
	if err != nil {
		t.Fatalf("follow browser redirect chain: %v", err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK || !strings.HasPrefix(response.Request.URL.String(), base+"/exact/callback?") {
		t.Fatalf("callback response/request = %d/%q, want exact mounted callback", response.StatusCode, response.Request.URL)
	}

	continued := postSSE(t, client, base+"/v1/sessions/"+sessionID+"/mcp-authorizations/"+authorizationID+":recheck", "{}")
	assertCommandRootSafeProjection(t, continued, "scenario10-client-secret-canary", "scenario10-upstream-token-canary", "scenario10-private-input", "scenario10-code-canary")
	if got := fixture.calls.Load(); got != 1 {
		t.Fatalf("protected upstream calls = %d, want exactly one", got)
	}
	duplicate := mustPost(t, client, base+"/v1/sessions/"+sessionID+"/mcp-authorizations/"+authorizationID+":recheck", "{}")
	duplicate.Body.Close()
	if duplicate.StatusCode != http.StatusNotFound || fixture.calls.Load() != 1 {
		t.Fatalf("duplicate recheck status/calls = %d/%d, want 404 and one call", duplicate.StatusCode, fixture.calls.Load())
	}

	// The root, not a second listener, owns the complete fixed broker table.
	for _, path := range []string{"/v1/mcp/broker/oauth/authorize", "/v1/mcp/broker/mcp", "/exact/callback"} {
		response := mustGet(t, client, base+path, "")
		response.Body.Close()
		if response.StatusCode == http.StatusNotFound {
			t.Fatalf("mounted broker route %s returned 404", path)
		}
	}

	// The broker mount must not shadow the k8s drain control on the same listener.
	drain := mustGet(t, client, base+"/drain", "")
	drain.Body.Close()
	if drain.StatusCode != http.StatusOK {
		t.Fatalf("/drain status = %d, want existing drain control", drain.StatusCode)
	}
}

type testPrincipalValidator struct{}

func (testPrincipalValidator) Validate(context.Context, string) (*session.Principal, error) {
	return &session.Principal{Issuer: "https://identity.example", Subject: "test", GrantType: session.GrantTypeUser}, nil
}

type commandRootScenario10Fixture struct {
	gateway, backend *httptest.Server
	calls            atomic.Int32
	privateKey       *rsa.PrivateKey
	nonce            string
}

func newCommandRootScenario10Fixture(t *testing.T, token string) *commandRootScenario10Fixture {
	t.Helper()
	f := &commandRootScenario10Fixture{}
	protected := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(protected, &mcpsdk.Tool{Name: "protected"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		f.calls.Add(1)
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	h := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return protected }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	f.backend = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(strings.NewReader(string(body)))
		if strings.Contains(string(body), `"tools/call"`) && r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "missing bearer", http.StatusUnauthorized)
			return
		}
		h.ServeHTTP(w, r)
	}))
	t.Cleanup(f.backend.Close)
	var err error
	f.privateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	f.gateway = httptest.NewServer(mux)
	issuer := f.gateway.URL
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/jwks", "response_types_supported": []string{"code"}, "subject_types_supported": []string{"public"}, "id_token_signing_alg_values_supported": []string{"RS256"}})
	})
	mux.HandleFunc("/authorize", func(w http.ResponseWriter, r *http.Request) {
		f.nonce = r.URL.Query().Get("nonce")
		http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=scenario10-code-canary&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"`+token+`","token_type":"Bearer","id_token":"`+f.idToken(t, "scenario10-client")+`"}`)
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]any{{"kty": "RSA", "kid": "scenario10", "use": "sig", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(f.privateKey.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(f.privateKey.E)).Bytes())}}})
	})
	t.Cleanup(f.gateway.Close)
	return f
}
func (f *commandRootScenario10Fixture) idToken(t *testing.T, audience string) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: f.privateKey}, (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "scenario10"))
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Signed(signer).Claims(map[string]any{"iss": f.gateway.URL, "sub": "scenario10-subject", "aud": audience, "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "nonce": f.nonce}).CompactSerialize()
	if err != nil {
		t.Fatal(err)
	}
	return signed
}
func newCommandRootClient(serverPEM []byte) *http.Client {
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM(serverPEM)
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool}
	return &http.Client{Transport: transport}
}

func createCommandRootSession(t *testing.T, client *http.Client, base string) string {
	t.Helper()
	response := mustPost(t, client, base+"/v1/sessions", `{}`)
	defer response.Body.Close()
	var body struct {
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || response.StatusCode != http.StatusCreated || body.SessionID == "" {
		t.Fatalf("create session = %d/%q: %v", response.StatusCode, body.SessionID, err)
	}
	return body.SessionID
}
func mustGet(t *testing.T, client *http.Client, rawURL, bearer string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	if bearer == "" {
		bearer = "test"
	}
	request.Header.Set("Authorization", "Bearer "+bearer)
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("GET %s: %v", rawURL, err)
	}
	return response
}
func mustPost(t *testing.T, client *http.Client, rawURL, body string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(http.MethodPost, rawURL, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer test")
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("POST %s: %v", rawURL, err)
	}
	return response
}
func postSSE(t *testing.T, client *http.Client, rawURL, body string) string {
	t.Helper()
	response := mustPost(t, client, rawURL, body)
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("SSE %s = %d: %v: %s", rawURL, response.StatusCode, err, data)
	}
	return string(data)
}
func waitForCommandRoot(t *testing.T, client *http.Client, rawURL string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		response, err := client.Get(rawURL)
		if err == nil {
			response.Body.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("command root did not start at %s", rawURL)
}
func authorizationIDFromSSE(t *testing.T, s string) string {
	t.Helper()
	var frame struct {
		McpAuthorization struct {
			AuthorizationID string `json:"authorization_id"`
		} `json:"mcp_authorization"`
	}
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(line, "data: ") && json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &frame) == nil && frame.McpAuthorization.AuthorizationID != "" {
			return frame.McpAuthorization.AuthorizationID
		}
	}
	t.Fatalf("authorization id absent from SSE: %s", s)
	return ""
}
func assertCommandRootSafeProjection(t *testing.T, s string, forbidden ...string) {
	t.Helper()
	for _, value := range forbidden {
		if strings.Contains(s, value) {
			t.Fatalf("wire projection leaked %q: %s", value, s)
		}
	}
}

func loopbackTLSFiles(t *testing.T) (string, string, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.CreateCertificate(rand.Reader, &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "127.0.0.1"}, DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}, &x509.Certificate{}, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	certPath, keyPath := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := os.WriteFile(certPath, certPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certPath, keyPath, certPEM
}
