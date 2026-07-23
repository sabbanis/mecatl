package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// carryoverFactory builds a server.SessionEngineFactory that returns a fresh
// minimal engine over a canned mockllm reply for any selector, recording the
// selector it was handed. It is the per-session engine for a selector carryover
// session (the source and the seeded new session each rehydrate one).
func carryoverFactory(reply string, seen *atomic.Value) server.SessionEngineFactory {
	return func(_ context.Context, sel server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		if seen != nil {
			seen.Store(sel)
		}
		eng := agent.NewEngine(agent.Deps{
			LLM:     mockllm.New(mockllm.TextTurn(reply), mockllm.TextTurn(reply)),
			Catalog: tool.NewCatalog(),
			Policy:  permpolicy.NewPolicy(nil, nil),
			Model:   "test-model",
		})
		return server.SessionEngineResult{Engine: eng, Close: func() error { return nil }}, nil
	}
}

// TestCarryoverSeedsHistory: a source session with a small valid conversation
// (genuine user + assistant turns), created with WithSourceSession, yields a NEW
// session whose Conversation.Messages equal the source's AND is a deep copy
// (mutating one does not alias the other).
func TestCarryoverSeedsHistory(t *testing.T) {
	ctx := context.Background()

	const srcReply = "SOURCE-ASSISTANT-TEXT"
	var seen atomic.Value
	svc, store := newMCPServiceStore(t, srcReply, carryoverFactory(srcReply, &seen))

	wantSel := server.ProviderSelector{ProviderID: "openrouter", ModelID: "anthropic/claude-3.5-sonnet"}
	src, err := svc.CreateSessionWithProvider(ctx, "/work/carry-src", session.ModeAccept, session.Limits{MaxTurns: 7}, wantSel)
	if err != nil {
		t.Fatalf("CreateSessionWithProvider: %v", err)
	}
	if got := driveCompletedTurn(t, svc, src.ID, "what is the plan?"); got != srcReply {
		t.Fatalf("source turn reply = %q, want %q", got, srcReply)
	}
	// Stash the source's persisted conversation for comparison.
	srcSnap, err := store.Load(ctx, src.ID)
	if err != nil {
		t.Fatalf("Load src: %v", err)
	}
	if len(srcSnap.Conversation.Messages) == 0 {
		t.Fatalf("source has no history to carry over")
	}

	// Reset the factory recorder so the next call is unambiguously the new
	// session's rehydration.
	seen.Store(server.ProviderSelector{})
	newSess, err := svc.CreateSessionWithProfile(ctx, "/work/carry-new", session.ModeAccept, session.Limits{MaxTurns: 7}, wantSel, server.ProfileDefault, server.WithSourceSession(src.ID))
	if err != nil {
		t.Fatalf("CreateSessionWithProfile WithSourceSession: %v", err)
	}
	if newSess.ID == "" || newSess.ID == src.ID {
		t.Fatalf("new session id = %q, want a new distinct id", newSess.ID)
	}

	// History seeded verbatim, same length and content.
	newSnap, err := store.Load(ctx, newSess.ID)
	if err != nil {
		t.Fatalf("Load new: %v", err)
	}
	if got, want := len(newSnap.Conversation.Messages), len(srcSnap.Conversation.Messages); got != want {
		t.Fatalf("seeded history len = %d, want source's %d", got, want)
	}
	var sawUser, sawAssistant bool
	for _, m := range newSnap.Conversation.Messages {
		if m.Role == session.RoleUser && strings.Contains(m.Text, "what is the plan?") {
			sawUser = true
		}
		if m.Role == session.RoleAssistant && strings.Contains(m.Text, srcReply) {
			sawAssistant = true
		}
	}
	if !sawUser || !sawAssistant {
		t.Fatalf("seeded history missing user/assistant text (user=%v assistant=%v)", sawUser, sawAssistant)
	}
	// Fresh aggregate: idle + zeroed counters/usage (carryover seeds history, not budget).
	if newSnap.State != session.StateIdle {
		t.Fatalf("new session state = %q, want idle", newSnap.State)
	}
	if newSnap.Counters != (session.Counters{}) {
		t.Fatalf("new session counters = %+v, want zeroed", newSnap.Counters)
	}

	// Deep copy: the new session's history is content-equal to the source's but a
	// DISTINCT slice (ForkSnapshot clones the backing array). Mutating the new
	// session's loaded copy must not affect the source's loaded copy — the two
	// are independent deserializations, but the underlying guarantee is that the
	// seeded messages were copied, not aliased, at seed time.
	if len(newSnap.Conversation.Messages) > 0 && len(srcSnap.Conversation.Messages) > 0 {
		newFirst := &newSnap.Conversation.Messages[0]
		srcFirst := &srcSnap.Conversation.Messages[0]
		if newFirst == srcFirst {
			t.Fatalf("new session history aliases the source's backing array (not a deep copy)")
		}
	}
	newSnap.Conversation.Messages[0].Text = "MUTATED-NEW"
	srcAgain, err := store.Load(ctx, src.ID)
	if err != nil {
		t.Fatalf("re-Load src: %v", err)
	}
	if srcAgain.Conversation.Messages[0].Text == "MUTATED-NEW" {
		t.Fatalf("source history aliased the new session's (not a deep copy)")
	}

	// The seeded session runs a turn to completion (history replays, no provider
	// 400 from an orphaned tool result — the ForkSnapshot+SeedHistory pairing).
	if got := driveCompletedTurn(t, svc, newSess.ID, "continue the plan"); got != srcReply {
		t.Fatalf("new session turn reply = %q, want %q", got, srcReply)
	}
}

