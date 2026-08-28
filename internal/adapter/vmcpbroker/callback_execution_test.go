package vmcpbroker

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
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

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay(t *testing.T) {
	t.Run("downstream exchange failure preserves pending transaction", func(t *testing.T) {
		runtime, _, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
			return session.ToolResult{}, nil
		})
		if _, err := runtime.OpenSession("retry"); err != nil {
			t.Fatalf("OpenSession(retry): %v", err)
		}
		pending, err := runtime.Connect(context.Background(), "retry", "github")
		if err != nil {
			t.Fatalf("Connect(retry): %v", err)
		}
		if err := runtime.Callback(context.Background(), "invalid-downstream-code", pending.AuthorizationRequired.Handle); err == nil {
			t.Fatal("Callback with invalid downstream code succeeded")
		}
		retried, err := runtime.Connect(context.Background(), "retry", "github")
		if err != nil {
			t.Fatalf("Connect(retry) after failed downstream exchange: %v", err)
		}
		if retried.Status != ConnectionPending || retried.AuthorizationRequired == nil ||
			retried.AuthorizationRequired.Handle != pending.AuthorizationRequired.Handle ||
			retried.AuthorizationRequired.BrowserURL != pending.AuthorizationRequired.BrowserURL {
			t.Fatalf("Connect(retry) after failed downstream exchange = %+v, want original pending transaction", retried)
		}
	})

	runtime, client, upstreamTokenCalls := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if _, err := runtime.OpenSession("first"); err != nil {
		t.Fatalf("OpenSession(first): %v", err)
	}
	if _, err := runtime.OpenSession("second"); err != nil {
		t.Fatalf("OpenSession(second): %v", err)
	}

	first, err := runtime.Connect(context.Background(), "first", "github")
	if err != nil {
		t.Fatalf("Connect(first): %v", err)
	}
	second, err := runtime.Connect(context.Background(), "second", "github")
	if err != nil {
		t.Fatalf("Connect(second): %v", err)
	}
	code, state := completeToolHiveAuthorization(t, client, first.AuthorizationRequired.BrowserURL)

	if err := runtime.Callback(context.Background(), "wrong-code", second.AuthorizationRequired.Handle); err == nil {
		t.Fatal("cross-session callback succeeded")
	}
	if connected, err := runtime.Connect(context.Background(), "second", "github"); err != nil || connected.Status != ConnectionPending {
		t.Fatalf("second Connect after cross-session callback = %+v, %v; want pending unchanged", connected, err)
	}
	if err := runtime.Callback(context.Background(), code, state); err != nil {
		t.Fatalf("Callback: %v", err)
	}
	if err := runtime.Callback(context.Background(), code, state); err == nil {
		t.Fatal("duplicate callback succeeded")
	}
	if err := runtime.Callback(context.Background(), "wrong-code", state); err == nil {
		t.Fatal("late callback succeeded")
	}
	if upstreamTokenCalls.Load() != 1 {
		t.Fatalf("upstream token exchanges = %d, want exactly ToolHive's authorization exchange", upstreamTokenCalls.Load())
	}
	connected, err := runtime.Connect(context.Background(), "first", "github")
	if err != nil {
		t.Fatalf("Connect(first) after callback: %v", err)
	}
	if connected.Status != ConnectionConnected || connected.AuthorizationRequired != nil {
		t.Fatalf("Connect(first) after callback = %+v, want connected without browser details", connected)
	}
}

