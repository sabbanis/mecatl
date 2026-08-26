package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
)

func TestCompileProfiles_DerivesProtectedRoutesFromSupportedAuthModes(t *testing.T) {
	t.Parallel()

	routes, err := CompileProfiles([]permconfig.MCPServerProfile{
		{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}},
	}, []ToolDefinition{
		{BackendID: "github", Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)},
		{BackendID: "calendar", Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
	})
	if err != nil {
		t.Fatalf("CompileProfiles: %v", err)
	}
	if len(routes) != 2 {
		t.Fatalf("routes = %d, want 2", len(routes))
	}
	if routes[0].Tool.Name != "mcp__calendar__list_events" || routes[0].Protected {
		t.Fatalf("calendar route = %+v, want unprotected auth:none route", routes[0])
	}
	if routes[1].Tool.Name != "mcp__github__list_issues" || !routes[1].Protected {
		t.Fatalf("github route = %+v, want protected auth:oauth route", routes[1])
	}
}

func TestCompileProfiles_RejectsUnsupportedOrAmbiguousProfiles(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		profiles   []permconfig.MCPServerProfile
		discovered []ToolDefinition
	}{
		{
			name:     "static bearer",
			profiles: []permconfig.MCPServerProfile{{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "static_bearer"}}},
		},
		{
			name:     "unknown auth mode",
			profiles: []permconfig.MCPServerProfile{{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "custom"}}},
		},
		{
			name: "duplicate profile names ignore case",
			profiles: []permconfig.MCPServerProfile{
				{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
				{Name: "GitHub", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}},
			},
		},
		{
			name:     "empty profile name",
			profiles: []permconfig.MCPServerProfile{{Auth: permconfig.MCPAuthProfile{Mode: "none"}}},
		},
		{
			name:       "discovered unconfigured backend",
			profiles:   []permconfig.MCPServerProfile{{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}}},
			discovered: []ToolDefinition{{BackendID: "github", Name: "mcp__github__list_issues"}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := CompileProfiles(test.profiles, test.discovered); !errors.Is(err, ErrInvalidRoute) {
				t.Fatalf("CompileProfiles error = %v, want ErrInvalidRoute", err)
			}
		})
	}
}

type embeddedToolHive struct {
	config   ToolHiveRuntimeConfig
	client   *http.Client
	upstream <-chan struct{}
}

