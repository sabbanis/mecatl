package vmcpbroker

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stacklok/toolhive/pkg/auth/upstreamtoken"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// These tests pin the fix wired into cleanupProviderTokens/revokeGrantsForProviders:
// a terminal ToolHive upstream-token failure for an auth session must revoke
// every Runtime.grants entry for that auth session (the bundle), not merely
// clean up ToolHive's own token storage. Without it RequestAuthorization kept
// reporting "connected" after a real credential death and the mid-turn park
// never fired.

func newGrantRevocationRuntime(t *testing.T) *Runtime {
	t.Helper()
	runtime, err := NewRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	return runtime
}

func TestGrantRevocation_BulkFailureRevokesOnlyMatchingAuthSession(t *testing.T) {
	runtime := newGrantRevocationRuntime(t)
	runtime.mu.Lock()
	runtime.grants[controlTarget{sessionID: "session-a", backendID: "github"}] = downstreamGrant{accessToken: "a", authSession: "auth-a"}
	runtime.grants[controlTarget{sessionID: "session-b", backendID: "github"}] = downstreamGrant{accessToken: "b", authSession: "auth-b"}
	runtime.mu.Unlock()

	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{failed: []string{"provider-a"}}, cleanup: runtime.cleanupProviderTokens}
	if _, _, err := wrapped.GetAllUpstreamCredentials(t.Context(), "auth-a"); err != nil {
		t.Fatalf("GetAllUpstreamCredentials: %v", err)
	}
	if _, ok := runtime.grant("session-a", "github"); ok {
		t.Fatal("bulk-failed auth session's grant survived revocation")
	}
	if _, ok := runtime.grant("session-b", "github"); !ok {
		t.Fatal("unrelated auth session's grant was revoked")
	}
}

func TestGrantRevocation_ValidTokensRefreshFailureRevokesGrant(t *testing.T) {
	runtime := newGrantRevocationRuntime(t)
	runtime.mu.Lock()
	runtime.grants[controlTarget{sessionID: "session-a", backendID: "github"}] = downstreamGrant{accessToken: "a", authSession: "auth-a"}
	runtime.mu.Unlock()

	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{err: upstreamtoken.ErrRefreshFailed}, cleanup: runtime.cleanupProviderTokens}
	if _, err := wrapped.GetValidTokens(t.Context(), "auth-a", "provider-a"); err == nil {
		t.Fatal("GetValidTokens unexpectedly succeeded")
	}
	if _, ok := runtime.grant("session-a", "github"); ok {
		t.Fatal("terminal GetValidTokens failure did not revoke the grant")
	}
}

func TestGrantRevocation_NoFailedProvidersLeavesGrantIntact(t *testing.T) {
	runtime := newGrantRevocationRuntime(t)
	runtime.mu.Lock()
	runtime.grants[controlTarget{sessionID: "session-a", backendID: "github"}] = downstreamGrant{accessToken: "a", authSession: "auth-a"}
	runtime.mu.Unlock()

	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{credentials: map[string]upstreamtoken.UpstreamCredential{"provider-a": {AccessToken: "a"}}}, cleanup: runtime.cleanupProviderTokens}
	if _, _, err := wrapped.GetAllUpstreamCredentials(t.Context(), "auth-a"); err != nil {
		t.Fatalf("GetAllUpstreamCredentials: %v", err)
	}
	if _, ok := runtime.grant("session-a", "github"); !ok {
		t.Fatal("grant revoked despite no failed providers")
	}
}

func TestGrantRevocation_TransientErrorDoesNotRevoke(t *testing.T) {
	runtime := newGrantRevocationRuntime(t)
	runtime.mu.Lock()
	runtime.grants[controlTarget{sessionID: "session-a", backendID: "github"}] = downstreamGrant{accessToken: "a", authSession: "auth-a"}
	runtime.mu.Unlock()

	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{err: context.Canceled}, cleanup: runtime.cleanupProviderTokens}
	if _, err := wrapped.GetValidTokens(t.Context(), "auth-a", "provider-a"); err == nil {
		t.Fatal("expected the transient error to propagate")
	}
	if _, ok := runtime.grant("session-a", "github"); !ok {
		t.Fatal("a transient (non-refresh-failure) error revoked the grant")
	}
}

func TestGrantRevocation_RaceWithInFlightRefresh(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const refreshBearer = "downstream-refresh-canary"

	started := make(chan struct{})
	release := make(chan struct{})
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"replacement","refresh_token":"replacement-refresh"}`)
	}))
	t.Cleanup(tokenServer.Close)

	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, "http://127.0.0.1:1/mcp")
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	runtime.tokenEndpoint = tokenServer.URL
	runtime.httpClient = tokenServer.Client()
	if _, err := runtime.OpenSession("session-a"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	target := controlTarget{sessionID: "session-a", backendID: "github"}
	grant := downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer, authSession: "auth-a"}
	runtime.grants[target] = grant

	refreshDone := make(chan error, 1)
	go func() {
		_, err := runtime.refreshDownstreamGrant(context.Background(), target, grant)
		refreshDone <- err
	}()
	<-started
	runtime.revokeGrantsForProviders("auth-a")
	close(release)
	if err := <-refreshDone; err == nil {
		t.Fatal("refresh succeeded despite a concurrent revocation, want ErrInvalidControlTarget")
	}
	if _, ok := runtime.grant("session-a", "github"); ok {
		t.Fatal("a concurrent in-flight refresh resurrected the revoked grant")
	}
}

func TestStreamingCallerCall_RevokedGrantResetsCachedConnectionAndErrors(t *testing.T) {
	const goodBearer = "good-downstream-bearer"

	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "github_list"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+goodBearer {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(backend.Close)

	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, backend.URL)
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	tools, err := runtime.OpenSession("session-a")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })
	target := controlTarget{sessionID: "session-a", backendID: "github"}
	runtime.grants[target] = downstreamGrant{accessToken: goodBearer, authSession: "auth-a"}

	c := &streamingCaller{runtime: runtime, sessionID: "session-a", endpoint: backend.URL}
	t.Cleanup(func() { _ = c.close() })
	route := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}

	result, err := c.call(context.Background(), "session-a", route, json.RawMessage(`{}`))
	if err != nil || result.IsError || !strings.Contains(result.Content, "protected result") {
		t.Fatalf("initial protected call = %#v, %v", result, err)
	}
	if c.protected == nil {
		t.Fatal("successful protected call did not cache a connection")
	}
	firstConnection := c.protected
	t.Cleanup(func() { _ = firstConnection.Close() })

	runtime.revokeGrantsForProviders("auth-a")

	result, err = c.call(context.Background(), "session-a", route, json.RawMessage(`{}`))
	if err != nil || !result.IsError || !strings.Contains(result.Content, "broker authorization expired") {
		t.Fatalf("call after revocation = %#v, %v, want the re-authorize error", result, err)
	}
	if c.protected != nil {
		t.Fatal("revoked grant left a stale cached connection in place")
	}
}