// TestCarryoverRequiresSameProvider: a source on provider A and a new session
// resolving to provider B is rejected with ErrInvalidArgument.
func TestCarryoverRequiresSameProvider(t *testing.T) {
	ctx := context.Background()

	var seen atomic.Value
	svc, _ := newMCPServiceStore(t, "src", carryoverFactory("src", &seen))

	srcSel := server.ProviderSelector{ProviderID: "openrouter", ModelID: "anthropic/claude-3.5-sonnet"}
	src, err := svc.CreateSessionWithProvider(ctx, "/work/src", session.ModeDefault, session.Limits{}, srcSel)
	if err != nil {
		t.Fatalf("CreateSessionWithProvider: %v", err)
	}
	driveCompletedTurn(t, svc, src.ID, "hi")

	// Different provider -> InvalidArgument.
	newSel := server.ProviderSelector{ProviderID: "openai", ModelID: "gpt-4o"}
	_, err = svc.CreateSessionWithProfile(ctx, "/work/new", session.ModeDefault, session.Limits{}, newSel, server.ProfileDefault, server.WithSourceSession(src.ID))
	if !errors.Is(err, server.ErrInvalidArgument) {
		t.Fatalf("cross-provider carryover: err = %v, want ErrInvalidArgument", err)
	}
	if !strings.Contains(err.Error(), "same provider") {
		t.Fatalf("cross-provider error message = %q, want it to mention 'same provider'", err.Error())
	}
}

