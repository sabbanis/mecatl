package app

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestMountBrokerMCPRegistersSessionOnlyTool(t *testing.T) {
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "calendar",
		Tool: tool.ToolSpec{
			Name:   "mcp__calendar__list_events",
			Schema: json.RawMessage(`{"type":"object"}`),
		},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	brokerSession, err := runtime.OpenSession("broker-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = brokerSession.Close() })

	catalog := tool.NewCatalog()
	mountBrokerMCP(catalog, brokerSession.Tools())
	if _, ok := catalog.Lookup("mcp__calendar__list_events"); !ok {
		t.Fatal("catalog missing session broker tool")
	}
}

func TestRejectBrokerGlobalToolCollisions(t *testing.T) {
	globalMgr := connectMainManager(t, "fake", newMCPTestServerBigJSON(t))
	t.Cleanup(func() { _ = globalMgr.Close() })

	err := rejectBrokerGlobalToolCollisions([]tool.Tool{testBrokerTool(t, "mcp__fake__bigjson")}, globalMgr)
	if err == nil || !strings.Contains(err.Error(), "mcp__fake__bigjson") {
		t.Fatalf("collision error = %v, want colliding tool name", err)
	}
}

func testBrokerTool(t *testing.T, name string) tool.Tool {
	t.Helper()
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "test",
		Tool: tool.ToolSpec{
			Name:   name,
			Schema: json.RawMessage(`{"type":"object"}`),
		},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	brokerSession, err := runtime.OpenSession("broker-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = brokerSession.Close() })
	return brokerSession.Tools()[0]
}
