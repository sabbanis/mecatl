package stage0a_test

import (
	"context"
	"encoding/json"
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
	fixture := newServiceVerticalToolHive(t)

	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte(`mcp:
  mode: broker
  servers:
    - name: github
      url: https://github.invalid/mcp
      auth:
        mode: oauth
        oauth:
          issuer: https://issuer.invalid
          client:
            mode: cimd
            cimd: {document_url: https://issuer.invalid/client.json}
          scopes: [read]
          network: {}
  broker:
    callback_url: https://client.invalid/callback
`), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall(callID, "github_protected", json.RawMessage(`{}`))),
		mockllm.TextTurn("model final"),
	)
	built, err := app.Build(context.Background(), app.Config{
		Workspace:           t.TempDir(),
		MockProvider:        provider,
		AllowAllTools:       true,
		PermissionConfigs:   []string{settings},
		MCPAuthorityLoader:  cliconfig.NewMCPProfileResolver(nil, func(string) (string, bool) { return "", false }),
		MCPAuthorityDefault: string(cliconfig.MCPAuthorityBroker),
		MCPBrokerSupported:  true,
		VMCPBrokerConstructor: func(_ context.Context, declarations app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			if len(declarations.Profiles) != 1 || declarations.Profiles[0].Name != "github" {
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

	sess, err := built.Service.CreateSession(context.Background(), t.TempDir(), session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := built.Service.StartInteractiveRunContent(context.Background(), sess.ID, "read protected data", nil)
	if err != nil {
		t.Fatalf("StartInteractiveRunContent: %v", err)
	}
	for range run.Events() {
	}
	if run.Outcome() != agent.RunOutcomeAuthorizationParked {
		parked, loadErr := built.Service.GetSession(context.Background(), sess.ID)
		t.Fatalf("parked outcome = %v, session=%#v, messages=%s, load=%v", run.Outcome(), parked, serviceVerticalMessages(parked), loadErr)
	}
	built.Service.FinishRun(sess.ID, run)

	parked, err := built.Service.GetSession(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("load parked session: %v", err)
	}
	pending, ok := parked.PendingMCPAuthorization()
	if !ok || pending.Call.ID != callID || pending.Call.Name != "github_protected" {
		t.Fatalf("durable pending authorization = %#v, want exact safe call correlation", pending)
	}
	control := server.MCPAuthorizationControl{SessionID: sess.ID, AuthorizationID: pending.AuthorizationID}
	browserURL, err := built.Service.MCPAuthorizationPresentation(context.Background(), sess.ID, control)
	if err != nil || browserURL == "" {
		t.Fatalf("owner presentation = %q, %v", browserURL, err)
	}

	code, state := serviceVerticalBrowserAuthorization(t, fixture.gateway.Client(), browserURL)
	callback := httptest.NewRequest(http.MethodGet, "https://client.invalid/callback?"+url.Values{"code": {code}, "state": {state}}.Encode(), nil)
	callbackResult := httptest.NewRecorder()
	built.VMCPBrokerHandlers.Callback.ServeHTTP(callbackResult, callback)
	if callbackResult.Code != http.StatusOK {
		t.Fatalf("browser callback status = %d", callbackResult.Code)
	}

	continued, err := built.Service.RecheckMCPAuthorization(context.Background(), sess.ID, control)
	if err != nil || continued == nil {
		t.Fatalf("connected recheck = %v, %v", continued, err)
	}
	for range continued.Events() {
	}
	built.Service.FinishRun(sess.ID, continued)
	if fixture.handlerCalls.Load() != 1 {
		t.Fatalf("actual protected MCP tool handler calls = %d, want 1", fixture.handlerCalls.Load())
	}

	finished, err := built.Service.GetSession(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("load finished session: %v", err)
	}
	if finished.State != session.StateCompleted {
		t.Fatalf("finished session state = %s", finished.State)
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

type serviceVerticalToolHiveFixture struct {
	gateway      *httptest.Server
	config       vmcpbroker.ToolHiveRuntimeConfig
	handlerCalls atomic.Int32
}

func newServiceVerticalToolHive(t *testing.T) *serviceVerticalToolHiveFixture {
	t.Helper()
	fixture := &serviceVerticalToolHiveFixture{}
	const upstreamCredential = "vertical-upstream-credential"
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=upstream-code&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
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
	fixture.config = vmcpbroker.ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: gateway.URL, Resource: gateway.URL, AuthorizationEndpoint: gateway.URL + "/oauth/authorize", TokenEndpoint: gateway.URL + "/oauth/token", CallbackURL: "https://client.invalid/callback", HTTPClient: gateway.Client()}
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

func serviceVerticalBrowserAuthorization(t *testing.T, client *http.Client, browserURL string) (string, string) {
	t.Helper()
	noRedirect := *client
	noRedirect.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := noRedirect.Get(browserURL)
	if err != nil {
		t.Fatalf("authorize: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusFound {
		t.Fatalf("authorize status = %d", response.StatusCode)
	}
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("upstream authorize: %v", err)
	}
	defer response.Body.Close()
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("embedded callback: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusSeeOther {
		t.Fatalf("embedded callback status = %d", response.StatusCode)
	}
	callback, err := url.Parse(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse callback: %v", err)
	}
	code, state := callback.Query().Get("code"), callback.Query().Get("state")
	if code == "" || state == "" {
		t.Fatalf("callback correlation = code:%q state:%q", code, state)
	}
	return code, state
}
