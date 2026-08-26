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
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
)

func TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay(t *testing.T) {
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

func TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation(t *testing.T) {
	var bearerRequests atomic.Int32
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "mcp__github__list_issues"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected upstream result"}}}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, nil)
	broker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "missing bearer", http.StatusUnauthorized)
			return
		}
		bearerRequests.Add(1)
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(broker.Close)

	runtime, client, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	runtime.opener = streamingSessionOpener(runtime, broker.URL)
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
	result, err := before[0].Execute(context.Background(), session.NewToolCall("call", before[0].Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("protected Execute: %v", err)
	}
	if result.IsError || !strings.Contains(result.Content, "protected upstream result") || bearerRequests.Load() == 0 {
		t.Fatalf("protected result/bearer requests = %+v/%d, want protected vMCP execution with a private bearer", result, bearerRequests.Load())
	}
	after := tools.Tools()
	if len(after) != len(before) || !reflect.DeepEqual(after[0].Spec(), before[0].Spec()) {
		t.Fatalf("catalogue identity changed after connection: before=%+v after=%+v", before[0].Spec(), after[0].Spec())
	}
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

	runtime, err := NewToolHiveRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}}, caller, ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: gateway.URL, CallbackURL: "https://client.invalid/callback", HTTPClient: gateway.Client()}, time.Minute)
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