// TestCarryoverBothDefaultProvider: source and new session both resolving to
// the server DEFAULT provider (empty selector, shared engine) succeed — the
// carryover is same-provider by the empty==default canonicalisation.
func TestCarryoverBothDefaultProvider(t *testing.T) {
	ctx := context.Background()

	// Build the service directly so the SHARED engine carries TWO text turns
	// (the source's and the seeded new session's): newMCPService wires a
	// single-turn mockllm.
	shared := agent.NewEngine(agent.Deps{
		LLM:     mockllm.New(mockllm.TextTurn("DEFAULT-REPLY"), mockllm.TextTurn("DEFAULT-REPLY")),
		Catalog: tool.NewCatalog(),
		Policy:  permpolicy.NewPolicy(nil, nil),
		Model:   "test-model",
	})
	store := memstore.New()
	svc, err := server.NewService(server.Config{
		Engine:        shared,
		Store:         store,
		Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		DefaultLimits: session.Limits{MaxTurns: 10, MaxToolCalls: 20},
		Now:           func() time.Time { return time.Unix(0, 0) },
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	src, err := svc.CreateSession(ctx, "/ws/default-src", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	driveCompletedTurn(t, svc, src.ID, "hello")
	srcSnap, _ := store.Load(ctx, src.ID)
	if len(srcSnap.Conversation.Messages) == 0 {
		t.Fatalf("source has no history to carry over")
	}

	newSess, err := svc.CreateSessionWithProfile(ctx, "/ws/default-new", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSourceSession(src.ID))
	if err != nil {
		t.Fatalf("CreateSessionWithProfile WithSourceSession (both default): %v", err)
	}
	if newSess.ID == "" || newSess.ID == src.ID {
		t.Fatalf("new session id = %q, want a new distinct id", newSess.ID)
	}
	if svc.HasSessionEngineForTest(newSess.ID) {
		t.Fatalf("default carryover registered a per-session engine; it MUST ride the shared engine")
	}
	newSnap, _ := store.Load(ctx, newSess.ID)
	if got, want := len(newSnap.Conversation.Messages), len(srcSnap.Conversation.Messages); got != want {
		t.Fatalf("seeded history len = %d, want source's %d", got, want)
	}
	// The seeded session runs on the shared engine and replays its history.
	if got := driveCompletedTurn(t, svc, newSess.ID, "again"); got != "DEFAULT-REPLY" {
		t.Fatalf("new session turn reply = %q, want the shared engine's reply", got)
	}
}

// TestCarryoverRejectsRunningOrAwaitingSource: a source left in StateRunning is
// rejected with ErrFailedPrecondition (carryover requires a turn boundary).
func TestCarryoverRejectsRunningOrAwaitingSource(t *testing.T) {
	ctx := context.Background()
	svc, store := newMCPServiceStore(t, "shared", nil)

	sess, err := svc.CreateSession(ctx, "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	// Drive the persisted snapshot into StateRunning directly (the genuine
	// mid-run state loadAndReopen reads from the store).
	loaded, err := store.Load(ctx, sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := loaded.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	if err := store.Save(ctx, loaded); err != nil {
		t.Fatalf("Save running: %v", err)
	}

	_, err = svc.CreateSessionWithProfile(ctx, "/ws/new", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSourceSession(sess.ID))
	if !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("carryover on a running source: err = %v, want ErrFailedPrecondition", err)
	}
}

// TestCarryoverRejectsAwaitingSource: a source left in StateAwaiting (parked on
// a permission ask mid-turn) is rejected with ErrFailedPrecondition — the SAME
// turn-boundary rule as the running case, since a snapshot of an awaiting
// conversation carries a dangling unanswered tool call. The awaiting snapshot is
// persisted directly (the genuine parked-at-ask state loadAndReopen reads from
// the store): record the user prompt, BeginTurn, RecordAssistant with an
// unanswered tool call, PauseForApproval, Save.
func TestCarryoverRejectsAwaitingSource(t *testing.T) {
	ctx := context.Background()
	svc, store := newMCPServiceStore(t, "shared", nil)

	sess, err := svc.CreateSession(ctx, "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	loaded, err := store.Load(ctx, sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := loaded.RecordUserPrompt("do the thing", nil); err != nil {
		t.Fatalf("RecordUserPrompt: %v", err)
	}
	if err := loaded.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	call := session.NewToolCall("ask-c1", "Write", json.RawMessage(`{"path":"f.go"}`))
	if err := loaded.RecordAssistant(session.NewAssistantMessage("", "", []session.ToolCall{call})); err != nil {
		t.Fatalf("RecordAssistant: %v", err)
	}
	if err := loaded.PauseForApproval(session.PendingAsk{AskID: "a1", Tool: "Write", Call: call.ID}); err != nil {
		t.Fatalf("PauseForApproval: %v", err)
	}
	if loaded.State != session.StateAwaiting {
		t.Fatalf("source state = %q, want awaiting", loaded.State)
	}
	if err := store.Save(ctx, loaded); err != nil {
		t.Fatalf("Save awaiting: %v", err)
	}

	_, err = svc.CreateSessionWithProfile(ctx, "/ws/new", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSourceSession(sess.ID))
	if !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("carryover on an awaiting source: err = %v, want ErrFailedPrecondition", err)
	}
}

// TestCarryoverMissingSource: a nonexistent source id surfaces the error from
// loadAndReopen (ErrNotFound).
func TestCarryoverMissingSource(t *testing.T) {
	ctx := context.Background()
	svc, _ := newMCPServiceStore(t, "shared", nil)

	_, err := svc.CreateSessionWithProfile(ctx, "/ws/new", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSourceSession("no-such-session"))
	if !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("carryover on a missing source: err = %v, want ErrNotFound", err)
	}
}
