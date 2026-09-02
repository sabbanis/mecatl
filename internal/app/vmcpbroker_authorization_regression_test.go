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
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

// TestSessionMCPAuthorization_GrantRegressionParksAndResumes proves the
// ADR-0285 mid-turn park/resume mechanism against the ONLY configuration
// shape it is reachable in under the real app.Build composition (ADR 0287):
// every OAuth-protected mcp.servers entry is auto-added to
// Runtime.ProtectedBackends (protectedToolHiveConstruction in runtime.go),
// which makes WorkspaceEnrollmentRequired unconditionally true and the
// fail-closed startRunContent gate (service.go ~4427/4493) refuse EVERY
// prompt until the whole bundle is connected. So a fresh session can never
// reach a protected tool call before enrolling -- StateAuthorizing is only
// reachable when a grant that WAS valid at enrollment time later regresses
// mid-conversation.
//
// Runtime.Disconnect cannot simulate this: it permanently tombstones the
// target (runtime.go:1666-1686), and a subsequent Connect returns
// ErrUnsupportedCapability rather than ConnectionPending, which surfaces as
// an ordinary "authorization required but unavailable" tool error, not a
// park.
//
// The real trigger is a terminal ToolHive upstream-token refresh failure for
// the auth session: mecatl's cleaningUpstreamTokens wrapper observes that
// failure (its GetAllUpstreamCredentials wrapping, runtime.go:340-344 -- the
// same reader is wired as the incoming-auth middleware's upstream token
// reader at runtime.go:686) and revokes every protected backend's
// Runtime.grants entry for that session synchronously
// (revokeGrantsForProviders, runtime.go:1989). The revocation happens as a
// side effect of that failed request itself, so it always costs one
// ordinary tool error before the NEXT call sees no grant and parks -- same
// shape as the original design, but now driven by a real credential death
// instead of a 65s sleep past an artificial 1-minute floor: call 1 succeeds
// -> fixture regresses the upstream credential -> call 2 fails with an
// ordinary tool error (that failure is what revokes the grant) -> call 3
// (the model's retry, same run) parks -> durable snapshot -> safe wire
// presentation -> a SECOND real OAuth round-trip -> recheck -> the exact
// call 3 continuation resumes and completes.
func TestSessionMCPAuthorization_GrantRegressionParksAndResumes(t *testing.T) {
	const (
		call1 = "mcp-call-safe-01"
		call2 = "mcp-call-safe-02"
		call3 = "mcp-call-safe-03"
	)

	callbackMux := http.NewServeMux()
	callbackServer := httptest.NewUnstartedServer(callbackMux)
	callbackServer.StartTLS()
	t.Cleanup(callbackServer.Close)
	fixture := newRegressionFixture(t)
	configureRegressionSystemRoots(t, callbackServer.Certificate(), fixture.gateway.Certificate())

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
              id: regression-client
              secret_env: MECATL_REGRESSION_CLIENT_SECRET
          scopes: [openid]
          network: {}
`), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}
	t.Setenv("MECATL_REGRESSION_CLIENT_SECRET", "regression-client-secret-canary")

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall(call1, "mcp__github__protected", json.RawMessage(`{}`))),
		mockllm.TextTurn("first read done"),
		mockllm.ToolCallTurn(session.NewToolCall(call2, "mcp__github__protected", json.RawMessage(`{}`))),
		mockllm.ToolCallTurn(session.NewToolCall(call3, "mcp__github__protected", json.RawMessage(`{}`))),
		mockllm.TextTurn("second read done"),
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
	if err := built.VMCPBrokerHandlers.Mount(callbackMux, "/exact/callback"); err != nil {
		t.Fatalf("mount complete broker handler bundle: %v", err)
	}

	sess, err := built.Service.CreateSession(ownerCtx, t.TempDir(), session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	t.Cleanup(func() { built.Service.CloseSession(sess.ID) })

	// --- Bundled enrollment (ADR 0287): the ONLY way to reach a first prompt. ---
	pending, err := built.Service.ConnectWorkspaceServices(ownerCtx, sess.ID)
	if err != nil || pending.BrowserURL == "" {
		t.Fatalf("ConnectWorkspaceServices pending = %+v, %v", pending, err)
	}
	if _, err := fixture.browserClient(callbackServer).Get(pending.BrowserURL); err != nil {
		t.Fatalf("follow first OAuth redirect chain: %v", err)
	}
	connected, err := built.Service.ConnectWorkspaceServices(ownerCtx, sess.ID)
	if err != nil || connected.Status != "connected" {
		t.Fatalf("ConnectWorkspaceServices connected = %+v, %v", connected, err)
	}

	// --- Call 1: the grant from enrollment is still good. ---
	run1, err := built.Service.StartInteractiveRunContent(ownerCtx, sess.ID, "read protected data", nil)
	if err != nil {
		t.Fatalf("StartInteractiveRunContent (call 1): %v", err)
	}
	for range run1.Events() {
	}
	built.Service.FinishRun(sess.ID, run1)
	if run1.Outcome() != agent.RunOutcomeCompleted {
		t.Fatalf("run1 outcome = %v, want completed", run1.Outcome())
	}
	if got := fixture.backendCalls.Load(); got != 1 {
		t.Fatalf("protected backend calls after call 1 = %d, want 1", got)
	}

	// --- Regress the upstream credential: ToolHive's own upstream token (not
	// mecatl's embedded-auth-server-issued grant) already carries a
	// deterministically-already-expired lifespan by construction (expires_in
	// well inside oauth2.Token's ~10s safety margin), cascading through every
	// refresh -- so the very next protected call is due for another upstream
	// refresh regardless of wall-clock time. A short (not 65s) wait is still
	// needed for that refresh to actually be attempted by the incoming-auth
	// middleware's per-request upstream-token load; the token itself never
	// becomes valid again once the fixture starts rejecting the refresh. ---
	fixture.rejectRefresh.Store(true)
	time.Sleep(3 * time.Second)

	// --- Calls 2 and 3 happen inside ONE run: the engine keeps turning after
	// a tool result (error or not) until it hits a terminal state, so the
	// model's retry (call 3, scripted as the very next turn) lands in the
	// SAME run as call 2's failure, not a separate one. Call 2 fails with an
	// ORDINARY tool error, not a park -- the dispatch gate
	// (RequestAuthorization) already passed before execution discovered the
	// bearer was rejected; that failed request is also what revokes the
	// grant (cleaningUpstreamTokens observing the incoming-auth middleware's
	// failed upstream-token load). Call 3's RequestAuthorization now
	// genuinely sees no grant and parks.
	run2, err := built.Service.StartInteractiveRunContent(ownerCtx, sess.ID, "read protected data again", nil)
	if err != nil {
		t.Fatalf("StartInteractiveRunContent (calls 2+3): %v", err)
	}
	var parkedEvents []session.Event
	for event := range run2.Events() {
		parkedEvents = append(parkedEvents, event)
		if event.ToolCall != nil && len(event.ToolCall.Args) != 0 {
			t.Fatalf("protected tool card leaked arguments: %#v", event.ToolCall)
		}
	}
	built.Service.FinishRun(sess.ID, run2)
	if run2.Outcome() != agent.RunOutcomeAuthorizationParked {
		parked, loadErr := built.Service.GetSession(ownerCtx, sess.ID)
		for _, m := range parked.Conversation.Messages {
			if m.Role == session.RoleTool && m.ToolResult != nil {
				t.Logf("DEBUG tool result call=%s error=%v content=%s", m.ToolResult.CallID, m.ToolResult.IsError, m.ToolResult.Content)
			}
		}
		t.Fatalf("run2 outcome = %v, want authorization_parked; session=%#v, load=%v", run2.Outcome(), parked, loadErr)
	}
	var authRequiredID string
	for _, event := range parkedEvents {
		if event.MCPAuthorization != nil {
			if event.MCPAuthorization.Call != call3 {
				t.Fatalf("parked event correlates to call %q, want %q", event.MCPAuthorization.Call, call3)
			}
			authRequiredID = event.MCPAuthorization.AuthorizationID
		}
	}
	if authRequiredID == "" {
		t.Fatal("no mcp.authorization.required event observed on the parking run")
	}

	parked, err := built.Service.GetSession(ownerCtx, sess.ID)
	if err != nil {
		t.Fatalf("load parked session: %v", err)
	}
	if parked.State != session.StateAuthorizing {
		t.Fatalf("parked session state = %s, want authorizing", parked.State)
	}
	pendingAuth, ok := parked.PendingMCPAuthorization()
	if !ok || pendingAuth.Call.ID != call3 {
		t.Fatalf("durable pending authorization = %#v, want exact call %q", pendingAuth, call3)
	}

	// --- Complete a SECOND, independent browser OAuth round-trip. ---
	fixture.rejectRefresh.Store(false)
	control := server.MCPAuthorizationControl{SessionID: sess.ID, AuthorizationID: pendingAuth.AuthorizationID}
	browserURL, err := built.Service.MCPAuthorizationPresentation(ownerCtx, sess.ID, control)
	if err != nil || browserURL == "" {
		t.Fatalf("owner presentation = %q, %v", browserURL, err)
	}
	if _, err := fixture.browserClient(callbackServer).Get(browserURL); err != nil {
		t.Fatalf("follow second OAuth redirect chain: %v", err)
	}

	continued, err := built.Service.RecheckMCPAuthorization(ownerCtx, sess.ID, control)
	if err != nil || continued == nil {
		t.Fatalf("connected recheck = %v, %v", continued, err)
	}
	for range continued.Events() {
	}
	built.Service.FinishRun(sess.ID, continued)
	if got := fixture.backendCalls.Load(); got != 2 {
		t.Fatalf("protected backend calls after resume = %d, want 2 (call 1 + resumed call 3; call 2 never reached the backend)", got)
	}

	finished, err := built.Service.GetSession(ownerCtx, sess.ID)
	if err != nil {
		t.Fatalf("load finished session: %v", err)
	}
	if finished.State != session.StateCompleted {
		t.Fatalf("finished session state = %s", finished.State)
	}
	if err := session.ValidateToolPairing(finished.Conversation.Messages); err != nil {
		t.Fatalf("finished tool pairing: %v", err)
	}
	var call3Result *session.ToolResult
	for _, message := range finished.Conversation.Messages {
		if message.Role == session.RoleTool && message.ToolResult != nil && message.ToolResult.CallID == call3 {
			call3Result = message.ToolResult
		}
	}
	if call3Result == nil || call3Result.IsError || !strings.Contains(call3Result.Content, "protected result") {
		t.Fatalf("call 3 result = %#v, want a successful protected result", call3Result)
	}
	if got := finished.Conversation.Messages[len(finished.Conversation.Messages)-1]; got.Role != session.RoleAssistant || got.Text != "second read done" {
		t.Fatalf("final model message = %#v", got)
	}
}

type regressionFixture struct {
	t             *testing.T
	gateway       *httptest.Server
	backend       *httptest.Server
	backendCalls  atomic.Int32
	rejectRefresh atomic.Bool
	privateKey    *rsa.PrivateKey
	nonce         string
	client        *http.Client
}

func newRegressionFixture(t *testing.T) *regressionFixture {
	t.Helper()
	fixture := &regressionFixture{t: t}

	protected := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(protected, &mcpsdk.Tool{Name: "protected"}, func(context.Context, *mcpsdk.CallToolRequest, map[string]any) (*mcpsdk.CallToolResult, struct{}, error) {
		fixture.backendCalls.Add(1)
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	protectedHandler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return protected }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	fixture.backend = httptest.NewServer(protectedHandler)
	t.Cleanup(fixture.backend.Close)

	var err error
	fixture.privateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate fixture OIDC key: %v", err)
	}
	mux := http.NewServeMux()
	fixture.gateway = httptest.NewUnstartedServer(mux)
	fixture.gateway.StartTLS()
	mux.HandleFunc("/authorize", func(w http.ResponseWriter, r *http.Request) {
		fixture.nonce = r.URL.Query().Get("nonce")
		http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=regression-code-canary&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if r.FormValue("grant_type") == "refresh_token" {
			if fixture.rejectRefresh.Load() {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"error":"invalid_grant"}`)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			// expires_in stays at the same deterministically-already-expired
			// value as the initial exchange (see the comment below) so every
			// refreshed upstream credential is itself due for another refresh
			// on its very next use -- cascading short-lived tokens, no sleep.
			_, _ = io.WriteString(w, `{"access_token":"regression-token-2","refresh_token":"regression-refresh-2","token_type":"Bearer","expires_in":1}`)
			return
		}
		idToken := fixture.idToken(t, "regression-client", "regression-subject")
		w.Header().Set("Content-Type", "application/json")
		// expires_in is deliberately far shorter than oauth2.Token's internal
		// expiry safety margin (~10s), so scopedGrantTokenSource.Token()
		// (runtime.go:1909) treats this grant as already-invalid on the very
		// next per-request check -- forcing every call after the first to go
		// through refreshDownstreamGrant, without a real sleep.
		_, _ = io.WriteString(w, `{"access_token":"regression-token-1","refresh_token":"regression-refresh-1","id_token":"`+idToken+`","token_type":"Bearer","expires_in":1}`)
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]any{{"kty": "RSA", "kid": "regression", "use": "sig", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(fixture.privateKey.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(fixture.privateKey.E)).Bytes())}}})
	})
	t.Cleanup(fixture.gateway.Close)
	return fixture
}

