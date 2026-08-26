package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestSessionVMCPBroker_Scenario3_RefreshesTransportInternally(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const freshBearer = "downstream-access-fresh-canary"
	const refreshBearer = "downstream-refresh-canary"

	var refreshes atomic.Int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil || r.Form.Get("grant_type") != "refresh_token" || r.Form.Get("refresh_token") != refreshBearer {
			http.Error(w, "bad refresh request", http.StatusBadRequest)
			return
		}
		refreshes.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"`+freshBearer+`","refresh_token":"`+refreshBearer+`"}`)
	}))
	t.Cleanup(tokenServer.Close)

	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "github_list"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "refreshed protected result"}}}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, nil)
	broker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+freshBearer {
			http.Error(w, "expired", http.StatusUnauthorized)
			return
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(broker.Close)

	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, broker.URL)
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	runtime.tokenEndpoint = tokenServer.URL
	runtime.httpClient = tokenServer.Client()
	tools, err := runtime.OpenSession("refresh-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })
	runtime.grants[controlTarget{sessionID: "refresh-session", backendID: "github"}] = downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}

	result, err := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("protected Execute: %v", err)
	}
	if result.IsError || !strings.Contains(result.Content, "refreshed protected result") {
		t.Fatalf("protected result = %+v, want refreshed protected result", result)
	}
	if refreshes.Load() != 1 {
		t.Fatalf("refresh requests = %d, want 1", refreshes.Load())
	}
}

func TestSessionVMCPBroker_Scenario3_RefreshCannotResurrectState(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const refreshBearer = "downstream-refresh-canary"

	var refreshes atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		refreshes.Add(1)
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
	runtime.tokenEndpoint = tokenServer.URL
	runtime.httpClient = tokenServer.Client()
	tools, err := runtime.OpenSession("refresh-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	runtime.grants[controlTarget{sessionID: "refresh-session", backendID: "github"}] = downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}

	caller := tools.Tools()[0]
	var wait sync.WaitGroup
	wait.Add(2)
	type callOutcome struct {
		result session.ToolResult
		err    error
	}
	results := make(chan callOutcome, 2)
	for range 2 {
		go func() {
			defer wait.Done()
			result, err := caller.Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
			results <- callOutcome{result: result, err: err}
		}()
	}
	<-started
	forgot := make(chan error, 1)
	go func() { forgot <- runtime.ForgetSession("refresh-session") }()
	deadline := time.After(time.Second)
	for {
		runtime.mu.RLock()
		_, tombstoned := runtime.tombstones["refresh-session"]
		runtime.mu.RUnlock()
		if tombstoned {
			break
		}
		select {
		case <-deadline:
			t.Fatal("ForgetSession did not tombstone the session before refresh completed")
		case <-time.After(time.Millisecond):
		}
	}
	close(release)
	if err := <-forgot; err != nil {
		t.Fatalf("ForgetSession: %v", err)
	}
	wait.Wait()
	close(results)
	for outcome := range results {
		if outcome.err == nil && !outcome.result.IsError {
			t.Fatal("call succeeded after forgotten session refresh")
		}
	}
	if refreshes.Load() != 1 {
		t.Fatalf("refresh requests = %d, want one shared refresh", refreshes.Load())
	}
	if _, ok := runtime.grant("refresh-session", "github"); ok {
		t.Fatal("late refresh restored forgotten session grant")
	}
}

func TestInvariant_vmcp_broker_secrets_do_not_escape(t *testing.T) {
	canaries := []string{"upstream-access-canary", "downstream-access-canary", "downstream-refresh-canary", "oauth-client-secret-canary", "authorization-code-canary", "pkce-verifier-canary", "callback-state-canary", "tsid-canary", "storage-key-canary", "signing-key-canary"}
	runtime, err := NewRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list", Description: "safe", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolError("call", "safe failure"), errors.New("safe failure")
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	tools, err := runtime.OpenSession("parent")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	runtime.grants[controlTarget{sessionID: "parent", backendID: "github"}] = downstreamGrant{accessToken: canaries[1], refreshToken: canaries[2]}
	result, callErr := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__github__list", json.RawMessage(`{}`)), tool.Environment{})
	projected := strings.Join([]string{tools.Tools()[0].Spec().Name, tools.Tools()[0].Spec().Description, result.Content, string(result.CallID), errorText(callErr)}, "\n")
	for _, canary := range canaries {
		if strings.Contains(projected, canary) {
			t.Fatalf("secret canary escaped model-facing projection: %q", canary)
		}
	}
}

func TestSessionVMCPBroker_Scenario3_UsesInjectedDiagnostics(t *testing.T) {
	const refreshCanary = "downstream-refresh-canary"
	diagnostics := &capturingDiagnostics{}
	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, "http://127.0.0.1:1/mcp")
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	runtime.diagnostics = diagnostics
	tools, err := runtime.OpenSession("diagnostic-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	runtime.grants[controlTarget{sessionID: "diagnostic-session", backendID: "github"}] = downstreamGrant{accessToken: "downstream-access-canary", refreshToken: refreshCanary}
	_, _ = tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
	if len(diagnostics.messages) != 1 || diagnostics.messages[0] != "broker transport bearer refresh failed" {
		t.Fatalf("diagnostics = %#v, want one bounded refresh failure", diagnostics.messages)
	}
	if strings.Contains(strings.Join(diagnostics.messages, "\n"), refreshCanary) {
		t.Fatal("refresh token escaped injected diagnostics")
	}
}

type capturingDiagnostics struct{ messages []string }

func (c *capturingDiagnostics) Log(_ context.Context, _ port.Level, message string, _ ...any) {
	c.messages = append(c.messages, message)
}

func (c *capturingDiagnostics) With(...any) port.Diagnostics { return c }

func TestSessionVMCPBroker_Scenario3_SecondOAuthBackendUnsupported(t *testing.T) {
	routes := []Route{
		{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "gitlab", Protected: true, Tool: tool.ToolSpec{Name: "mcp__gitlab__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)}},
	}
	runtime, err := NewRuntime(routes, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("", "anonymous result"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	tools, err := runtime.OpenSession("parent")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	if _, err := runtime.Connect(context.Background(), "parent", "gitlab"); !errors.Is(err, ErrUnsupportedCapability) {
		t.Fatalf("Connect second protected backend error = %v, want ErrUnsupportedCapability", err)
	}
	anonymous, err := toolsBySpecName(tools.Tools())["mcp__calendar__list"].Execute(context.Background(), session.NewToolCall("anonymous", "mcp__calendar__list", json.RawMessage(`{}`)), tool.Environment{})
	if err != nil || anonymous.IsError || anonymous.Content != "anonymous result" {
		t.Fatalf("anonymous route after rejected OAuth backend = %+v, %v", anonymous, err)
	}
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
