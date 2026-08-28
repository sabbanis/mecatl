package cliconfig

import (
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/mecatl/internal/adapter/xdgconfig"
)

func TestOperatorDefinedLLMProviders_Scenario2_SeparateAuthFileKeys(t *testing.T) {
	defs := permconfig.ProviderDefinitions{
		"one": {ID: "one", Auth: permconfig.ProviderAuth{Method: "api_key"}},
		"two": {ID: "two", Auth: permconfig.ProviderAuth{Method: "api_key"}},
	}
	path := "/config/mecatl/auth.yaml"
	env := envWithAuth(path, "providers:\n  one:\n    api_key: key-one\n  two:\n    api_key: key-two\n")
	resolved, err := ResolveProviderCredentials(nil, defs, env)
	if err != nil {
		t.Fatalf("ResolveProviderCredentials: %v", err)
	}
	if resolved.CustomAPIKey("one") != "key-one" || resolved.CustomAPIKey("two") != "key-two" {
		t.Fatalf("custom credentials were not distinct: %+v", resolved)
	}
	if strings.Contains(resolved.AuthFileWarning, "key-") {
		t.Fatalf("credential leaked to warning: %q", resolved.AuthFileWarning)
	}
}

func TestOperatorDefinedLLMProviders_Scenario2_AvailabilityFollowsAuthMethod(t *testing.T) {
	defs := permconfig.ProviderDefinitions{
		"keyed":     {ID: "keyed", Auth: permconfig.ProviderAuth{Method: "api_key"}},
		"anonymous": {ID: "anonymous", Auth: permconfig.ProviderAuth{Method: "none"}},
	}
	resolved, err := ResolveProviderCredentials(nil, defs, envWithAuth("/config/mecatl/auth.yaml", "providers: {}\n"))
	if err != nil {
		t.Fatalf("ResolveProviderCredentials: %v", err)
	}
	if resolved.CustomAvailable("keyed") {
		t.Fatal("api_key provider was available without an auth-file record")
	}
	if !resolved.CustomAvailable("anonymous") {
		t.Fatal("none provider was unavailable without an auth-file record")
	}
}

func TestProviderCredentialResolverReportsOnlyMissingAPIKeyProviders(t *testing.T) {
	defs := permconfig.ProviderDefinitions{
		"keyed": {ID: "keyed", Auth: permconfig.ProviderAuth{Method: "api_key"}},
		"none":  {ID: "none", Auth: permconfig.ProviderAuth{Method: "none"}},
	}
	flags := &ProviderFlags{}
	keys := flags.resolve(envWithAuth("/config/mecatl/auth.yaml", "providers: {}\n"), time.Now())
	credentials, _, err := NewProviderCredentialResolver(flags, keys).Load(defs)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := credentials.MissingCustomProviderAPIKeys; len(got) != 1 || got[0] != "keyed" {
		t.Fatalf("missing custom providers = %v, want [keyed]", got)
	}
}

func TestMalformedAuthSnapshotDiagnosticsStaySafeAcrossConsumers(t *testing.T) {
	const path = "/config/mecatl/auth.yaml"
	const secret = "auth-secret-fragment"
	env := envWithAuth(path, "providers:\n  custom:\n    api_key: "+secret+"\n     malformed: true\n")
	defs := permconfig.ProviderDefinitions{"custom": {ID: "custom", Auth: permconfig.ProviderAuth{Method: "api_key"}}}
	flags := &ProviderFlags{}
	keys := flags.resolve(env, time.Now())
	for _, call := range []struct {
		name string
		run  func() error
	}{
		{"ResolveProviderCredentials", func() error { _, err := ResolveProviderCredentials(flags, defs, env); return err }},
		{"ProviderCredentialResolver.Load", func() error { _, _, err := NewProviderCredentialResolver(flags, keys).Load(defs); return err }},
	} {
		t.Run(call.name, func(t *testing.T) {
			err := call.run()
			if err == nil {
				t.Fatal("malformed auth snapshot was accepted")
			}
			got := err.Error()
			for _, want := range []string{path, "YAML syntax error", "line 4"} {
				if !strings.Contains(got, want) {
					t.Errorf("error %q does not contain %q", got, want)
				}
			}
			if strings.Contains(got, secret) {
				t.Errorf("error leaked auth content: %q", got)
			}
		})
	}
}

func TestInvariant_custom_provider_auth_bootstrap_single_source(t *testing.T) {
	defs := permconfig.ProviderDefinitions{"custom": {ID: "custom", Auth: permconfig.ProviderAuth{Method: "api_key"}}}
	reads := 0
	env := xdgconfig.ResolveEnv{
		Getenv: func(key string) string {
			if key == "XDG_CONFIG_HOME" {
				return "/config"
			}
			if key == "CUSTOM_API_KEY" {
				return "must-not-be-read"
			}
			return ""
		},
		ReadFile: func(string) ([]byte, error) {
			reads++
			return []byte("providers:\n  custom:\n    api_key: from-file\n"), nil
		},
	}
	resolved, err := ResolveProviderCredentials(nil, defs, env)
	if err != nil {
		t.Fatalf("ResolveProviderCredentials: %v", err)
	}
	if reads != 1 || resolved.CustomAPIKey("custom") != "from-file" {
		t.Fatalf("bootstrap must read auth.yaml once and use it exclusively: reads=%d resolved=%+v", reads, resolved)
	}
}

func TestInvariant_custom_provider_authfile_strict(t *testing.T) {
	defs := permconfig.ProviderDefinitions{"known": {ID: "known", Auth: permconfig.ProviderAuth{Method: "api_key"}}}
	_, err := ResolveProviderCredentials(nil, defs, envWithAuth("/config/mecatl/auth.yaml", "providers:\n  unknown:\n    api_key: secret\n"))
	if err == nil {
		t.Fatal("unknown custom auth provider was accepted")
	}
	if strings.Contains(err.Error(), "secret") {
		t.Fatalf("strict auth error leaked file data: %v", err)
	}
}

func envWithAuth(path, contents string) xdgconfig.ResolveEnv {
	return xdgconfig.ResolveEnv{
		Getenv: func(key string) string {
			if key == "XDG_CONFIG_HOME" {
				return "/config"
			}
			return ""
		},
		ReadFile: func(got string) ([]byte, error) {
			if got == path {
				return []byte(contents), nil
			}
			return nil, nil
		},
	}
}
