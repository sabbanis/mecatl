package app_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcpauthority"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
	"github.com/stacklok/mecatl/internal/app"
)

type brokerCloseOrderingProbe struct {
	runtime      *vmcpbroker.Runtime
	called       bool
	brokerClosed bool
}

func (p *brokerCloseOrderingProbe) Close() error {
	p.called = true
	_, err := p.runtime.OpenSession("profile-close-probe")
	p.brokerClosed = errors.Is(err, vmcpbroker.ErrClosed)
	return nil
}

func TestSessionMCPAuthorization_Scenario2_BuildClosesBrokerBeforeProfiles(t *testing.T) {
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
	built, err := app.Build(t.Context(), app.Config{
		UseMock: true, MCPAuthority: authority, MCPProfileLifecycle: probe,
		VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			return vmcpbroker.NewProcess(runtime)
		},
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	built.Close()
	if !probe.called || !probe.brokerClosed {
		t.Fatalf("profile close called/broker closed = %t/%t, want true/true", probe.called, probe.brokerClosed)
	}
}
