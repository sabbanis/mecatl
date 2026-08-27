package vmcpbroker

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestInvariant_broker_tools_preserve_read_only_semantics(t *testing.T) {
	runtime, err := NewRuntime([]Route{
		{BackendID: "readonly", Protected: true, ReadOnly: true, Tool: tool.ToolSpec{Name: "mcp__readonly__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "mutating", Protected: true, ReadOnly: false, Tool: tool.ToolSpec{Name: "mcp__mutating__write", Schema: json.RawMessage(`{"type":"object"}`)}},
	}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	opened, err := runtime.OpenSession("semantics")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })

	got := map[string]bool{}
	for _, wrapped := range opened.Tools() {
		if _, ok := wrapped.(tool.AuthorizationRequester); !ok {
			t.Fatalf("broker wrapper %q does not expose authorization request seam", wrapped.Spec().Name)
		}
		got[wrapped.Spec().Name] = wrapped.ReadOnly()
	}
	if !got["mcp__readonly__list"] {
		t.Error("read-only broker wrapper reported mutating")
	}
	if got["mcp__mutating__write"] {
		t.Error("mutating broker wrapper reported read-only")
	}
}
