package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memlease"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/adapter/wallclock"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

// serviceAuthorizationFixture uses the real Runtime rendezvous and Service
// continuation rather than manufacturing a connected aggregate state.
type serviceAuthorizationFixture struct {
	svc     *Service
	store   *memstore.Store
	runtime *vmcpbroker.Runtime
	id      session.SessionID
	control MCPAuthorizationControl
	client  *http.Client
	calls   int
}

func newServiceAuthorizationFixture(t *testing.T) *serviceAuthorizationFixture {
	t.Helper()
	fixture := &serviceAuthorizationFixture{id: "real-service-authorization"}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=upstream-code&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"access_token":"access","token_type":"Bearer","sub":"subject"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(upstream.Close)

	gateway := httptest.NewUnstartedServer(nil)
	issuer := "https://" + gateway.Listener.Addr().String()
	credentialStore := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(context.Background(), &authserver.RunConfig{
		SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer},
		Upstreams: []authserver.UpstreamRunConfig{{Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: upstream.URL + "/authorize", TokenEndpoint: upstream.URL + "/token", ClientID: "test", RedirectURI: issuer + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"}, AllowPrivateIPs: true, InsecureAllowHTTP: true,
		}}},
	}, credentialStore)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	gateway.Config.Handler = auth.Handler()
	gateway.StartTLS()
	t.Cleanup(func() { gateway.Close(); _ = auth.Close() })

	runtime, err := vmcpbroker.NewToolHiveRuntime([]vmcpbroker.Route{{BackendID: "backend", Protected: true, Tool: tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		fixture.calls++
		return session.NewToolResult("call-protected", "executed"), nil
	}, vmcpbroker.ToolHiveRuntimeConfig{AuthServer: auth, Storage: credentialStore, Issuer: gateway.URL, Resource: gateway.URL, AuthorizationEndpoint: gateway.URL + "/oauth/authorize", TokenEndpoint: gateway.URL + "/oauth/token", CallbackURL: "https://client.invalid/callback", HTTPClient: gateway.Client()}, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	opened, err := runtime.OpenSession(fixture.id)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	pending, err := runtime.Connect(context.Background(), fixture.id, "backend")
	if err != nil || pending.AuthorizationRequired == nil {
		t.Fatalf("Connect = %+v, %v", pending, err)
	}
	fixture.control = MCPAuthorizationControl{SessionID: fixture.id, AuthorizationID: pending.AuthorizationRequired.Handle}
	fixture.runtime, fixture.client = runtime, gateway.Client()

	store := memstore.New()
	sess := session.New(fixture.id, session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	call := session.NewToolCall("call-protected", "mcp__backend__read", json.RawMessage(`{}`))
	deferred := session.NewToolCall("call-deferred", "Read", json.RawMessage(`{"path":"later"}`))
	if err := sess.BeginTurn(); err != nil {
		t.Fatal(err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", []session.ToolCall{call, deferred})); err != nil {
		t.Fatal(err)
	}
	if err := sess.PauseForMCPAuthorization(session.PendingMCPAuthorization{AuthorizationID: fixture.control.AuthorizationID, Backend: "backend", RouteID: call.Name, ConfigID: runtime.EnrollmentID(), ExpiresAt: pending.AuthorizationRequired.ExpiresAt, Call: call, Deferred: []session.ToolCall{deferred}}); err != nil {
		t.Fatal(err)
	}
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatal(err)
	}
	catalog := tool.NewCatalog()
	if err := catalog.Register(opened.Tools()[0]); err != nil {
		t.Fatal(err)
	}
	eng := agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("continued")), Catalog: catalog, Policy: permpolicy.NewPolicy(nil, nil)})
	svc, err := NewService(Config{Engine: eng, Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, VMCPBroker: runtime, SessionLease: memlease.New(wallclock.Clock{}, time.Minute), LeaseRenewInterval: time.Second, SessionEngine: func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
		return SessionEngineResult{Engine: eng}, nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	fixture.svc, fixture.store = svc, store
	t.Cleanup(svc.Close)
	return fixture
}

func (f *serviceAuthorizationFixture) connect(t *testing.T) {
	t.Helper()
	noRedirect := *f.client
	noRedirect.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := noRedirect.Get(mustPresentation(t, f))
	if err != nil {
		t.Fatalf("authorize: %v", err)
	}
	_ = response.Body.Close()
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("upstream: %v", err)
	}
	_ = response.Body.Close()
	response, err = noRedirect.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("callback: %v", err)
	}
	_ = response.Body.Close()
	callback, err := url.Parse(response.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if err := f.runtime.Callback(context.Background(), callback.Query().Get("code"), callback.Query().Get("state")); err != nil {
		t.Fatalf("Callback: %v", err)
	}
}

func mustPresentation(t *testing.T, f *serviceAuthorizationFixture) string {
	t.Helper()
	status, err := f.runtime.CheckAuthorization(context.Background(), f.id, "mcp__backend__read", f.control.AuthorizationID)
	if err != nil {
		t.Fatalf("CheckAuthorization: %v", err)
	}
	return status.BrowserURL
}
