package app

import (
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/mcpauthority"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestSessionMCPAuthorization_Scenario1_AppAuthorityBoundaries(t *testing.T) {
	globalLifecycle := new(countingMCPProfileCloser)
	global := mcpauthority.NewGlobal([]mcp.ServerConfig{{Name: "global", URL: "https://global.example/mcp"}}, globalLifecycle)
	for _, cfg := range []*Config{{VMCPBroker: &vmcpbroker.Runtime{}}, {}} {
		lifecycle := interface{ Close() error }(nil)
		err := applyMCPAuthority(cfg, global, &lifecycle)
		if cfg.VMCPBroker != nil {
			if err == nil {
				t.Fatal("global authority accepted injected broker runtime")
			}
			continue
		}
		if err != nil || cfg.MCPAuthority != global || len(cfg.MCPServers) != 1 || lifecycle != globalLifecycle {
			t.Fatalf("global authority application = %#v, %v", cfg, err)
		}
		closeMCPProfileLifecycle(t.Context(), *cfg)
		if globalLifecycle.calls.Load() != 1 {
			t.Fatalf("global lifecycle calls = %d", globalLifecycle.calls.Load())
		}
	}

	broker := mcpauthority.NewBroker(mcpauthority.BrokerConfig{CallbackURL: "https://agent.example/callback", Profiles: []permconfig.MCPServerProfile{{Name: "broker"}}})
	for _, cfg := range []*Config{{MCPServers: []mcp.ServerConfig{{Name: "global"}}}, {VMCPBroker: &vmcpbroker.Runtime{}}, {ToolHiveEnabled: true}, {}} {
		lifecycle := interface{ Close() error }(nil)
		err := applyMCPAuthority(cfg, broker, &lifecycle)
		if len(cfg.MCPServers) != 0 || cfg.VMCPBroker != nil || cfg.ToolHiveEnabled {
			if err == nil {
				t.Fatalf("broker authority accepted conflicting global source: %#v", cfg)
			}
			continue
		}
		if err != nil || !cfg.mcpBrokerAuthority || cfg.MCPAuthority != broker || mcpSourceProber(*cfg) != nil {
			t.Fatalf("broker authority application = %#v, %v", cfg, err)
		}
		retained, ok := cfg.MCPAuthority.Broker()
		if !ok || retained.CallbackURL != "https://agent.example/callback" || len(retained.Profiles) != 1 {
			t.Fatalf("retained broker authority = %#v", retained)
		}
	}
}
