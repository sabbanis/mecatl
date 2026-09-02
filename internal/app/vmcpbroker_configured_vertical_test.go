package app_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"io"
	"math/big"
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
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

func TestBundledWorkspaceEnrollment_Scenario11_ConfigDrivenVertical(t *testing.T) {
	const (
		callID       = "mcp-call-safe-01"
		secretCanary = "scenario10-client-secret-canary"
		tokenCanary  = "scenario10-upstream-token-canary"
	)

	callbackMux := http.NewServeMux()
	callbackServer := httptest.NewUnstartedServer(callbackMux)
	callbackServer.StartTLS()
	t.Cleanup(callbackServer.Close)
	fixture := newScenario10Fixture(t, tokenCanary)
	configureScenario10SystemRoots(t, callbackServer.Certificate(), fixture.gateway.Certificate())
	t.Setenv("MECATL_SCENARIO10_CLIENT_SECRET", secretCanary)

	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte(`mcp:
  mode: broker
  broker:
    callback_url: `+callbackServer.URL+`/exact/callback
  servers:
    - name: github
      url: `+fixture.backend.URL+`
      auth:
        mode: oauth
        oauth:
          upstream:
            mode: oauth2
            oauth2:
              authorization_endpoint: `+fixture.gateway.URL+`/authorize
              token_endpoint: `+fixture.gateway.URL+`/token
          client:
            mode: preregistered
            preregistered:
              id: scenario10-client
              secret_env: MECATL_SCENARIO10_CLIENT_SECRET
          scopes: [openid]
          network: {}
`), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall(callID, "mcp__github__protected", json.RawMessage(`{"path":"scenario10-private-arguments"}`))),
		mockllm.TextTurn("model final"),
	)
	owner := &session.Principal{Issuer: "https://identity.example", Subject: "alice", GrantType: session.GrantTypeUser}
	ownerCtx := session.WithPrincipal(t.Context(), owner)
	built, err := app.Build(t.Context(), app.Config{
		Workspace:            t.TempDir(),
		MockProvider:         provider,
		AllowAllTools:        true,
		OwnershipEnforced:    true,
		PermissionConfigs:    []string{settings},
		MCPAuthorityLoader:   cliconfig.NewMCPProfileResolver(nil, os.LookupEnv),
		MCPAuthorityDefault:  string(cliconfig.MCPAuthorityBroker),
		MCPBrokerSupported:   true,
		VMCPBrokerHTTPClient: fixture.browserClient(callbackServer),
	})
	if err != nil {
		t.Fatalf("Build from canonical settings: %v", err)
	}
	t.Cleanup(built.Close)
	if built.VMCPBroker == nil {
		t.Fatal("Build did not construct a broker runtime")
	}
	if built.VMCPBrokerHandlers.Callback == nil || built.VMCPBrokerCallbackPath != "/exact/callback" {
		profiles, _ := built.MCPAuthority.Broker()
		t.Fatalf("broker callback wiring = handler %v, path %q, profiles %#v", built.VMCPBrokerHandlers.Callback != nil, built.VMCPBrokerCallbackPath, profiles)
	}
	if err := built.VMCPBrokerHandlers.Mount(callbackMux, "/exact/callback"); err != nil {
		t.Fatalf("mount complete broker handler bundle: %v", err)
	}

	sess, err := built.Service.CreateSession(ownerCtx, t.TempDir(), session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	pending, err := built.Service.ConnectWorkspaceServices(ownerCtx, sess.ID)
	if err != nil || pending.ID == "" || pending.BrowserURL == "" {
		t.Fatalf("ConnectWorkspaceServices pending = %+v, %v", pending, err)
	}
	if pending.Status != "pending" {
		t.Fatalf("workspace enrollment status = %q, want pending", pending.Status)
	}
	if got := fixture.calls.Load(); got != 0 {
		t.Fatalf("protected upstream calls before enrollment = %d, want 0", got)
	}
	if got := fixture.discoveryCalls.Load(); got != 0 {
		t.Fatalf("OIDC discovery calls before presentation = %d, want 0", got)
	}
	if strings.Contains(pending.BrowserURL, secretCanary) || strings.Contains(pending.BrowserURL, tokenCanary) {
		t.Fatalf("browser URL leaked a secret: %q", pending.BrowserURL)
	}

	response, err := fixture.browserClient(callbackServer).Get(pending.BrowserURL)
	if err != nil {
		t.Fatalf("follow bundled OAuth redirect chain: %v", err)
	}
	defer response.Body.Close()
	callbackPrefix := callbackServer.URL + "/exact/callback"
	if response.StatusCode != http.StatusOK || !strings.HasPrefix(response.Request.URL.String(), callbackPrefix) {
		t.Fatalf("callback response/request = %d/%q, want exact configured callback", response.StatusCode, response.Request.URL)
	}
	if fixture.state == "" || fixture.verifier == "" {
		t.Fatalf("generic OAuth2 state/verifier = %q/%q, want both present", fixture.state, fixture.verifier)
	}

	connected, err := built.Service.ConnectWorkspaceServices(ownerCtx, sess.ID)
	if err != nil || connected.Status != "connected" {
		t.Fatalf("ConnectWorkspaceServices connected = %+v, %v", connected, err)
	}
	if got := fixture.calls.Load(); got != 0 {
		t.Fatalf("protected tool calls during authenticated discovery = %d, want 0", got)
	}
	if got := fixture.discoveryCalls.Load(); got != 0 {
		t.Fatalf("OIDC discovery calls = %d, want 0 for configured OAuth2", got)
	}

	run, err := built.Service.StartInteractiveRunContent(ownerCtx, sess.ID, "read protected data", nil)
	if err != nil {
		t.Fatalf("StartInteractiveRunContent after enrollment: %v", err)
	}
	var events []session.Event
	for event := range run.Events() {
		events = append(events, event)
		if event.MCPAuthorization != nil || event.Ask != nil {
			t.Fatalf("workspace enrollment was projected as a tool/permission approval: %#v", event)
		}
	}
	built.Service.FinishRun(sess.ID, run)
	if run.Outcome() != agent.RunOutcomeCompleted {
		t.Fatalf("run outcome = %v, want completed", run.Outcome())
	}
	assertScenario10SafeEvents(t, events, []string{secretCanary, tokenCanary, "scenario10-private-arguments", "scenario10-code-canary", fixture.state, fixture.verifier, pending.BrowserURL, callbackServer.URL, fixture.gateway.URL})
	if got := fixture.calls.Load(); got != 1 {
		t.Fatalf("protected upstream calls = %d, want 1", got)
	}

	finished, err := built.Service.GetSession(ownerCtx, sess.ID)
	if err != nil {
		t.Fatalf("GetSession completed: %v", err)
	}
	if finished.State != session.StateCompleted {
		t.Fatalf("completed state = %s", finished.State)
	}
	if got := finished.Conversation.Messages[len(finished.Conversation.Messages)-1]; got.Role != session.RoleAssistant || got.Text != "model final" {
		t.Fatalf("final model message = %#v", got)
	}
}

