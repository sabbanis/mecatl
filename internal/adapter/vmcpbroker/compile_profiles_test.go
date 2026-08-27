package vmcpbroker

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestSessionMCPAuthorization_Scenario2_CompilesDiscoveredRoutes(t *testing.T) {
	profiles := []permconfig.MCPServerProfile{
		{Name: "public", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}},
	}
	discovered := []ToolDefinition{
		{BackendID: "calendar", Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)},
		{BackendID: "public", Name: "mcp__public__status", Schema: json.RawMessage(`{"type":"object"}`), ReadOnly: true},
	}
	routes, err := CompileProfiles(profiles, discovered)
	if err != nil {
		t.Fatalf("CompileProfiles: %v", err)
	}
	if len(routes) != 2 || !routes[0].Protected || routes[0].BackendID != "calendar" || routes[1].Protected {
		t.Fatalf("routes = %#v", routes)
	}

	for name, testCase := range map[string]struct {
		profiles   []permconfig.MCPServerProfile
		discovered []ToolDefinition
		wantErr    string
	}{
		"unconfigured discovery":   {profiles: profiles, discovered: []ToolDefinition{{BackendID: "other", Name: "mcp__other__list"}}},
		"duplicate tool":           {profiles: profiles, discovered: []ToolDefinition{{BackendID: "public", Name: "same"}, {BackendID: "calendar", Name: "same"}}},
		"unsupported auth":         {profiles: []permconfig.MCPServerProfile{{Name: "x", Auth: permconfig.MCPAuthProfile{Mode: "static_bearer"}}}, discovered: discovered},
		"second protected backend": {profiles: []permconfig.MCPServerProfile{{Name: "a", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}}, {Name: "b", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}}}, discovered: []ToolDefinition{{BackendID: "a", Name: "mcp__a__list"}, {BackendID: "b", Name: "mcp__b__list"}}, wantErr: "only one protected backend"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CompileProfiles(testCase.profiles, testCase.discovered)
			if err == nil {
				t.Fatal("CompileProfiles succeeded")
			}
			if testCase.wantErr != "" && !strings.Contains(err.Error(), testCase.wantErr) {
				t.Fatalf("CompileProfiles error = %q, want %q", err, testCase.wantErr)
			}
		})
	}
}
