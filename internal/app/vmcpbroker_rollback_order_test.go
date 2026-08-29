package app_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcpauthority"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
	"github.com/stacklok/mecatl/internal/app"
)

func TestSessionMCPAuthorization_Scenario2_BuildRollbackClosesBrokerBeforeProfiles(t *testing.T) {
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{}`)},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	probe := &brokerCloseOrderingProbe{runtime: runtime}
	authority := mcpauthority.NewBroker(mcpauthority.BrokerConfig{Profiles: []permconfig.MCPServerProfile{{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}}}})
	_, err = app.Build(t.Context(), app.Config{
		UseMock: true, MCPAuthority: authority, MCPProfileLifecycle: probe,
		VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			return &vmcpbroker.Process{Runtime: runtime}, nil
		},
	})
	if err == nil {
		t.Fatal("Build succeeded with an incomplete process")
	}
	if !probe.called || !probe.brokerClosed {
		t.Fatalf("rollback profile close called/broker closed = %t/%t, want true/true", probe.called, probe.brokerClosed)
	}
}
