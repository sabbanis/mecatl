package cliconfig

import (
	"errors"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestSessionMCPAuthorization_Scenario1_RootModeDefaults(t *testing.T) {
	for _, tc := range []struct {
		name     string
		root     MCPAuthorityMode
		explicit string
		want     MCPAuthorityMode
		wantErr  bool
	}{
		{name: "mecak8s defaults broker", root: MCPAuthorityBroker, want: MCPAuthorityBroker},
		{name: "mecated defaults global", root: MCPAuthorityGlobal, want: MCPAuthorityGlobal},
		{name: "embedded mecatui defaults global", root: MCPAuthorityGlobal, want: MCPAuthorityGlobal},
		{name: "supported explicit global wins", root: MCPAuthorityBroker, explicit: "global", want: MCPAuthorityGlobal},
		{name: "unattended root rejects broker", root: MCPAuthorityGlobal, explicit: "broker", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: tc.explicit}, DefaultMode: tc.root, BrokerSupported: tc.name != "unattended root rejects broker"})
			if tc.wantErr {
				if err == nil {
					t.Fatal("ResolveMCPAuthority succeeded, want unsupported broker error")
				}
				return
			}
			if err != nil {
				t.Fatalf("ResolveMCPAuthority: %v", err)
			}
			if got.Mode != tc.want {
				t.Errorf("mode = %q, want %q", got.Mode, tc.want)
			}
		})
	}
}