type scenario10Fixture struct {
	gateway        *httptest.Server
	backend        *httptest.Server
	calls          atomic.Int32
	discoveryCalls atomic.Int32
	privateKey     *rsa.PrivateKey
	nonce          string
	state          string
	verifier       string
}

func newScenario10Fixture(t *testing.T, token string) *scenario10Fixture {
	t.Helper()
	fixture := &scenario10Fixture{}

	protected := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(protected, &mcpsdk.Tool{Name: "protected"}, func(context.Context, *mcpsdk.CallToolRequest, map[string]any) (*mcpsdk.CallToolResult, struct{}, error) {
		fixture.calls.Add(1)
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	protectedHandler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return protected }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	fixture.backend = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read request", http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(strings.NewReader(string(body)))
		if strings.Contains(string(body), `"tools/call"`) && r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "missing expected bearer", http.StatusUnauthorized)
			return
		}
		protectedHandler.ServeHTTP(w, r)
	}))
	t.Cleanup(fixture.backend.Close)

	var err error
	fixture.privateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate fixture OIDC key: %v", err)
	}
	mux := http.NewServeMux()
	fixture.gateway = httptest.NewUnstartedServer(mux)
	fixture.gateway.StartTLS()
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		fixture.discoveryCalls.Add(1)
		http.Error(w, "OIDC discovery must not be contacted for configured OAuth2", http.StatusInternalServerError)
	})
	mux.HandleFunc("/authorize", func(w http.ResponseWriter, r *http.Request) {
		fixture.nonce = r.URL.Query().Get("nonce")
		fixture.state = r.URL.Query().Get("state")
		http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=scenario10-code-canary&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		fixture.verifier = r.FormValue("code_verifier")
		idToken := fixture.idToken(t, "scenario10-client", "scenario10-subject")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"`+token+`","token_type":"Bearer","id_token":"`+idToken+`"}`)
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]any{{"kty": "RSA", "kid": "scenario10", "use": "sig", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(fixture.privateKey.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(fixture.privateKey.E)).Bytes())}}})
	})
	t.Cleanup(fixture.gateway.Close)
	return fixture
}

func (f *scenario10Fixture) idToken(t *testing.T, audience, subject string) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: f.privateKey}, (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "scenario10"))
	if err != nil {
		t.Fatalf("create fixture JWT signer: %v", err)
	}
	token, err := jwt.Signed(signer).Claims(map[string]any{"iss": f.gateway.URL, "sub": subject, "aud": audience, "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "nonce": f.nonce}).CompactSerialize()
	if err != nil {
		t.Fatalf("sign fixture ID token: %v", err)
	}
	return token
}

func (f *scenario10Fixture) browserClient(callback *httptest.Server) *http.Client {
	pool := x509.NewCertPool()
	if certificate := f.gateway.Certificate(); certificate != nil {
		pool.AddCert(certificate)
	}
	pool.AddCert(callback.Certificate())
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig.RootCAs = pool
	return &http.Client{Transport: transport}
}

func configureScenario10SystemRoots(t *testing.T, certs ...*x509.Certificate) {
	t.Helper()
	roots := installSystemRootsOnce()
	var pemRoots []byte
	for _, cert := range certs {
		roots.AddCert(cert)
		pemRoots = append(pemRoots, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Raw})...)
	}
	path := filepath.Join(t.TempDir(), "roots.pem")
	if err := os.WriteFile(path, pemRoots, 0o600); err != nil {
		t.Fatalf("write test roots: %v", err)
	}
	t.Setenv("SSL_CERT_FILE", path)
	t.Setenv("GODEBUG", "x509usefallbackroots=1")
}

func assertScenario10SafeEvents(t *testing.T, events []session.Event, forbidden []string) {
	t.Helper()
	for _, event := range events {
		encoded, err := json.Marshal(event)
		if err != nil {
			t.Fatalf("marshal event: %v", err)
		}
		for _, value := range forbidden {
			if value != "" && strings.Contains(string(encoded), value) {
				t.Fatalf("event leaked %q: %s", value, encoded)
			}
		}
		if event.ToolCall != nil && len(event.ToolCall.Args) != 0 {
			t.Fatalf("protected tool card leaked arguments: %#v", event.ToolCall)
		}
	}
}
