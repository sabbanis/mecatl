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

func TestSessionMCPAuthorization_Scenario2_RollbackAndCloseOrdering(t *testing.T) {
	newRuntime := func(t *testing.T) *vmcpbroker.Runtime {
		t.Helper()
		runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
			BackendID: "calendar",
			Tool:      tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)},
		}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
			return session.ToolResult{}, nil
		})
		if err != nil {
			t.Fatalf("NewRuntime: %v", err)
		}
		return runtime
	}
	authority := mcpauthority.NewBroker(mcpauthority.BrokerConfig{Profiles: []permconfig.MCPServerProfile{{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}}}})

	t.Run("rollback closes constructed runtime", func(t *testing.T) {
		runtime := newRuntime(t)
		_, err := app.Build(context.Background(), app.Config{
			UseMock: true, MCPAuthority: authority,
			VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
				return &vmcpbroker.Process{Runtime: runtime}, nil // incomplete handler bundle
			},
		})
		if err == nil {
			t.Fatal("Build succeeded")
		}
		if _, err := runtime.OpenSession("after-rollback"); !errors.Is(err, vmcpbroker.ErrClosed) {
			t.Fatalf("runtime after rollback = %v, want ErrClosed", err)
		}
	})

	t.Run("normal close releases runtime after service", func(t *testing.T) {
		runtime := newRuntime(t)
		process, err := vmcpbroker.NewProcess(runtime)
		if err != nil {
			t.Fatalf("NewProcess: %v", err)
		}
		built, err := app.Build(context.Background(), app.Config{
			UseMock: true, MCPAuthority: authority,
			VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
				return process, nil
			},
		})
		if err != nil {
			t.Fatalf("Build: %v", err)
		}
		tools, err := runtime.OpenSession("close-order")
		if err != nil {
			t.Fatalf("OpenSession: %v", err)
		}
		built.Close()
		if _, err := runtime.OpenSession("after-close"); !errors.Is(err, vmcpbroker.ErrClosed) {
			t.Fatalf("runtime after Built.Close = %v, want ErrClosed", err)
		}
		if err := tools.Close(); err != nil {
			t.Fatalf("session tools Close: %v", err)
		}
	})
}
