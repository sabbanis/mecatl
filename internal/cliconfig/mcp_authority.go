package cliconfig

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

// MCPAuthorityMode selects the sole MCP construction path for a process.
type MCPAuthorityMode string

const (
	// MCPAuthorityGlobal selects the established direct global MCP manager.
	MCPAuthorityGlobal MCPAuthorityMode = "global"
	// MCPAuthorityBroker selects the session-scoped broker declaration path.
	MCPAuthorityBroker MCPAuthorityMode = "broker"
)

// MCPAuthority is a tagged construction input. Exactly one payload is present:
// Global owns direct-MCP profiles and their lifecycle; broker mode carries only
// broker declarations and never opens credential stores.
type MCPAuthority struct {
	Mode           MCPAuthorityMode
	Global         *MCPProfiles
	BrokerProfiles []permconfig.MCPServerProfile
	CallbackURL    string
}

// MCPAuthorityOptions supplies the already-parsed operator block and root policy.
type MCPAuthorityOptions struct {
	Operator        *permconfig.MCPSection
	Legacy          *MCPServerList
	LookupEnv       func(string) (string, bool)
	DefaultMode     MCPAuthorityMode
	BrokerSupported bool
}

// ResolveMCPAuthority performs the one mode-specific MCP validation pass. It
// never creates a broker Runtime; that remains a composition concern.
func ResolveMCPAuthority(opts MCPAuthorityOptions) (MCPAuthority, error) {
	mode := opts.DefaultMode
	if mode != MCPAuthorityGlobal && mode != MCPAuthorityBroker {
		return MCPAuthority{}, fmt.Errorf("%w: MCP root default must be global or broker", ErrMCPProfileInvalid)
	}
	if opts.Operator != nil && opts.Operator.Mode != "" {
		mode = MCPAuthorityMode(opts.Operator.Mode)
	}
	if mode != MCPAuthorityGlobal && mode != MCPAuthorityBroker {
		return MCPAuthority{}, fmt.Errorf("%w: mcp.mode must be global or broker", ErrMCPProfileInvalid)
	}
	if mode == MCPAuthorityBroker {
		if !opts.BrokerSupported {
			return MCPAuthority{}, fmt.Errorf("%w: broker MCP mode is unsupported by this command root", ErrMCPProfileInvalid)
		}
		if opts.Legacy != nil && len(opts.Legacy.entries) != 0 {
			return MCPAuthority{}, fmt.Errorf("%w: --mcp-server is global-only and conflicts with mcp.mode: broker", ErrMCPProfileInvalid)
		}
		return resolveBrokerAuthority(opts.Operator)
	}
	if opts.Operator != nil && opts.Operator.Broker.CallbackURL != "" {
		return MCPAuthority{}, fmt.Errorf("%w: mcp.broker.callback_url is inert in global mode", ErrMCPProfileInvalid)
	}
	profiles, err := LoadMCPProfiles(MCPProfileLoadOptions{Operator: opts.Operator, Legacy: opts.Legacy, LookupEnv: opts.LookupEnv})
	if err != nil {
		return MCPAuthority{}, err
	}
	return MCPAuthority{Mode: MCPAuthorityGlobal, Global: profiles}, nil
}

func resolveBrokerAuthority(section *permconfig.MCPSection) (MCPAuthority, error) {
	if section == nil {
		return MCPAuthority{Mode: MCPAuthorityBroker, BrokerProfiles: []permconfig.MCPServerProfile{}}, nil
	}
	profiles := append([]permconfig.MCPServerProfile(nil), section.Servers...)
	oauthCount := 0
	for _, profile := range profiles {
		switch profile.Auth.Mode {
		case "none":
		case "static_bearer":
			return MCPAuthority{}, fmt.Errorf("%w: MCP server %q: static_bearer is unsupported in broker mode", ErrMCPProfileInvalid, profile.Name)
		case "oauth":
			oauthCount++
			if oauthCount > 1 {
				return MCPAuthority{}, fmt.Errorf("%w: broker mode supports at most one OAuth MCP server", ErrMCPProfileInvalid)
			}
			if err := validateBrokerOAuth(profile); err != nil {
				return MCPAuthority{}, err
			}
		default:
			return MCPAuthority{}, fmt.Errorf("%w: MCP server %q: invalid auth mode", ErrMCPProfileInvalid, profile.Name)
		}
	}
	callback := section.Broker.CallbackURL
	if oauthCount != 0 {
		if err := validateBrokerCallbackURL(callback); err != nil {
			return MCPAuthority{}, err
		}
	} else if callback != "" {
		return MCPAuthority{}, fmt.Errorf("%w: mcp.broker.callback_url requires a broker OAuth server", ErrMCPProfileInvalid)
	}
	return MCPAuthority{Mode: MCPAuthorityBroker, BrokerProfiles: profiles, CallbackURL: callback}, nil
}

func validateBrokerOAuth(profile permconfig.MCPServerProfile) error {
	oauth := profile.Auth.OAuth
	if oauth == nil || oauth.Issuer == "" || len(oauth.Scopes) == 0 || oauth.Network == nil || oauth.Client.Mode == "" {
		return fmt.Errorf("%w: MCP server %q: broker OAuth requires issuer, client, scopes, and network", ErrMCPProfileInvalid, profile.Name)
	}
	if oauth.Profile != "" || oauth.Principal != "" || oauth.Credentials.Mode != "" || oauth.Credentials.Local != nil || oauth.Credentials.Environment != nil {
		return fmt.Errorf("%w: MCP server %q: broker OAuth forbids profile, principal, and credentials", ErrMCPProfileInvalid, profile.Name)
	}
	return nil
}

func validateBrokerCallbackURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || !u.IsAbs() || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return fmt.Errorf("%w: mcp.broker.callback_url must be an absolute HTTPS URL without userinfo, query, or fragment", ErrMCPProfileInvalid)
	}
	if strings.TrimSpace(raw) != raw {
		return fmt.Errorf("%w: mcp.broker.callback_url must not contain surrounding whitespace", ErrMCPProfileInvalid)
	}
	return nil
}
