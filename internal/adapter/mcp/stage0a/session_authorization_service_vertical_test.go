package stage0a_test

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stacklok/toolhive/pkg/auth/upstreamtoken"
	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
	"github.com/stacklok/toolhive/pkg/vmcp"
	"github.com/stacklok/toolhive/pkg/vmcp/aggregator"
	vmcpauth "github.com/stacklok/toolhive/pkg/vmcp/auth"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/factory"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/strategies"
	authtypes "github.com/stacklok/toolhive/pkg/vmcp/auth/types"
	vmcpclient "github.com/stacklok/toolhive/pkg/vmcp/client"
	vmcpconfig "github.com/stacklok/toolhive/pkg/vmcp/config"
	"github.com/stacklok/toolhive/pkg/vmcp/router"
	vmcpserver "github.com/stacklok/toolhive/pkg/vmcp/server"
	vmcpsession "github.com/stacklok/toolhive/pkg/vmcp/session"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

// TestSessionMCPAuthorization_RealRuntimeServiceVertical proves the direct
// Service continuation against the real ToolHive vMCP transport. The only
// correlation carried across the browser rendezvous is the model-safe call ID.
func TestSessionMCPAuthorization_RealRuntimeServiceVertical(t *testing.T) {
	const callID = "mcp-call-safe-01"

	var callback http.Handler
	callbackQueries := make(chan url.Values, 1)
	callbackServer := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackQueries <- r.URL.Query()
		if callback == nil {
			http.Error(w, "callback not installed", http.StatusServiceUnavailable)
			return
		}
		callback.ServeHTTP(w, r)
	}))
	callbackServer.StartTLS()
	t.Cleanup(callbackServer.Close)

	fixture := newServiceVerticalToolHive(t, callbackServer.URL+"/callback")

	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte(`mcp:
  mode: broker
  servers:
    - name: github
      url: `+fixture.backend.URL+`
      auth:
        mode: oauth
        oauth:
          issuer: `+fixture.gateway.URL+`
          client:
            mode: cimd
            cimd: {document_url: `+fixture.gateway.URL+`/client.json}
          scopes: [read]
          network: {}
  broker:
    callback_url: `+callbackServer.URL+`/callback
`), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall(callID, "github_protected", json.RawMessage(`{}`))),
		mockllm.TextTurn("model final"),
	)
	owner := &session.Principal{Issuer: "https://identity.example", Subject: "alice", GrantType: session.GrantTypeUser}
	ownerCtx := session.WithPrincipal(context.Background(), owner)
	foreignCtx := session.WithPrincipal(context.Background(), &session.Principal{Issuer: owner.Issuer, Subject: "bob", GrantType: session.GrantTypeUser})
	audit := &serviceVerticalAudit{}
	built, err := app.Build(context.Background(), app.Config{
		Workspace:           t.TempDir(),
		MockProvider:        provider,
		AllowAllTools:       true,
		OwnershipEnforced:   true,
		ToolCallRecorder:    audit,
		PermissionConfigs:   []string{settings},
		MCPAuthorityLoader:  cliconfig.NewMCPProfileResolver(nil, func(string) (string, bool) { return "", false }),
		MCPAuthorityDefault: string(cliconfig.MCPAuthorityBroker),
		MCPBrokerSupported:  true,
		VMCPBrokerConstructor: func(_ context.Context, declarations app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			if len(declarations.Profiles) != 1 || declarations.Profiles[0].Name != "github" || declarations.Profiles[0].URL != fixture.backend.URL || declarations.Profiles[0].Auth.OAuth == nil || declarations.Profiles[0].Auth.OAuth.Issuer != fixture.gateway.URL || declarations.CallbackURL != callbackServer.URL+"/callback" {
				t.Fatalf("broker declarations = %#v", declarations)
			}
			runtime, err := vmcpbroker.NewToolHiveStreamingHTTPRuntime([]vmcpbroker.Route{{
				BackendID: "github", Protected: true, ReadOnly: true,
				Tool: tool.ToolSpec{Name: "github_protected", Schema: json.RawMessage(`{"type":"object"}`)},
			}}, fixture.gateway.URL+"/mcp", fixture.config, time.Minute)
			if err != nil {
				return nil, err
			}
			return vmcpbroker.NewProcess(runtime)
		},
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(built.Close)
	callback = built.VMCPBrokerHandlers.Callback

	sess, err := built.Service.CreateSession(ownerCtx, t.TempDir(), session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := built.Service.StartInteractiveRunContent(ownerCtx, sess.ID, "read protected data", nil)
	if err != nil {
		t.Fatalf("StartInteractiveRunContent: %v", err)
	}
	var parkedEvents []session.Event
	for event := range run.Events() {
		parkedEvents = append(parkedEvents, event)
	}
	if run.Outcome() != agent.RunOutcomeAuthorizationParked {
		parked, loadErr := built.Service.GetSession(ownerCtx, sess.ID)
		t.Fatalf("parked outcome = %v, session=%#v, messages=%s, load=%v", run.Outcome(), parked, serviceVerticalMessages(parked), loadErr)
	}
	built.Service.FinishRun(sess.ID, run)
	for _, event := range parkedEvents {
		if event.ToolCall != nil && len(event.ToolCall.Args) != 0 {
			t.Fatalf("protected tool card leaked arguments: %#v", event.ToolCall)
		}
		if event.MCPAuthorization != nil {
			if event.MCPAuthorization.AuthorizationID == "" || event.MCPAuthorization.Call != callID || event.MCPAuthorization.Backend != "github_protected" {
				t.Fatalf("required authorization event = %#v, want safe correlation", event.MCPAuthorization)
			}
			encoded, marshalErr := json.Marshal(event)
			if marshalErr != nil || strings.Contains(string(encoded), "upstream-code") || strings.Contains(string(encoded), callbackServer.URL) {
				t.Fatalf("required authorization event leaked secret/browser URL: %s (%v)", encoded, marshalErr)
			}
		}
	}

	parked, err := built.Service.GetSession(ownerCtx, sess.ID)
	if err != nil {
		t.Fatalf("load parked session: %v", err)
	}
	pending, ok := parked.PendingMCPAuthorization()
	if !ok || pending.Call.ID != callID || pending.Call.Name != "github_protected" {
		t.Fatalf("durable pending authorization = %#v, want exact safe call correlation", pending)
	}
	control := server.MCPAuthorizationControl{SessionID: sess.ID, AuthorizationID: pending.AuthorizationID}
	if _, err := built.Service.MCPAuthorizationPresentation(foreignCtx, sess.ID, control); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign presentation = %v, want ErrNotFound", err)
	}
	browserURL, err := built.Service.MCPAuthorizationPresentation(ownerCtx, sess.ID, control)
	if err != nil || browserURL == "" {
		t.Fatalf("owner presentation = %q, %v", browserURL, err)
	}

	serviceVerticalBrowserAuthorization(t, fixture.browserClient(callbackServer), browserURL)
	callbackQuery := <-callbackQueries
	if callbackQuery.Get("code") == "" || callbackQuery.Get("state") == "" || callbackQuery.Get("scope") == "" {
		t.Fatalf("callback query = %q, want non-empty code/state/scope", callbackQuery.Encode())
	}

	continued, err := built.Service.RecheckMCPAuthorization(ownerCtx, sess.ID, control)
	if err != nil || continued == nil {
		t.Fatalf("connected recheck = %v, %v", continued, err)
	}
	for range continued.Events() {
	}
	built.Service.FinishRun(sess.ID, continued)
	if fixture.handlerCalls.Load() != 1 {
		t.Fatalf("actual protected MCP tool handler calls = %d, want 1", fixture.handlerCalls.Load())
	}
	if audit.calls.Load() != 1 {
		t.Fatalf("protected tool audit calls = %d, want 1", audit.calls.Load())
	}
	if rerun, err := built.Service.RecheckMCPAuthorization(ownerCtx, sess.ID, control); !errors.Is(err, server.ErrNotFound) || rerun != nil || fixture.handlerCalls.Load() != 1 {
		t.Fatalf("second recheck = (%v, %v), calls=%d; want no retry", rerun, err, fixture.handlerCalls.Load())
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
	results := 0
	for _, message := range finished.Conversation.Messages {
		if message.Role == session.RoleTool && message.ToolResult != nil && message.ToolResult.CallID == callID {
			results++
			if message.ToolResult.IsError || !strings.Contains(message.ToolResult.Content, "protected result") {
				t.Fatalf("protected tool result = %#v", message.ToolResult)
			}
		}
	}
	if results != 1 {
		t.Fatalf("recorded exact protected result count = %d, want 1", results)
	}
	if got := finished.Conversation.Messages[len(finished.Conversation.Messages)-1]; got.Role != session.RoleAssistant || got.Text != "model final" {
		t.Fatalf("final model message = %#v", got)
	}
}

type serviceVerticalAudit struct{ calls atomic.Int32 }

func (a *serviceVerticalAudit) ToolCall(_ session.SessionID, _ session.ToolCall, _ session.ToolResult, _, _ time.Duration) {
	a.calls.Add(1)
}

var _ port.ToolCallRecorder = (*serviceVerticalAudit)(nil)

type serviceVerticalToolHiveFixture struct {
	gateway      *httptest.Server
	backend      *httptest.Server
	config       vmcpbroker.ToolHiveRuntimeConfig
	handlerCalls atomic.Int32
}

func (f *serviceVerticalToolHiveFixture) browserClient(callback *httptest.Server) *http.Client {
	pool := x509.NewCertPool()
	pool.AddCert(f.gateway.Certificate())
	pool.AddCert(callback.Certificate())
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig.RootCAs = pool
	return &http.Client{Transport: transport}
}

func newServiceVerticalToolHive(t *testing.T, callbackURL string) *serviceVerticalToolHiveFixture {
	t.Helper()
	fixture := &serviceVerticalToolHiveFixture{}
	const upstreamCredential = "vertical-upstream-credential"
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=upstream-code&state="+url.QueryEscape(r.URL.Query().Get("state"))+"&scope=read", http.StatusFound)
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"access_token":"`+upstreamCredential+`","token_type":"Bearer","sub":"subject"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(upstream.Close)

	protected := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(protected, &mcpsdk.Tool{Name: "protected"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		fixture.handlerCalls.Add(1)
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	protectedHandler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return protected }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+upstreamCredential {
			http.Error(w, "missing upstream credential", http.StatusUnauthorized)
			return
		}
		protectedHandler.ServeHTTP(w, r)
	}))
	t.Cleanup(backend.Close)
	fixture.backend = backend

	mux := http.NewServeMux()
	gateway := httptest.NewUnstartedServer(mux)
	issuer := "https://" + gateway.Listener.Addr().String()
	store := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(context.Background(), &authserver.RunConfig{SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer}, Upstreams: []authserver.UpstreamRunConfig{{Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{AuthorizationEndpoint: upstream.URL + "/authorize", TokenEndpoint: upstream.URL + "/token", ClientID: "vertical-client", RedirectURI: issuer + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"}, AllowPrivateIPs: true, InsecureAllowHTTP: true}}}}, store)
	if err != nil {
		t.Fatalf("embedded auth server: %v", err)
	}
	reader := upstreamtoken.NewInProcessService(auth.IDPTokenStorage(), auth.UpstreamTokenRefresher())
	incoming, _, authInfo, err := factory.NewIncomingAuthMiddleware(context.Background(), &vmcpconfig.IncomingAuthConfig{Type: "oidc", OIDC: &vmcpconfig.OIDCConfig{Issuer: issuer, Audience: issuer, Resource: issuer, JWKSURL: issuer + "/.well-known/jwks.json", JwksAllowPrivateIP: true, ProtectedResourceAllowPrivateIP: true, InsecureAllowHTTP: true}}, "vertical", nil, reader, auth.KeyProvider())
	if err != nil {
		t.Fatalf("incoming auth: %v", err)
	}
	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		t.Fatalf("register upstream injection: %v", err)
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("backend client: %v", err)
	}
	resolver, err := aggregator.NewConflictResolver(&vmcpconfig.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		t.Fatalf("conflict resolver: %v", err)
	}
	registry := vmcp.NewImmutableRegistry([]vmcp.Backend{{ID: "github", Name: "github", BaseURL: backend.URL, TransportType: "streamable-http", AuthConfig: &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: "upstream"}}}})
	vmcpServer, err := vmcpserver.New(context.Background(), &vmcpserver.Config{Name: "vertical", Version: "test", AuthMiddleware: incoming, AuthInfoHandler: authInfo, AuthServer: auth, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil), SessionFactory: vmcpsession.NewSessionFactory(outgoing)}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, registry, nil)
	if err != nil {
		t.Fatalf("vMCP server: %v", err)
	}
	handler, err := vmcpServer.Handler(context.Background())
	if err != nil {
		t.Fatalf("vMCP handler: %v", err)
	}
	mux.Handle("/", handler)
	gateway.Config.Handler = mux
	gateway.StartTLS()
	t.Cleanup(func() { _ = vmcpServer.Stop(context.Background()); _ = auth.Close(); gateway.Close() })
	fixture.gateway = gateway
	fixture.config = vmcpbroker.ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: gateway.URL, Resource: gateway.URL, AuthorizationEndpoint: gateway.URL + "/oauth/authorize", TokenEndpoint: gateway.URL + "/oauth/token", CallbackURL: callbackURL, HTTPClient: gateway.Client()}
	return fixture
}

func serviceVerticalMessages(sess *session.Session) string {
	if sess == nil {
		return "<nil>"
	}
	var messages []string
	for _, message := range sess.Conversation.Messages {
		if message.ToolResult != nil {
			messages = append(messages, string(message.Role)+":"+message.ToolResult.Content)
			continue
		}
		messages = append(messages, string(message.Role)+":"+message.Text)
	}
	return strings.Join(messages, " | ")
}

func serviceVerticalBrowserAuthorization(t *testing.T, client *http.Client, browserURL string) {
	t.Helper()
	response, err := client.Get(browserURL)
	if err != nil {
		t.Fatalf("follow authorization redirect: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("callback status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if response.Header.Get("Cache-Control") != "no-store" || response.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("callback security headers = Cache-Control:%q Referrer-Policy:%q", response.Header.Get("Cache-Control"), response.Header.Get("Referrer-Policy"))
	}
	body, err := io.ReadAll(response.Body)
	if err != nil || string(body) != "Authorization complete. You may close this window.\n" {
		t.Fatalf("callback response = %q, %v", body, err)
	}
}
