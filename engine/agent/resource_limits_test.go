package agent_test

import (
	"context"
	"encoding/json"
	"iter"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func resourceEngine(provider port.LLMProvider, mutate func(*agent.Deps)) *agent.Engine {
	deps := agent.Deps{
		LLM:     provider,
		Catalog: tool.NewCatalog(),
		Model:   "test-model",
	}
	mutate(&deps)
	return newEngine(deps)
}

// TestADR_0351_BoundedOneShotModelOnlyRuns covers the engine-level resource
// dimensions selected by ADR 0351. Provider request/response and shared-run
// admission limits are exercised by the app composition tests.
func TestADR_0351_BoundedOneShotModelOnlyRuns(t *testing.T) {
	t.Run("event count", TestRunEventCountLimitReservesTerminalResult)
	t.Run("event bytes", TestRunEventByteLimitFailsClosed)
	t.Run("session bytes", TestSessionByteLimitRejectsBeforeProviderCall)
	t.Run("run duration", TestRunDurationLimitIsDeclaredTerminal)
	t.Run("buffered event bytes", TestBufferedEventBytesDetermineChannelCapacity)
	t.Run("undrained buffer deadline", TestRunDurationLimitUnwedgesUndrainedEventBuffer)
}

func TestRunEventCountLimitReservesTerminalResult(t *testing.T) {
	eng := resourceEngine(mockllm.New(mockllm.TextTurn("answer")), func(deps *agent.Deps) {
		deps.MaxEvents = 5
		deps.MaxEventBytes = 4096
		deps.MaxBufferedEventBytes = 8192
	})
	events := drain(eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"}))
	if len(events) > 5 {
		t.Fatalf("published events = %d, want at most 5", len(events))
	}
	result := lastResult(t, events)
	if result.Stop != session.StopBudget || !strings.Contains(result.Error, agent.ErrRunEventCountLimit.Error()) {
		t.Fatalf("terminal result = %+v, want StopBudget with event-count cause", result)
	}
}

func TestRunEventByteLimitFailsClosed(t *testing.T) {
	eng := resourceEngine(mockllm.New(mockllm.TextTurn(strings.Repeat("x", 5000))), func(deps *agent.Deps) {
		deps.MaxEvents = 20
		deps.MaxEventBytes = 4096
		deps.MaxBufferedEventBytes = 8192
	})
	events := drain(eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"}))
	for _, event := range events {
		encoded, err := json.Marshal(event)
		if err != nil {
			t.Fatal(err)
		}
		if len(encoded) > 4096 {
			t.Fatalf("published event %s = %d bytes, want <= 4096", event.Type, len(encoded))
		}
	}
	result := lastResult(t, events)
	if result.Stop != session.StopBudget || !strings.Contains(result.Error, agent.ErrRunEventBytesLimit.Error()) {
		t.Fatalf("terminal result = %+v, want StopBudget with event-byte cause", result)
	}
}

func TestSessionByteLimitRejectsBeforeProviderCall(t *testing.T) {
	var requests atomic.Int32
	provider := mockllm.NewWith([]mockllm.Option{mockllm.WithRequestObserver(func(port.LLMRequest) {
		requests.Add(1)
	})}, mockllm.TextTurn("unused"))
	eng := resourceEngine(provider, func(deps *agent.Deps) {
		deps.MaxSessionBytes = 32
	})
	events := drain(eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: strings.Repeat("p", 128)}))
	if requests.Load() != 0 {
		t.Fatalf("provider calls = %d, want 0", requests.Load())
	}
	result := lastResult(t, events)
	if result.Stop != session.StopBudget || !strings.Contains(result.Error, agent.ErrSessionBytesLimit.Error()) {
		t.Fatalf("terminal result = %+v, want StopBudget with session-byte cause", result)
	}
}

type deadlineProvider struct{}

func (deadlineProvider) Capabilities() port.ProviderCapabilities { return port.ProviderCapabilities{} }
func (deadlineProvider) Stream(ctx context.Context, _ port.LLMRequest) (iter.Seq2[port.Chunk, error], error) {
	return func(yield func(port.Chunk, error) bool) {
		<-ctx.Done()
		yield(port.Chunk{}, ctx.Err())
	}, nil
}

func TestRunDurationLimitIsDeclaredTerminal(t *testing.T) {
	eng := resourceEngine(deadlineProvider{}, func(deps *agent.Deps) {
		deps.MaxRunDuration = 20 * time.Millisecond
	})
	events := drain(eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"}))
	result := lastResult(t, events)
	if result.Stop != session.StopBudget || !strings.Contains(result.Error, agent.ErrRunDurationLimit.Error()) {
		t.Fatalf("terminal result = %+v, want StopBudget with duration cause", result)
	}
}

func TestBufferedEventBytesDetermineChannelCapacity(t *testing.T) {
	eng := resourceEngine(deadlineProvider{}, func(deps *agent.Deps) {
		deps.MaxEventBytes = 4096
		deps.MaxBufferedEventBytes = 8192
		deps.MaxRunDuration = 20 * time.Millisecond
	})
	run := eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"})
	if got := cap(run.Events()); got != 2 {
		t.Fatalf("event channel capacity = %d, want 2", got)
	}
	drain(run)
}

func TestRunDurationLimitUnwedgesUndrainedEventBuffer(t *testing.T) {
	eng := resourceEngine(deadlineProvider{}, func(deps *agent.Deps) {
		deps.MaxEventBytes = 4096
		deps.MaxBufferedEventBytes = 4096
		deps.MaxRunDuration = 20 * time.Millisecond
	})
	run := eng.Run(context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"})

	// Do not drain while the duration expires. The engine-owned deadline must
	// release any event publication blocked on the one-slot buffer by itself.
	time.Sleep(100 * time.Millisecond)
	if got := run.Outcome(); got != agent.RunOutcomeCompleted {
		t.Fatalf("run outcome after duration with undrained buffer = %v, want completed", got)
	}
	drain(run)
}