func TestInvariant_vmcp_transport_uses_scoped_bearer_token_source(t *testing.T) {
	runtime, client, upstreamCalls := newToolHiveStreamingRuntime(t)
	tools, err := runtime.OpenSession("parent")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	before := tools.Tools()
	if len(before) != 1 {
		t.Fatalf("tools before connection = %d, want 1", len(before))
	}

	pending, err := runtime.Connect(context.Background(), "parent", "github")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	code, state := completeToolHiveAuthorization(t, client, pending.AuthorizationRequired.BrowserURL)
	if err := runtime.Callback(context.Background(), code, state); err != nil {
		t.Fatalf("Callback: %v", err)
	}
	connected, err := runtime.Connect(context.Background(), "parent", "github")
	if err != nil || connected.Status != ConnectionConnected {
		t.Fatalf("Connect after callback = %+v, %v; want connected", connected, err)
	}
	result, err := before[0].Execute(context.Background(), session.NewToolCall("call", before[0].Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("protected Execute: %v", err)
	}
	if result.IsError || !strings.Contains(result.Content, "protected upstream result") || upstreamCalls.Load() == 0 {
		t.Fatalf("protected result/upstream calls = %+v/%d, want ToolHive vMCP execution with its injected upstream credential", result, upstreamCalls.Load())
	}
	after := tools.Tools()
	if len(after) != len(before) || !reflect.DeepEqual(after[0].Spec(), before[0].Spec()) {
		t.Fatalf("catalogue identity changed after connection: before=%+v after=%+v", before[0].Spec(), after[0].Spec())
	}
}

func newToolHiveStreamingRuntime(t *testing.T) (*Runtime, *http.Client, *atomic.Int32) {
	t.Helper()
	return newToolHiveStreamingRuntimeWithTool(t, "list_issues", "github_list_issues", "protected upstream result")
}

func newToolHiveStreamingRuntimeWithTool(t *testing.T, upstreamToolName, routeToolName, resultText string) (*Runtime, *http.Client, *atomic.Int32) {
	const upstreamCredential = "upstream-credential-for-session-lineage"
	var upstreamCalls atomic.Int32

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
	mcpsdk.AddTool(protected, &mcpsdk.Tool{Name: upstreamToolName}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: resultText}}}, struct{}{}, nil
	})
	protectedHandler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return protected }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	protectedServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+upstreamCredential {
			http.Error(w, "missing expected upstream credential", http.StatusUnauthorized)
			return
		}
		upstreamCalls.Add(1)
		protectedHandler.ServeHTTP(w, r)
	}))
	t.Cleanup(func() {
		protectedServer.CloseClientConnections()
		protectedServer.Close()
	})

	mux := http.NewServeMux()
	gateway := httptest.NewUnstartedServer(mux)
	issuer := "https://" + gateway.Listener.Addr().String()
	store := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(context.Background(), &authserver.RunConfig{
		SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer},
		Upstreams: []authserver.UpstreamRunConfig{{Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: upstream.URL + "/authorize", TokenEndpoint: upstream.URL + "/token", ClientID: "upstream-client", RedirectURI: issuer + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"}, AllowPrivateIPs: true, InsecureAllowHTTP: true,
		}}},
	}, store)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	reader := upstreamtoken.NewInProcessService(auth.IDPTokenStorage(), auth.UpstreamTokenRefresher())
	incoming, _, authInfo, err := factory.NewIncomingAuthMiddleware(context.Background(), &vmcpconfig.IncomingAuthConfig{Type: "oidc", OIDC: &vmcpconfig.OIDCConfig{
		Issuer: issuer, Audience: issuer, Resource: issuer, JWKSURL: issuer + "/.well-known/jwks.json", JwksAllowPrivateIP: true, ProtectedResourceAllowPrivateIP: true, InsecureAllowHTTP: true,
	}}, "broker", nil, reader, auth.KeyProvider())
	if err != nil {
		t.Fatalf("NewIncomingAuthMiddleware: %v", err)
	}
	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		t.Fatalf("register upstream injection: %v", err)
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("NewHTTPBackendClient: %v", err)
	}
	resolver, err := aggregator.NewConflictResolver(&vmcpconfig.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		t.Fatalf("NewConflictResolver: %v", err)
	}
	registry := vmcp.NewImmutableRegistry([]vmcp.Backend{{ID: "github", Name: "github", BaseURL: protectedServer.URL, TransportType: "streamable-http", AuthConfig: &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: "upstream"}}}})
	vmcpServer, err := vmcpserver.New(context.Background(), &vmcpserver.Config{Name: "broker", Version: "test", AuthMiddleware: incoming, AuthInfoHandler: authInfo, AuthServer: auth, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil), SessionFactory: vmcpsession.NewSessionFactory(outgoing)}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, registry, nil)
	if err != nil {
		t.Fatalf("vmcp server.New: %v", err)
	}
	handler, err := vmcpServer.Handler(context.Background())
	if err != nil {
		t.Fatalf("vmcp Handler: %v", err)
	}
	mux.Handle("/", handler)
	gateway.Config.Handler = mux
	gateway.StartTLS()
	t.Cleanup(func() {
		if err := vmcpServer.Stop(context.Background()); err != nil {
			t.Errorf("vMCP Stop: %v", err)
		}
		if err := auth.Close(); err != nil {
			t.Errorf("embedded authserver Close: %v", err)
		}
		gateway.CloseClientConnections()
		gateway.Close()
	})

	runtime, err := NewToolHiveStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: routeToolName, Schema: json.RawMessage(`{"type":"object"}`)}}}, gateway.URL+"/mcp", ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: gateway.URL, AuthorizationEndpoint: gateway.URL + "/oauth/authorize", TokenEndpoint: gateway.URL + "/oauth/token", CallbackURL: "https://client.invalid/callback", HTTPClient: gateway.Client()}, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	return runtime, gateway.Client(), &upstreamCalls
}