func (f *regressionFixture) idToken(t *testing.T, audience, subject string) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: f.privateKey}, (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "regression"))
	if err != nil {
		t.Fatalf("create fixture JWT signer: %v", err)
	}
	token, err := jwt.Signed(signer).Claims(map[string]any{"iss": f.gateway.URL, "sub": subject, "aud": audience, "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "nonce": f.nonce}).CompactSerialize()
	if err != nil {
		t.Fatalf("sign fixture ID token: %v", err)
	}
	return token
}

func (f *regressionFixture) browserClient(callback *httptest.Server) *http.Client {
	if f.client != nil {
		return f.client
	}
	pool := x509.NewCertPool()
	if certificate := f.gateway.Certificate(); certificate != nil {
		pool.AddCert(certificate)
	}
	pool.AddCert(callback.Certificate())
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig.RootCAs = pool
	f.t.Cleanup(transport.CloseIdleConnections)
	f.client = &http.Client{Transport: transport}
	return f.client
}

// x509.SetFallbackRoots may be called at most once per process; every test in
// this package that needs a fake TLS root funnels through this shared,
// once-installed pool instead of calling it directly (a second direct call
// panics when the whole package runs in one binary). The GODEBUG flag that
// activates the fallback pool is latched at the FIRST SetFallbackRoots call,
// so it must be set before any test runs -- init() runs before TestMain.
func init() {
	_ = os.Setenv("GODEBUG", "x509usefallbackroots=1")
}

var (
	systemRootsOnce sync.Once
	systemRootsPool *x509.CertPool
)

func installSystemRootsOnce() *x509.CertPool {
	systemRootsOnce.Do(func() {
		systemRootsPool = x509.NewCertPool()
		x509.SetFallbackRoots(systemRootsPool)
	})
	return systemRootsPool
}

func configureRegressionSystemRoots(t *testing.T, certs ...*x509.Certificate) {
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