func newEmbeddedToolHive(t *testing.T) embeddedToolHive {
	t.Helper()
	upstreamStarted := make(chan struct{}, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		select {
		case upstreamStarted <- struct{}{}:
		default:
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(upstream.Close)
	gateway := httptest.NewUnstartedServer(nil)
	issuer := "https://" + gateway.Listener.Addr().String()
	store := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(context.Background(), &authserver.RunConfig{
		SchemaVersion:    "v1",
		Issuer:           issuer,
		AllowedAudiences: []string{issuer},
		Upstreams: []authserver.UpstreamRunConfig{{
			Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2,
			OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
				AuthorizationEndpoint: upstream.URL + "/authorize",
				TokenEndpoint:         upstream.URL + "/token",
				ClientID:              "test-client",
				RedirectURI:           issuer + "/oauth/callback",
				IdentityFromToken:     &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"},
				AllowPrivateIPs:       true,
				InsecureAllowHTTP:     true,
			},
		}},
	}, store)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	gateway.Config.Handler = auth.Handler()
	gateway.StartTLS()
	t.Cleanup(func() {
		gateway.Close()
		if err := auth.Close(); err != nil {
			t.Errorf("embedded authserver close: %v", err)
		}
	})
	return embeddedToolHive{
		config: ToolHiveRuntimeConfig{
			AuthServer:  auth,
			Storage:     store,
			Issuer:      gateway.URL,
			CallbackURL: "https://client.invalid/callback",
		},
		client:   gateway.Client(),
		upstream: upstreamStarted,
	}
}

func TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization(t *testing.T) {
	protected := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}
	toolHive := newEmbeddedToolHive(t)
	runtime, err := NewToolHiveRuntime([]Route{protected}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	}, toolHive.config, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := runtime.OpenSession("parent-session"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}

	result, err := runtime.Connect(context.Background(), "parent-session", "github")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	if result.Status != ConnectionPending || result.AuthorizationRequired == nil || result.AuthorizationRequired.Handle == "" || result.AuthorizationRequired.ExpiresAt.IsZero() {
		t.Fatalf("Connect result = %+v, want pending opaque authorization rendezvous", result)
	}
	issuerURL, err := url.Parse(toolHive.config.Issuer)
	if err != nil {
		t.Fatalf("parse issuer: %v", err)
	}
	browserURL, err := url.Parse(result.AuthorizationRequired.BrowserURL)
	if err != nil || browserURL.Scheme != issuerURL.Scheme || browserURL.Host != issuerURL.Host || browserURL.Path != "/oauth/authorize" {
		t.Fatalf("browser URL = %q, want embedded ToolHive HTTPS /oauth/authorize URL", result.AuthorizationRequired.BrowserURL)
	}
	response, err := toolHive.client.Get(result.AuthorizationRequired.BrowserURL)
	if err != nil {
		t.Fatalf("follow ToolHive authorization URL: %v", err)
	}
	_ = response.Body.Close()
	select {
	case <-toolHive.upstream:
	case <-time.After(time.Second):
		t.Fatal("ToolHive authorization did not begin the configured upstream flow")
	}
	if browserURL.Query().Get("code") != "" || browserURL.Query().Get("code_verifier") != "" {
		t.Fatal("browser URL exposed an authorization code or PKCE verifier")
	}
	for _, forbidden := range []string{"token", "refresh", "verifier", "secret", "locator"} {
		if strings.Contains(strings.ToLower(fmt.Sprintf("%+v", result)), forbidden) {
			t.Fatalf("Connect result exposed %q: %+v", forbidden, result)
		}
	}
}

func TestSessionVMCPBroker_Scenario2_ConnectSingleflight(t *testing.T) {
	protected := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}
	runtime, err := NewToolHiveRuntime([]Route{protected}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	}, newEmbeddedToolHive(t).config, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := runtime.OpenSession("parent-session"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}

	first, err := runtime.Connect(context.Background(), "parent-session", "github")
	if err != nil {
		t.Fatalf("first Connect: %v", err)
	}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	const callers = 16
	results := make(chan ConnectResult, callers)
	errs := make(chan error, callers)
	var wait sync.WaitGroup
	for range callers {
		wait.Go(func() {
			result, err := runtime.Connect(cancelled, "parent-session", "github")
			results <- result
			errs <- err
		})
	}
	wait.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("cancelled concurrent waiter Connect: %v", err)
		}
	}
	for result := range results {
		if first.AuthorizationRequired.Handle != result.AuthorizationRequired.Handle || first.AuthorizationRequired.BrowserURL != result.AuthorizationRequired.BrowserURL {
			t.Fatalf("Connect transactions differ: first=%+v concurrent=%+v", first, result)
		}
	}
}

func TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets(t *testing.T) {
	var calls atomic.Int32
	protected := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}
	runtime, err := NewToolHiveRuntime([]Route{protected}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		calls.Add(1)
		return session.ToolResult{}, nil
	}, newEmbeddedToolHive(t).config, time.Minute)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	opened, err := runtime.OpenSession("parent-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	for _, childID := range []session.SessionID{"subagent-child", "parallel-child", "team-child"} {
		if _, err := runtime.OpenSession(childID); err != nil {
			t.Fatalf("OpenSession(%q): %v", childID, err)
		}
	}
	if err := runtime.ForgetSession("parent-session"); err != nil {
		t.Fatalf("ForgetSession: %v", err)
	}

	for _, target := range []struct{ session, backend session.SessionID }{
		{"unknown", "github"}, {"subagent-child", "github"}, {"parallel-child", "github"}, {"team-child", "github"}, {"parent-session", "github"}, {"parent-session", "unconfigured"},
	} {
		if _, err := runtime.Connect(context.Background(), target.session, string(target.backend)); !errors.Is(err, ErrInvalidControlTarget) {
			t.Errorf("Connect(%q, %q) error = %v, want ErrInvalidControlTarget", target.session, target.backend, err)
		}
	}
	if calls.Load() != 0 {
		t.Fatalf("invalid control target contacted caller %d times", calls.Load())
	}
	if _, err := opened.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__github__list_issues", nil), tool.Environment{}); !errors.Is(err, ErrClosed) {
		t.Fatalf("forgotten session tool error = %v, want ErrClosed", err)
	}
}

func TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected(t *testing.T) {
	protected := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}
	runtime, err := NewToolHiveRuntime([]Route{protected}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	}, newEmbeddedToolHive(t).config, -time.Second)
	if err != nil {
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := runtime.OpenSession("parent-session"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	first, err := runtime.Connect(context.Background(), "parent-session", "github")
	if err != nil {
		t.Fatalf("first Connect: %v", err)
	}
	if err := runtime.Callback(context.Background(), "code", first.AuthorizationRequired.Handle); !errors.Is(err, ErrInvalidControlTarget) {
		t.Fatalf("expired callback error = %v, want ErrInvalidControlTarget", err)
	}
	second, err := runtime.Connect(context.Background(), "parent-session", "github")
	if err != nil {
		t.Fatalf("second Connect: %v", err)
	}
	if second.AuthorizationRequired.Handle == first.AuthorizationRequired.Handle {
		t.Fatalf("expired transaction was reused: %+v", second)
	}
}

func TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession(t *testing.T) {
	t.Parallel()

	var opened session.SessionID
	runtime, err := NewRuntime([]Route{{
		BackendID: "calendar-private-route",
		Tool:      tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(_ context.Context, id session.SessionID, _ Route, _ json.RawMessage) (session.ToolResult, error) {
		opened = id
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer func() { _ = runtime.Close() }()

	const reservedID = session.SessionID("canonical-session-id")
	tools, err := runtime.OpenSession(reservedID)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()

	_, err = tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__calendar__list_events", []byte(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if opened != reservedID {
		t.Fatalf("broker opened session %q, want reserved canonical id %q", opened, reservedID)
	}
}

func TestInvariant_vmcp_broker_route_is_not_model_input(t *testing.T) {
	t.Parallel()

	const (
		backendID = "github-private-backend-id"
		bearer    = "Bearer broker-secret"
		locator   = "toolhive://private-locator"
		oauth     = "oauth-state-private"
	)
	var receivedArgs json.RawMessage
	runtime, err := NewRuntime([]Route{{
		BackendID: backendID,
		Tool: tool.ToolSpec{
			Name:        "mcp__github__list_issues",
			Description: "List repository issues.",
			Schema:      json.RawMessage(`{"type":"object","properties":{"repo":{"type":"string"}}}`),
		},
	}}, func(_ context.Context, _ session.SessionID, _ Route, args json.RawMessage) (session.ToolResult, error) {
		receivedArgs = append(receivedArgs[:0], args...)
		return session.NewToolResult("call", "ordinary result"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer func() { _ = runtime.Close() }()

	tools, err := runtime.OpenSession("session-1")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()

	wrapped := tools.Tools()[0]
	call := session.NewToolCall("call", wrapped.Spec().Name, []byte(`{"repo":"stacklok/mecatl"}`))
	result, err := wrapped.Execute(context.Background(), call, tool.Environment{})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if string(receivedArgs) != string(call.Args) {
		t.Fatalf("backend arguments = %s, want only declared call arguments %s", receivedArgs, call.Args)
	}

	modelFacing := string(wrapped.Spec().Schema) + wrapped.Spec().Description + result.Content
	for _, forbidden := range []string{backendID, bearer, locator, oauth} {
		if strings.Contains(modelFacing, forbidden) {
			t.Errorf("model-facing wrapper data exposes %q: %q", forbidden, modelFacing)
		}
	}
}
