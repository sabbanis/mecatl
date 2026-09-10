package app

import (
	"context"
	"iter"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/tool"
)

// A configured runner is never represented as an intentional shell-less mount.
// Fork builders propagate errors directly; catalog construction retains this
// marker until the real environment is bound.
type failedCommandRunner struct{ err error }

func (r failedCommandRunner) Run(context.Context, string) (tool.CommandResult, error) {
	return tool.CommandResult{}, r.err
}

// Writable factories have a capability-only bool result in the engine API.
// Validate at execution instead: unsupported remains false, while unavailable
// becomes a normal failed child with an actionable cause, before any model call.
// Rechecking also permits recovery without rebuilding a cached child engine.
type writableRunnerProvider struct {
	port.LLMProvider
	cfg Config
}

func guardWritableRunner(cfg Config, provider port.LLMProvider) port.LLMProvider {
	if cfg.NoBash || cfg.Shell == "" {
		return provider
	}
	return writableRunnerProvider{LLMProvider: provider, cfg: cfg}
}

func (p writableRunnerProvider) Stream(ctx context.Context, req port.LLMRequest) (iter.Seq2[port.Chunk, error], error) {
	if _, err := commandRunnerForRoot(p.cfg, p.cfg.Workspace); err != nil {
		return nil, err
	}
	return p.LLMProvider.Stream(ctx, req)
}
