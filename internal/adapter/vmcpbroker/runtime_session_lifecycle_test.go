package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestInvariant_broker_runtime_never_resurrects_session(t *testing.T) {
	runtime := lifecycleRuntime(t)
	defer func() { _ = runtime.Close() }()

	owner, err := runtime.OpenSession("session-1")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	if _, err := runtime.OpenSession("session-1"); !errors.Is(err, ErrInvalidRoute) {
		t.Fatalf("second OpenSession while owner is live = %v, want ErrInvalidRoute", err)
	}
	if _, err := owner.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__calendar__list", []byte(`{}`)), tool.Environment{}); err != nil {
		t.Fatalf("live owner's wrapper was tombstoned: %v", err)
	}
	if err := owner.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if _, err := runtime.OpenSession("session-1"); err == nil {
		t.Fatal("OpenSession after final close succeeded; sessions must not be resurrected")
	}
}

func TestSessionMCPAuthorization_Scenario3_SessionIsolation(t *testing.T) {
	runtime := lifecycleRuntime(t)
	defer func() { _ = runtime.Close() }()

	first, err := runtime.OpenSession("session-1")
	if err != nil {
		t.Fatalf("OpenSession(first): %v", err)
	}
	second, err := runtime.OpenSession("session-2")
	if err != nil {
		t.Fatalf("OpenSession(second): %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("Close(first): %v", err)
	}
	if _, err := second.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__calendar__list", []byte(`{}`)), tool.Environment{}); err != nil {
		t.Fatalf("second session wrapper after first close: %v", err)
	}
	if _, err := runtime.OpenSession("session-3"); err != nil {
		t.Fatalf("OpenSession after closing another session: %v", err)
	}
}

func lifecycleRuntime(t *testing.T) *Runtime {
	t.Helper()
	runtime, err := NewRuntime([]Route{{
		BackendID: "calendar",
		Tool:      tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	return runtime
}
