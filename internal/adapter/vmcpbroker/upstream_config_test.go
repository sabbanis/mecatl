package vmcpbroker

import (
	"testing"

	"github.com/stacklok/toolhive/pkg/authserver"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestNewUpstreamRunConfigSelectsConfiguredOAuth2Endpoints(t *testing.T) {
	const secretCanary = "not-an-environment-value"
	profile := permconfig.MCPServerProfile{Name: "upstream", Auth: permconfig.MCPAuthProfile{Mode: profileAuthOAuth, OAuth: &permconfig.MCPOAuthProfile{
		Upstream: &permconfig.MCPOAuthUpstreamProfile{Mode: "oauth2", OAuth2: &permconfig.MCPOAuth2UpstreamProfile{
			AuthorizationEndpoint: "https://auth.example/authorize",
			TokenEndpoint:         "https://auth.example/token",
		}},
		Client: permconfig.MCPOAuthClientProfile{Mode: "preregistered", Preregistered: &permconfig.MCPPreregisteredClientProfile{ID: "client", SecretEnv: "MECATL_CLIENT_SECRET"}},
		Scopes: []string{"read"},
	}}}

	got := newUpstreamRunConfig(profile, "https://broker.example/v1/mcp", processOptions{})
	if got.Type != authserver.UpstreamProviderTypeOAuth2 || got.OAuth2Config == nil || got.OIDCConfig != nil {
		t.Fatalf("generic upstream = %#v; want OAuth2 without OIDC discovery", got)
	}
	if got.OAuth2Config.AuthorizationEndpoint != "https://auth.example/authorize" || got.OAuth2Config.TokenEndpoint != "https://auth.example/token" {
		t.Fatalf("generic upstream endpoints = %#v", got.OAuth2Config)
	}
	if got.OAuth2Config.ClientSecretEnvVar != "MECATL_CLIENT_SECRET" || got.OAuth2Config.ClientSecretEnvVar == secretCanary {
		t.Fatalf("generic upstream secret reference = %q", got.OAuth2Config.ClientSecretEnvVar)
	}
}

func TestNewUpstreamRunConfigPreservesLegacyOIDCDiscovery(t *testing.T) {
	profile := permconfig.MCPServerProfile{Name: "upstream", Auth: permconfig.MCPAuthProfile{Mode: profileAuthOAuth, OAuth: &permconfig.MCPOAuthProfile{
		Issuer: "https://issuer.example",
		Client: permconfig.MCPOAuthClientProfile{Mode: "preregistered", Preregistered: &permconfig.MCPPreregisteredClientProfile{ID: "client", SecretEnv: "MECATL_CLIENT_SECRET"}},
		Scopes: []string{"read"},
	}}}

	got := newUpstreamRunConfig(profile, "https://broker.example/v1/mcp", processOptions{})
	if got.Type != authserver.UpstreamProviderTypeOIDC || got.OIDCConfig == nil || got.OAuth2Config != nil {
		t.Fatalf("legacy upstream = %#v; want OIDC discovery", got)
	}
	if got.OIDCConfig.IssuerURL != "https://issuer.example" {
		t.Fatalf("OIDC issuer = %q", got.OIDCConfig.IssuerURL)
	}
}
