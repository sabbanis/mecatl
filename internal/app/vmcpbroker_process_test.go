package app_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcpauthority"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

func TestSessionMCPAuthorization_Scenario2_SettingsConstructBroker(t *testing.T) {
	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte(`mcp:
  mode: broker
  servers:
    - name: calendar
      url: https://calendar.example/mcp
      auth: {mode: none}
`), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	var constructed bool
	built, err := app.Build(context.Background(), app.Config{
		Workspace:           t.TempDir(),
		UseMock:             true,
		PermissionConfigs:   []string{settings},
		MCPAuthorityLoader:  cliconfig.NewMCPProfileResolver(nil, func(string) (string, bool) { return "", false }),
		MCPAuthorityDefault: string(cliconfig.MCPAuthorityGlobal),
		MCPBrokerSupported:  true,
		VMCPBrokerConstructor: func(_ context.Context, declarations app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			constructed = true
			if declarations.CallbackURL != "" || len(declarations.Profiles) != 1 || declarations.Profiles[0].Name != "calendar" {
				t.Fatalf("broker declarations = %#v", declarations)
			}
			runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
				BackendID: "calendar",
				Tool:      tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
			}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
				return session.ToolResult{}, nil
			})
			if err != nil {
				return nil, err
			}
			return vmcpbroker.NewProcess(runtime)
		},
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(built.Close)
	if !constructed || built.VMCPBroker == nil || built.VMCPBrokerHandlers.Callback == nil {
		t.Fatalf("broker construction = constructed:%t built:%#v", constructed, built)
	}
}

func TestVMCPBrokerConstructorErrorAbortsBuild(t *testing.T) {
	want := errors.New("discovery failed before authorization")
	authority := mcpauthority.NewBroker(mcpauthority.BrokerConfig{
		Profiles: []permconfig.MCPServerProfile{{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}}},
	})
	_, err := app.Build(context.Background(), app.Config{
		UseMock:      true,
		MCPAuthority: authority,
		VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			return nil, want
		},
	})
	if !errors.Is(err, want) {
		t.Fatalf("Build error = %v, want %v", err, want)
	}
}
