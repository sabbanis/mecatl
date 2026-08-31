package mcpauthority

import (
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestBrokerCopiesNestedDeclarations(t *testing.T) {
	in := BrokerConfig{CallbackURL: "https://agent.example/callback", Profiles: []permconfig.MCPServerProfile{{Auth: permconfig.MCPAuthProfile{OAuth: &permconfig.MCPOAuthProfile{Scopes: []string{"read"}, Upstream: &permconfig.MCPOAuthUpstreamProfile{Mode: "oauth2", OAuth2: &permconfig.MCPOAuth2UpstreamProfile{AuthorizationEndpoint: "https://auth.example/authorize", TokenEndpoint: "https://auth.example/token"}}, Network: &permconfig.MCPOAuthNetworkProfile{AdditionalOrigins: []string{"https://issuer.example"}}}}}}}
	result := NewBroker(in)
	in.Profiles[0].Auth.OAuth.Scopes[0] = "mutated"
	in.Profiles[0].Auth.OAuth.Upstream.OAuth2.TokenEndpoint = "https://mutated.example/token"
	in.Profiles[0].Auth.OAuth.Network.AdditionalOrigins[0] = "https://mutated.example"
	got, ok := result.Broker()
	if !ok || got.Profiles[0].Auth.OAuth.Scopes[0] != "read" || got.Profiles[0].Auth.OAuth.Upstream.OAuth2.TokenEndpoint != "https://auth.example/token" || got.Profiles[0].Auth.OAuth.Network.AdditionalOrigins[0] != "https://issuer.example" {
		t.Fatalf("broker declaration aliases input: %#v", got)
	}
	got.Profiles[0].Auth.OAuth.Scopes[0] = "returned-mutation"
	got.Profiles[0].Auth.OAuth.Upstream.OAuth2.AuthorizationEndpoint = "https://returned-mutation.example/authorize"
	again, _ := result.Broker()
	if again.Profiles[0].Auth.OAuth.Scopes[0] != "read" || again.Profiles[0].Auth.OAuth.Upstream.OAuth2.AuthorizationEndpoint != "https://auth.example/authorize" {
		t.Fatalf("broker declaration aliases returned payload: %#v", again)
	}
}