func TestSessionMCPAuthorization_Scenario1_BrokerModeIsExclusive(t *testing.T) {
	authority, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: "broker", Servers: []permconfig.MCPServerProfile{{Name: "public", URL: "https://public.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "none"}}}}, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true})
	if err != nil {
		t.Fatalf("ResolveMCPAuthority: %v", err)
	}
	if authority.Mode != MCPAuthorityBroker || len(authority.BrokerProfiles) != 1 || authority.Global != nil {
		t.Fatalf("broker authority = %#v; want broker declarations only", authority)
	}
	_, err = ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: "broker", Servers: []permconfig.MCPServerProfile{{Name: "legacy", URL: "https://legacy.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "none"}}}}, Legacy: &MCPServerList{entries: []mcpServerEntry{{}}}, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true})
	if !errors.Is(err, ErrMCPProfileInvalid) {
		t.Fatalf("broker mode with legacy input error = %v, want invalid profile", err)
	}
}

func TestInvariant_mcp_broker_callback_url_is_trusted_configuration(t *testing.T) {
	base := permconfig.MCPSection{Mode: "broker", Servers: []permconfig.MCPServerProfile{{Name: "protected", URL: "https://mcp.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "oauth", OAuth: &permconfig.MCPOAuthProfile{Issuer: "https://issuer.example", Client: permconfig.MCPOAuthClientProfile{Mode: "cimd", CIMD: &permconfig.MCPCIMDClientProfile{DocumentURL: "https://issuer.example/client.json"}}, Scopes: []string{"read"}, Network: &permconfig.MCPOAuthNetworkProfile{}}}}}}
	for _, tc := range []struct {
		name string
		url  string
		ok   bool
	}{
		{name: "required", url: "", ok: false},
		{name: "trusted absolute HTTPS", url: "https://agent.example/v1/mcp/authorization/callback", ok: true},
		{name: "userinfo", url: "https://user@agent.example/callback", ok: false},
		{name: "query", url: "https://agent.example/callback?x=1", ok: false},
		{name: "fragment", url: "https://agent.example/callback#x", ok: false},
		{name: "HTTP", url: "http://agent.example/callback", ok: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			section := base
			section.Broker.CallbackURL = tc.url
			_, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &section, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true})
			if (err == nil) != tc.ok {
				t.Fatalf("ResolveMCPAuthority callback %q error = %v, want success %t", tc.url, err, tc.ok)
			}
		})
	}
}

func TestSessionMCPAuthorization_Scenario1_GlobalModeCompatibility(t *testing.T) {
	section := &permconfig.MCPSection{Mode: "global", Servers: []permconfig.MCPServerProfile{
		{Name: "none", URL: "https://none.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		{Name: "bearer", URL: "https://bearer.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "static_bearer", StaticBearer: &permconfig.MCPStaticBearerProfile{TokenEnv: "MECATL_TOKEN"}}},
		{Name: "oauth", URL: "https://oauth.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "oauth", OAuth: globalOAuthProfile()}},
	}}
	got, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: section, DefaultMode: MCPAuthorityBroker, LookupEnv: func(name string) (string, bool) {
		switch name {
		case "MECATL_TOKEN":
			return "token", true
		case "MECATL_CREDENTIAL":
			return "AQ==", true
		}
		return "", false
	}})
	if err != nil || got.Global == nil || got.BrokerProfiles != nil || len(got.Global.Servers) != 3 {
		t.Fatalf("global authority = %#v, %v", got, err)
	}
	if got.Global.Servers[1].Headers["Authorization"] != "Bearer token" || got.Global.Servers[2].OAuth == nil {
		t.Fatalf("global auth compatibility lost: %#v", got.Global.Servers)
	}
}

func globalOAuthProfile() *permconfig.MCPOAuthProfile {
	return &permconfig.MCPOAuthProfile{Profile: "profile", Principal: "principal", Issuer: "https://issuer.example", Client: permconfig.MCPOAuthClientProfile{Mode: "cimd", CIMD: &permconfig.MCPCIMDClientProfile{DocumentURL: "https://issuer.example/client.json"}}, Scopes: []string{"read"}, Credentials: permconfig.MCPOAuthCredentialProfile{Mode: "environment", Environment: &permconfig.MCPEnvironmentCredentialProfile{CredentialEnv: "MECATL_CREDENTIAL"}}, Network: &permconfig.MCPOAuthNetworkProfile{}}
}

func TestSessionMCPAuthorization_Scenario1_ModeSpecificOAuthSchema(t *testing.T) {
	section := &permconfig.MCPSection{Mode: "broker", Broker: permconfig.MCPBrokerProfile{CallbackURL: "https://agent.example/callback"}, Servers: []permconfig.MCPServerProfile{{Name: "x", URL: "https://mcp.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "oauth", OAuth: &permconfig.MCPOAuthProfile{Issuer: "https://issuer.example", Client: permconfig.MCPOAuthClientProfile{Mode: "cimd", CIMD: &permconfig.MCPCIMDClientProfile{DocumentURL: "https://issuer.example/client.json"}}, Scopes: []string{"read"}, Network: &permconfig.MCPOAuthNetworkProfile{}}}}}}
	if _, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: section, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true}); err != nil {
		t.Fatal(err)
	}
	section.Servers[0].Auth.OAuth.Profile = "global-only"
	if _, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: section, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true}); !errors.Is(err, ErrMCPProfileInvalid) {
		t.Fatalf("broker profile field error = %v", err)
	}
	global := &permconfig.MCPSection{Mode: "global", Servers: []permconfig.MCPServerProfile{{Name: "x", URL: "https://mcp.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "oauth", OAuth: &permconfig.MCPOAuthProfile{Issuer: "https://issuer.example", Client: permconfig.MCPOAuthClientProfile{Mode: "cimd", CIMD: &permconfig.MCPCIMDClientProfile{DocumentURL: "https://issuer.example/client.json"}}, Scopes: []string{"read"}, Network: &permconfig.MCPOAuthNetworkProfile{}}}}}}
	if _, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: global, DefaultMode: MCPAuthorityGlobal}); !errors.Is(err, ErrMCPProfileInvalid) {
		t.Fatalf("global missing identity/source error = %v", err)
	}
}

func TestSessionMCPAuthorization_Scenario1_OperatorTierOnly(t *testing.T) {
	// The resolver supplies only its operator capture to this loader; project-tier
	// MCP remains tested at the resolver boundary in permconfig.
	if _, err := ResolveMCPAuthority(MCPAuthorityOptions{DefaultMode: MCPAuthorityGlobal}); err != nil {
		t.Fatal(err)
	}
}

func TestSessionMCPAuthorization_Scenario1_LegacyGlobalConflict(t *testing.T) {
	legacy := &MCPServerList{entries: []mcpServerEntry{{}}}
	if _, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: "broker"}, Legacy: legacy, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true}); !errors.Is(err, ErrMCPProfileInvalid) {
		t.Fatalf("broker legacy conflict = %v", err)
	}
}

func TestInvariant_mcp_authority_mode_is_single_construction_branch(t *testing.T) {
	authority, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: "global"}, DefaultMode: MCPAuthorityBroker})
	if err != nil {
		t.Fatal(err)
	}
	if authority.Mode != MCPAuthorityGlobal || authority.BrokerProfiles != nil || authority.Global == nil {
		t.Fatalf("global authority must have only global construction input: %#v", authority)
	}
	broker := permconfig.MCPServerProfile{Name: "broker", URL: "https://broker.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "none"}}
	selected, err := ResolveMCPAuthority(MCPAuthorityOptions{Operator: &permconfig.MCPSection{Mode: "broker", Servers: []permconfig.MCPServerProfile{broker}}, DefaultMode: MCPAuthorityGlobal, BrokerSupported: true})
	if err != nil {
		t.Fatal(err)
	}
	broker.Name = "mutated"
	if selected.BrokerProfiles[0].Name != "broker" || selected.Global != nil {
		t.Fatalf("broker result aliases input or carries global state: %#v", selected)
	}
}
