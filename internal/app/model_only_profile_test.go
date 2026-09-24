package app

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memledger"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/nofs"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/prompt"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/hookexec"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// TestADR_0350_ModelOnlyProfileAndCompactionOff keeps the two construction
// properties approved in ADR 0350 coupled: a fully loaded daemon still exposes
// no tools, and the resulting engine has no compaction path or tool overlay.
func TestADR_0350_ModelOnlyProfileAndCompactionOff(t *testing.T) {
	t.Run("empty catalog", TestModelOnlyCatalogIsEmptyUnderFullyLoadedConfig)
	t.Run("bounded engine composition", TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction)
}

func TestModelOnlyOneShotProfile_Scenario2_EmptyCatalogAndCompactionOff(t *testing.T) {
	t.Run("fully loaded configuration remains empty", TestModelOnlyCatalogIsEmptyUnderFullyLoadedConfig)
	t.Run("tools and compaction remain disabled", TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction)
}

func TestModelOnlyCatalogIsEmptyUnderFullyLoadedConfig(t *testing.T) {
	ctx := context.Background()
	cfg := fullyLoadedCfg(t)
	provider := mockllm.New(mockllm.TextTurn("ok"))
	reg := regForTest(provider, providerOpenAI, cfg.Model)

	cat, closeFn, mounted := assembleCatalog(ctx, cfg, reg, memstore.New(), hookexec.New(nil), &catalogAssets{}, catalogSession{
		provider: provider, providerID: providerOpenAI, model: cfg.Model, noFS: true, modelOnly: true,
	})
	defer func() { _ = closeFn() }()
	if names := cat.Names(); len(names) != 0 {
		t.Fatalf("model-only catalog = %v, want empty", names)
	}
	if len(mounted) != 0 {
		t.Fatalf("model-only mounted client tools = %v, want none", mounted)
	}
}

func TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction(t *testing.T) {
	var requests []port.LLMRequest
	provider := mockllm.NewWith([]mockllm.Option{mockllm.WithRequestObserver(func(req port.LLMRequest) {
		requests = append(requests, req)
	})}, mockllm.TextTurn("answer"))
	reg := regForTest(provider, providerOpenAI, "test-model")
	store := memstore.New()
	policy := permpolicy.NewPolicy(defaultRules(), nil)
	baseArgs := func(cfg Config) server.SessionEngineFactory {
		return sessionEngineFactory(cfg, reg, provider, store, policy, hookexec.New(nil), nil, prompt.RootAssembler{}, catalogAssets{}, nil)
	}
	validConfig := func() Config {
		return Config{
			Model:               "test-model",
			Compaction:          "off",
			LLMMaxAttempts:      1,
			PromptCacheDisabled: true,
			MaxRunTokens:        4096,
			ModelOnlyLimits:     DefaultModelOnlyResourceLimits(),
		}
	}

	compactionEnabled := validConfig()
	compactionEnabled.Compaction = "heuristic"
	if _, err := baseArgs(compactionEnabled)(context.Background(), server.ProviderSelector{}, nil, server.ProfileModelOnly, "", session.ModeDefault); !errors.Is(err, server.ErrInvalidArgument) || !strings.Contains(err.Error(), "compaction=off") {
		t.Fatalf("model-only with compaction enabled error = %v, want fail-closed InvalidArgument", err)
	}
	if _, err := baseArgs(validConfig())(context.Background(), server.ProviderSelector{}, []mcp.ServerConfig{{Name: "forbidden", URL: "https://example.invalid"}}, server.ProfileModelOnly, "", session.ModeDefault); !errors.Is(err, server.ErrInvalidArgument) || !strings.Contains(err.Error(), "does not permit") {
		t.Fatalf("model-only with client MCP error = %v, want fail-closed InvalidArgument", err)
	}
	invalidControls := []struct {
		name string
		edit func(*Config)
		want string
	}{
		{name: "attempts", edit: func(cfg *Config) { cfg.LLMMaxAttempts = 2 }, want: "llm-max-attempts=1"},
		{name: "cache", edit: func(cfg *Config) { cfg.PromptCacheDisabled = false }, want: "prompt caching"},
		{name: "tokens", edit: func(cfg *Config) { cfg.MaxRunTokens = 0 }, want: "max-run-tokens"},
		{name: "resource limits", edit: func(cfg *Config) { cfg.ModelOnlyLimits = ModelOnlyResourceLimits{} }, want: "resource limits"},
	}
	for _, tc := range invalidControls {
		t.Run("reject "+tc.name, func(t *testing.T) {
			cfg := validConfig()
			tc.edit(&cfg)
			_, err := baseArgs(cfg)(context.Background(), server.ProviderSelector{}, nil, server.ProfileModelOnly, "", session.ModeDefault)
			if !errors.Is(err, server.ErrInvalidArgument) || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want fail-closed InvalidArgument containing %q", err, tc.want)
			}
		})
	}

	res, err := baseArgs(validConfig())(context.Background(), server.ProviderSelector{}, nil, server.ProfileModelOnly, "", session.ModeDefault)
	if err != nil {
		t.Fatalf("build model-only engine: %v", err)
	}
	defer func() { _ = res.Close() }()
	if got := res.Engine.ContextWindow(); got != 0 {
		t.Fatalf("model-only ContextWindow = %d, want 0 (compaction off)", got)
	}

	sess := session.New("model-only", session.ModeDefault, session.EnvironmentRef{Kind: session.EnvKindNoFS, ID: "none", Revision: "nofs-v1"}, session.Limits{MaxTurns: 2}, time.Unix(0, 0))
	env := tool.MustEnvironment(sess.EnvironmentRef, nofs.New(), memledger.New(), nil)
	run := res.Engine.Run(context.Background(), sess, env, agent.RunRequest{Text: "summarize this input"})
	for range run.Events() {
	}
	if len(requests) != 1 {
		t.Fatalf("provider requests = %d, want exactly 1", len(requests))
	}
	if len(requests[0].Tools) != 0 {
		t.Fatalf("model-only request tools = %v, want none", requests[0].Tools)
	}
	if !strings.Contains(requests[0].System.StablePrefix, modelOnlyPostureNote) {
		t.Fatalf("model-only system prompt missing posture note:\n%s", requests[0].System.StablePrefix)
	}
	if _, err := res.Engine.CompactSession(context.Background(), sess); !errors.Is(err, agent.ErrCompactionDisabled) {
		t.Fatalf("manual compaction error = %v, want ErrCompactionDisabled", err)
	}

	extraSess := session.New("model-only-extra", session.ModeDefault, session.EnvironmentRef{Kind: session.EnvKindNoFS, ID: "none", Revision: "nofs-v1"}, session.Limits{MaxTurns: 1}, time.Unix(0, 0))
	extraRun := res.Engine.Run(context.Background(), extraSess, env, agent.RunRequest{
		Text:       "must not reach provider",
		ExtraTools: []tool.Tool{stubTool{name: "forbidden"}},
	})
	var extraResult *session.ResultPayload
	for event := range extraRun.Events() {
		if event.Result != nil {
			extraResult = event.Result
		}
	}
	if len(requests) != 1 {
		t.Fatalf("provider requests after run-scoped tool injection = %d, want still 1", len(requests))
	}
	if extraResult == nil || extraResult.Stop != session.StopError || !strings.Contains(extraResult.Error, agent.ErrRunScopedToolsDisabled.Error()) {
		t.Fatalf("run-scoped tool terminal = %+v, want StopError with disabled-tools cause", extraResult)
	}
}
