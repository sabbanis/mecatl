package vmcpbroker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

type brokerEchoArgs struct {
	Text string `json:"text"`
}

func newAuthNoneBroker(t *testing.T, calls *atomic.Int32) string {
	t.Helper()

	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "auth-none-upstream", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "mcp__calendar__echo", Description: "Echo text."}, func(_ context.Context, _ *mcpsdk.CallToolRequest, in brokerEchoArgs) (*mcpsdk.CallToolResult, any, error) {
		calls.Add(1)
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "upstream:" + in.Text}}}, nil, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, nil)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/mcp" {
			http.NotFound(w, r)
			return
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	return server.URL + "/mcp"
}

func authNoneRoute() Route {
	return Route{
		BackendID: "calendar",
		Tool: tool.ToolSpec{
			Name:        "mcp__calendar__echo",
			Description: "Echo text.",
			Schema:      json.RawMessage(`{"type":"object","properties":{"text":{"type":"string"}}}`),
		},
	}
}

func TestSessionVMCPBroker_Scenario1_AuthNoneEngineRoundTrip(t *testing.T) {
	var calls atomic.Int32
	runtime, err := NewStreamingHTTPRuntime([]Route{authNoneRoute()}, newAuthNoneBroker(t, &calls))
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	sessionTools, err := runtime.OpenSession("broker-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = sessionTools.Close() })
	catalog := tool.NewCatalog()
	for _, wrapped := range sessionTools.Tools() {
		if err := catalog.Register(wrapped); err != nil {
			t.Fatalf("register broker tool: %v", err)
		}
	}

	llm := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall("call-1", "mcp__calendar__echo", json.RawMessage(`{"text":"hello"}`))),
		mockllm.TextTurn("done"),
	)
	eng := agent.NewEngine(agent.Deps{
		LLM:     llm,
		Catalog: catalog,
		Model:   "test",
		Policy: permpolicy.NewPolicy([]governance.Rule{{
			Scope:  governance.ScopeBuiltinDefault,
			Effect: governance.Allow,
		}}, nil),
	})
	sess := session.New("broker-session", session.ModeDefault, "/workspace", session.Limits{}, time.Time{})
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/workspace"}, memfs.NewWorkspace("/workspace"), nil)
	run := eng.Run(context.Background(), sess, env, agent.RunRequest{Text: "call the calendar"})
	for range run.Events() {
	}

	if calls.Load() != 1 {
		t.Fatalf("upstream calls = %d, want 1 through broker /mcp", calls.Load())
	}
	if got := brokerToolResult(t, sess).Content; got != "upstream:hello" {
		t.Fatalf("broker tool result = %q, want ordinary upstream result", got)
	}
}

func TestSessionVMCPBroker_Scenario1_SessionToolIsolation(t *testing.T) {
	var calls atomic.Int32
	runtime, err := NewStreamingHTTPRuntime([]Route{authNoneRoute()}, newAuthNoneBroker(t, &calls))
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	first, err := runtime.OpenSession("first")
	if err != nil {
		t.Fatalf("OpenSession(first): %v", err)
	}
	second, err := runtime.OpenSession("second")
	if err != nil {
		t.Fatalf("OpenSession(second): %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("first.Close: %v", err)
	}

	result, err := second.Tools()[0].Execute(context.Background(), session.NewToolCall("call-2", "mcp__calendar__echo", json.RawMessage(`{"text":"second"}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("second session Execute after first close: %v", err)
	}
	if result.IsError || result.Content != "upstream:second" {
		t.Fatalf("second session result = %+v, want ordinary upstream result", result)
	}
	if calls.Load() != 1 {
		t.Fatalf("upstream calls after first close = %d, want 1", calls.Load())
	}

	third, err := runtime.OpenSession("third")
	if err != nil {
		t.Fatalf("OpenSession after closing another session: %v", err)
	}
	t.Cleanup(func() { _ = third.Close() })
	t.Cleanup(func() { _ = second.Close() })
}

func TestSessionVMCPBroker_Scenario2_UnconnectedProtectedToolIsBounded(t *testing.T) {
	var calls atomic.Int32
	anonymous := authNoneRoute()
	protected := Route{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)}}
	runtime, err := NewStreamingHTTPRuntime([]Route{anonymous, protected}, newAuthNoneBroker(t, &calls))
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	sessionTools, err := runtime.OpenSession("unconnected")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = sessionTools.Close() })
	tools := toolsBySpecName(sessionTools.Tools())
	catalog := tool.NewCatalog()
	for _, wrapped := range sessionTools.Tools() {
		if err := catalog.Register(wrapped); err != nil {
			t.Fatalf("register broker tool: %v", err)
		}
	}
	llm := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall("protected", "mcp__github__list_issues", json.RawMessage(`{}`))),
		mockllm.TextTurn("continued after tool error"),
	)
	eng := agent.NewEngine(agent.Deps{
		LLM:     llm,
		Catalog: catalog,
		Model:   "test",
		Policy: permpolicy.NewPolicy([]governance.Rule{{
			Scope:  governance.ScopeBuiltinDefault,
			Effect: governance.Allow,
		}}, nil),
	})
	sess := session.New("unconnected", session.ModeDefault, "/workspace", session.Limits{}, time.Time{})
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/workspace"}, memfs.NewWorkspace("/workspace"), nil)
	for range eng.Run(context.Background(), sess, env, agent.RunRequest{Text: "call protected tool"}).Events() {
	}
	protectedResult := brokerToolResult(t, sess)
	if !protectedResult.IsError || !strings.Contains(protectedResult.Content, "attached interactive main client") || len(protectedResult.Content) > 200 {
		t.Fatalf("protected result = %+v, want bounded authorization-required tool error", protectedResult)
	}
	if sess.State != session.StateCompleted || llm.Calls() != 2 {
		t.Fatalf("protected run state/calls = %s/%d, want completed ordinary two-turn run without parking or replay", sess.State, llm.Calls())
	}
	if calls.Load() != 0 {
		t.Fatalf("protected call reached upstream before connection: %d calls", calls.Load())
	}

	anonymousResult, err := tools["mcp__calendar__echo"].Execute(context.Background(), session.NewToolCall("anonymous", "mcp__calendar__echo", json.RawMessage(`{"text":"available"}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("anonymous Execute: %v", err)
	}
	if anonymousResult.IsError || anonymousResult.Content != "upstream:available" {
		t.Fatalf("anonymous result = %+v, want executable auth:none result", anonymousResult)
	}
	if calls.Load() != 1 {
		t.Fatalf("anonymous call count = %d, want 1", calls.Load())
	}
}

func brokerToolResult(t *testing.T, sess *session.Session) session.ToolResult {
	t.Helper()
	for _, message := range sess.Conversation.Messages {
		if message.Role == session.RoleTool && message.ToolResult != nil {
			return *message.ToolResult
		}
	}
	t.Fatal("no broker tool result recorded")
	return session.ToolResult{}
}

func toolsBySpecName(tools []tool.Tool) map[string]tool.Tool {
	out := make(map[string]tool.Tool, len(tools))
	for _, wrapped := range tools {
		out[wrapped.Spec().Name] = wrapped
	}
	return out
}
