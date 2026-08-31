package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/stacklok/toolhive/pkg/auth/upstreamtoken"
	"github.com/stacklok/toolhive/pkg/vmcp"
	"github.com/stacklok/toolhive/pkg/vmcp/aggregator"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedQueryCapabilities(t *testing.T) {
	runtime, opened := catalogueTestRuntime(t, nil, nil, "backend-a", "backend-b")
	tokens := &recordingUpstreamTokens{credentials: map[string]upstreamtoken.UpstreamCredential{
		"auth-session-a/provider-a": {AccessToken: "credential-a"},
		"auth-session-b/provider-b": {AccessToken: "credential-b"},
	}}
	queries := &recordingCapabilityQuerier{wantTokens: map[string]string{"backend-a": "credential-a", "backend-b": "credential-b"}}
	queries.beforeQuery = func(backend string) error {
		if runtime.ProtectedCatalogueReady("session") || len(opened.Tools()) != 0 {
			return errors.New("protected catalogue admitted before every provider-scoped query succeeded")
		}
		return nil
	}
	process := discoveryTestProcess(tokens, queries)
	// Runtime retains only Process.QueryAuthenticatedCapabilities. Its capability
	// dependency is the provider-scoped interface; this concrete proof double has
	// no QueryAllCapabilities method available for the implementation to invoke.
	if _, available := reflect.TypeOf(queries).MethodByName("QueryAllCapabilities"); available {
		t.Fatal("provider-scoped capability seam unexpectedly exposes QueryAllCapabilities")
	}
	runtime.configureAuthenticatedDiscovery(process.QueryAuthenticatedCapabilities, nil)

	grantCatalogueBackend(runtime, "session", "backend-a", "auth-session-a")
	if _, err := runtime.ConnectWorkspaceServices(t.Context(), "session"); err == nil {
		t.Fatal("partial bundle connection started discovery")
	}
	if len(tokens.calls) != 0 || len(queries.backends) != 0 || runtime.ProtectedCatalogueReady("session") || len(opened.Tools()) != 0 {
		t.Fatalf("partial bundle reached discovery/admission: token calls %v, queries %v, ready %t, tools %v", tokens.calls, queries.backends, runtime.ProtectedCatalogueReady("session"), namesOfCatalogue(opened.Tools()))
	}

	grantCatalogueBackend(runtime, "session", "backend-a", "auth-session-a")
	grantCatalogueBackend(runtime, "session", "backend-b", "auth-session-b")
	result, err := runtime.ConnectWorkspaceServices(t.Context(), "session")
	if err != nil {
		t.Fatalf("ConnectWorkspaceServices: %v", err)
	}
	if result.Status != ConnectionConnected || !runtime.ProtectedCatalogueReady("session") {
		t.Fatalf("connected result/ready = %+v/%t", result, runtime.ProtectedCatalogueReady("session"))
	}
	if got, want := tokens.calls, []string{"auth-session-a/provider-a", "auth-session-b/provider-b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("provider-scoped credential lookups = %v, want %v", got, want)
	}
	if got, want := queries.backends, []string{"backend-a", "backend-b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("provider-scoped QueryCapabilities calls = %v, want %v", got, want)
	}
	tools := opened.Tools()
	if got, want := namesOfCatalogue(tools), []string{"mcp__backend-a__status", "mcp__backend-b__status"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("frozen catalogue = %v, want %v", got, want)
	}
	resultCall, err := tools[0].Execute(t.Context(), session.NewToolCall("call", tools[0].Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
	if err != nil || resultCall.IsError || resultCall.Content != "ok" {
		t.Fatalf("authenticated frozen route execution = %+v, %v", resultCall, err)
	}

	if _, err := runtime.ConnectWorkspaceServices(t.Context(), "session"); err != nil {
		t.Fatalf("repeat ConnectWorkspaceServices: %v", err)
	}
	if got, want := queries.backends, []string{"backend-a", "backend-b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("frozen catalogue refreshed within session: %v", got)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_DiscoveryFailsClosed(t *testing.T) {
	tests := map[string]func(string) (*AuthenticatedCapabilities, error){
		"backend failure": func(backend string) (*AuthenticatedCapabilities, error) {
			if backend == "backend-b" {
				return nil, errors.New("provider failed")
			}
			return validAuthenticatedCandidate(backend, "status"), nil
		},
		"duplicate": func(backend string) (*AuthenticatedCapabilities, error) {
			candidate := validAuthenticatedCandidate(backend, "status")
			candidate.Tools = append(candidate.Tools, candidate.Tools[0])
			return candidate, nil
		},
		"malformed name": func(backend string) (*AuthenticatedCapabilities, error) {
			candidate := validAuthenticatedCandidate(backend, "bad name")
			return candidate, nil
		},
		"malformed schema": func(backend string) (*AuthenticatedCapabilities, error) {
			candidate := validAuthenticatedCandidate(backend, "status")
			candidate.Tools[0].Schema = json.RawMessage(`{"type":`)
			return candidate, nil
		},
		"malformed description": func(backend string) (*AuthenticatedCapabilities, error) {
			candidate := validAuthenticatedCandidate(backend, "status")
			candidate.Tools[0].Description = string([]byte{0xff})
			return candidate, nil
		},
	}
	for name, query := range tests {
		t.Run(name, func(t *testing.T) {
			runtime, opened := catalogueTestRuntime(t, nil, nil, "backend-a", "backend-b")
			runtime.configureAuthenticatedDiscovery(func(_ context.Context, _ ToolHiveAuthSessionID, backend string) (AuthenticatedCapabilities, error) {
				result, err := query(backend)
				if err != nil {
					return AuthenticatedCapabilities{}, err
				}
				return *result, nil
			}, nil)
			grantCatalogueBundle(runtime, "session", "auth-session", "backend-a", "backend-b")

			if _, err := runtime.ConnectWorkspaceServices(t.Context(), "session"); err == nil {
				t.Fatal("ConnectWorkspaceServices succeeded, want complete rejection")
			}
			assertNoProtectedAdmission(t, runtime, opened, "backend-a", "backend-b")
		})
	}

	t.Run("anonymous collision", func(t *testing.T) {
		anonymous := Route{BackendID: "public", Tool: tool.ToolSpec{Name: "mcp__backend-a__status", Schema: json.RawMessage(`{"type":"object"}`)}}
		runtime, opened := catalogueTestRuntime(t, []Route{anonymous}, nil, "backend-a")
		runtime.configureAuthenticatedDiscovery(func(context.Context, ToolHiveAuthSessionID, string) (AuthenticatedCapabilities, error) {
			return *validAuthenticatedCandidate("backend-a", "status"), nil
		}, nil)
		grantCatalogueBundle(runtime, "session", "auth-session", "backend-a")
		if _, err := runtime.ConnectWorkspaceServices(t.Context(), "session"); err == nil {
			t.Fatal("anonymous collision admitted")
		}
		if got := namesOfCatalogue(opened.Tools()); !reflect.DeepEqual(got, []string{"mcp__backend-a__status"}) {
			t.Fatalf("anonymous catalogue changed = %v", got)
		}
		if runtime.ProtectedCatalogueReady("session") {
			t.Fatal("collision marked protected catalogue ready")
		}
	})
}

func TestBundledWorkspaceEnrollment_Scenario11_RestartRequiresEnrollment(t *testing.T) {
	query := func(context.Context, ToolHiveAuthSessionID, string) (AuthenticatedCapabilities, error) {
		return *validAuthenticatedCandidate("backend-a", "status"), nil
	}
	original, opened := catalogueTestRuntime(t, nil, nil, "backend-a")
	original.configureAuthenticatedDiscovery(query, nil)
	grantCatalogueBundle(original, "session", "auth-session", "backend-a")
	if _, err := original.ConnectWorkspaceServices(t.Context(), "session"); err != nil {
		t.Fatalf("original enrollment: %v", err)
	}
	if !original.ProtectedCatalogueReady("session") || len(opened.Tools()) != 1 {
		t.Fatal("original catalogue was not admitted")
	}

	restarted, reopened := catalogueTestRuntime(t, nil, nil, "backend-a")
	restarted.configureAuthenticatedDiscovery(query, nil)
	if restarted.ProtectedCatalogueReady("session") || len(reopened.Tools()) != 0 {
		t.Fatal("restart replayed a grant, catalogue, or executable route")
	}
	pending, err := restarted.ConnectWorkspaceServices(t.Context(), "session")
	if err != nil || pending.Status != ConnectionPending {
		t.Fatalf("fresh enrollment after restart = %+v, %v", pending, err)
	}
	if restarted.ProtectedCatalogueReady("session") || len(reopened.Tools()) != 0 {
		t.Fatal("pending reenrollment exposed protected tools")
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_NoPartialStaticCatalogue(t *testing.T) {
	static := []Route{{BackendID: "backend-a", Protected: true, ReadOnly: true, Tool: tool.ToolSpec{
		Name: "mcp__backend-a__reviewed", Description: "reviewed", Schema: json.RawMessage(`{"type":"object"}`),
	}}}
	runtime, opened := catalogueTestRuntime(t, nil, static, "backend-a", "backend-b")
	runtime.configureAuthenticatedDiscovery(func(_ context.Context, _ ToolHiveAuthSessionID, backend string) (AuthenticatedCapabilities, error) {
		return *validAuthenticatedCandidate(backend, "discovered"), nil
	}, static)
	if got := opened.Tools(); len(got) != 0 {
		t.Fatalf("static pre-consent catalogue = %v, want empty", namesOfCatalogue(got))
	}

	grantCatalogueBundle(runtime, "session", "auth-session", "backend-a")
	if runtime.ProtectedCatalogueReady("session") || len(opened.Tools()) != 0 {
		t.Fatal("partial bundle exposed reviewed static tools")
	}
	grantCatalogueBundle(runtime, "session", "auth-session", "backend-b")
	if _, err := runtime.ConnectWorkspaceServices(t.Context(), "session"); err != nil {
		t.Fatalf("complete enrollment: %v", err)
	}
	if got, want := namesOfCatalogue(opened.Tools()), []string{"mcp__backend-a__reviewed", "mcp__backend-b__discovered"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("admitted static/discovered catalogue = %v, want %v", got, want)
	}
}

func catalogueTestRuntime(t *testing.T, routes, static []Route, backends ...string) (*Runtime, *SessionTools) {
	t.Helper()
	runtime, err := NewRuntime(routes, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	runtime.protectedBackends = append([]string(nil), backends...)
	runtime.oauthBackend = backends[0]
	runtime.authorizeEndpoint = "https://broker.example/authorize"
	runtime.callbackURL = "https://client.example/callback"
	runtime.clientID = "client"
	runtime.resource = "https://broker.example"
	runtime.transactionTTL = 1
	opened, err := runtime.OpenSession("session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close(); _ = runtime.Close() })
	return runtime, opened
}

func grantCatalogueBundle(runtime *Runtime, id session.SessionID, authSession ToolHiveAuthSessionID, backends ...string) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	for _, backend := range backends {
		runtime.grants[controlTarget{sessionID: id, backendID: backend}] = downstreamGrant{accessToken: "broker-token", authSession: authSession}
	}
}

func grantCatalogueBackend(runtime *Runtime, id session.SessionID, backend string, authSession ToolHiveAuthSessionID) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	runtime.grants[controlTarget{sessionID: id, backendID: backend}] = downstreamGrant{accessToken: "broker-token", authSession: authSession}
}

func validAuthenticatedCandidate(backend, name string) *AuthenticatedCapabilities {
	return &AuthenticatedCapabilities{BackendID: backend, Tools: []ToolDefinition{{
		BackendID: backend, Name: "mcp__" + backend + "__" + name, Description: "safe description",
		Schema: json.RawMessage(`{"type":"object"}`), ReadOnly: true,
	}}}
}

func assertNoProtectedAdmission(t *testing.T, runtime *Runtime, opened *SessionTools, backends ...string) {
	t.Helper()
	if runtime.ProtectedCatalogueReady("session") {
		t.Fatal("failed discovery marked catalogue ready")
	}
	if got := opened.Tools(); len(got) != 0 {
		t.Fatalf("failed discovery exposed tools %v", namesOfCatalogue(got))
	}
	for _, backend := range backends {
		if _, ok := runtime.grant("session", backend); ok {
			t.Fatalf("failed discovery retained executable grant for %q", backend)
		}
	}
}

func namesOfCatalogue(tools []tool.Tool) []string {
	names := make([]string, len(tools))
	for i, wrapped := range tools {
		names[i] = wrapped.Spec().Name
	}
	return names
}

// Compile-time proof that Task 11 consumes only the provider-scoped capability
// shape retained by Task 10a; no QueryAllCapabilities method is available here.
var _ capabilityQuerier = (*singleCapabilityQuerier)(nil)

type singleCapabilityQuerier struct{}

func (*singleCapabilityQuerier) QueryCapabilities(context.Context, vmcp.Backend) (*aggregator.BackendCapabilities, error) {
	return nil, nil
}