func newCallbackRuntime(t *testing.T, caller Caller) (*Runtime, *http.Client, *atomic.Int32) {
	t.Helper()
	var upstreamTokenCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			if r.URL.Query().Get("code_challenge_method") != "S256" || r.URL.Query().Get("code_challenge") == "" {
				http.Error(w, "missing PKCE", http.StatusBadRequest)
				return
			}
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=upstream-code&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
		case "/token":
			upstreamTokenCalls.Add(1)
			if err := r.ParseForm(); err != nil || r.Form.Get("code") != "upstream-code" {
				http.Error(w, "bad upstream code", http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"access_token":"upstream-access","token_type":"Bearer","sub":"subject"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(upstream.Close)

	gateway := httptest.NewUnstartedServer(nil)
	issuer := "https://" + gateway.Listener.Addr().String()
	store := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(context.Background(), &authserver.RunConfig{
		SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer},
		Upstreams: []authserver.UpstreamRunConfig{{Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: upstream.URL + "/authorize", TokenEndpoint: upstream.URL + "/token", ClientID: "upstream-client", RedirectURI: issuer + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"}, AllowPrivateIPs: true, InsecureAllowHTTP: true,
		}}},
	}, store)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	gateway.Config.Handler = auth.Handler()
	gateway.StartTLS()
	t.Cleanup(func() { gateway.Close(); _ = auth.Close() })

	runtime, err := NewToolHiveRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}}, caller, ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: gateway.URL, AuthorizationEndpoint: gateway.URL + "/oauth/authorize", TokenEndpoint: gateway.URL + "/oauth/token", CallbackURL: "https://client.invalid/callback", HTTPClient: gateway.Client()}, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	return runtime, gateway.Client(), &upstreamTokenCalls
}

func completeToolHiveAuthorization(t *testing.T, client *http.Client, browserURL string) (string, string) {
	t.Helper()
	noRedirect := *client
	noRedirect.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := noRedirect.Get(browserURL)
	if err != nil {
		t.Fatalf("ToolHive authorize: %v", err)
	}
	_ = response.Body.Close()
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("upstream authorize: %v", err)
	}
	_ = response.Body.Close()
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("ToolHive upstream callback: %v", err)
	}
	_ = response.Body.Close()
	callback, err := url.Parse(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("parse callback: %v", err)
	}
	code, state := callback.Query().Get("code"), callback.Query().Get("state")
	if code == "" || state == "" {
		t.Fatal("ToolHive callback omitted downstream code or state")
	}
	return code, state
}

func TestInvariant_mcp_authorization_required_payload_has_no_private_or_secret_data(t *testing.T) {
	runtime, _, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	runtime.routes[0].BackendID = "broker-private-secret"
	runtime.routes[0].AuthorizationLabel = "Configured GitHub"
	runtime.oauthBackend = "broker-private-secret"
	tools, err := runtime.OpenSession("safe-payload")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	requester, ok := tools.Tools()[0].(tool.AuthorizationRequester)
	if !ok {
		t.Fatal("protected tool does not expose the authorization seam")
	}
	request, required, err := requester.RequestAuthorization(context.Background())
	if err != nil || !required {
		t.Fatalf("RequestAuthorization = %+v, %v, %v; want required request", request, required, err)
	}
	if request.Backend != "Configured GitHub" || strings.Contains(request.Backend, "broker-private-secret") {
		t.Fatalf("authorization label = %q, want public tool label without private backend identity", request.Backend)
	}
}

func TestInvariant_mcp_authorization_transaction_has_one_linearized_terminal_owner(t *testing.T) {
	runtime, _, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if _, err := runtime.OpenSession("race"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	pending, err := runtime.Connect(context.Background(), "race", "github")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	target := controlTarget{sessionID: "race", backendID: "github"}

	// Model a callback that has claimed the transaction and is blocked in its
	// downstream exchange. Cancellation must win the only terminal transition;
	// no later completion may install a grant after it removes this entry.
	runtime.mu.Lock()
	transaction := runtime.transactions[target]
	transaction.exchanging = true
	runtime.transactions[target] = transaction
	runtime.mu.Unlock()
	if err := runtime.cancelAuthorization("race", "github", pending.AuthorizationRequired.Handle); err != nil {
		t.Fatalf("cancelAuthorization: %v", err)
	}

	runtime.mu.Lock()
	_, stillPending := runtime.transactions[target]
	_, granted := runtime.grants[target]
	runtime.mu.Unlock()
	if stillPending || granted {
		t.Fatalf("cancelled transaction state pending=%v grant=%v, want neither", stillPending, granted)
	}
	if connected, err := runtime.Connect(context.Background(), "race", "github"); err != nil || connected.Status != ConnectionPending || connected.AuthorizationRequired.Handle == pending.AuthorizationRequired.Handle {
		t.Fatalf("Connect after cancellation = %+v, %v; want a distinct pending transaction", connected, err)
	}
}
