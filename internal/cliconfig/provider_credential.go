package cliconfig

import (
	"errors"
	"sort"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/app"
)

// ProviderCredentialResolver adapts the command root's one immutable credential
// snapshot to app.Build's composition-owned provider-credential seam.
type ProviderCredentialResolver struct {
	flags *ProviderFlags
	keys  ResolvedCredentials
}

// NewProviderCredentialResolver constructs a loader over an already-resolved command
// snapshot. Load performs no filesystem or environment I/O.
func NewProviderCredentialResolver(flags *ProviderFlags, keys ResolvedCredentials) *ProviderCredentialResolver {
	return &ProviderCredentialResolver{flags: flags, keys: keys}
}

// Load validates custom auth IDs only after Build has resolved the operator
// definitions, then returns a detached immutable-by-convention credential snapshot.
func (r *ProviderCredentialResolver) Load(definitions permconfig.ProviderDefinitions) (app.ProviderCredentials, interface{ Close() error }, error) {
	known := append([]string{}, knownAuthProviders...)
	for id := range definitions {
		known = append(known, id)
	}
	sort.Strings(known)
	if r.flags != nil && r.flags.authSnapshotReady {
		if r.flags.authSnapshot != nil {
			if warning := r.flags.authSnapshot.ValidateKnown(known); warning != "" {
				return app.ProviderCredentials{}, nil, errors.New(warning)
			}
		}
		if r.flags.authSnapshot == nil && r.flags.authSnapshotWarn != "" {
			return app.ProviderCredentials{}, nil, errors.New(r.flags.authSnapshotWarn)
		}
	}

	credentials := app.ProviderCredentials{
		OpenAIKey: r.keys.OpenAI, OpenRouterKey: r.keys.OpenRouter,
		AnthropicKey: r.keys.Anthropic, OpenCodeKey: r.keys.OpenCode,
		OpenAICodexCredential: r.keys.OpenAICodex,
		CustomProviderAPIKeys: make(map[string]string, len(definitions)),
	}
	for id, definition := range definitions {
		if definition.Auth.Method == "api_key" {
			key := r.keys.CustomAPIKey(id)
			if key == "" && r.flags != nil && r.flags.authSnapshot != nil {
				key = r.flags.authSnapshot.APIKey(id)
			}
			if key != "" {
				credentials.CustomProviderAPIKeys[id] = key
			} else {
				credentials.MissingCustomProviderAPIKeys = append(credentials.MissingCustomProviderAPIKeys, id)
			}
		}
	}
	sort.Strings(credentials.MissingCustomProviderAPIKeys)
	return credentials, nil, nil
}
