package agent_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/prompt"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// renderTurn0Fragments returns the REAL turn-0 context fragments (soul + memory
// index) the InstructionAssembler chain injects, rendered via the live assemblers
// — so the compaction pin is exercised against the same bytes a real session
// carries, not hand-rolled stand-ins. They are RoleUser messages and, by the bug,
// precede the user's genuine first instruction.
func renderTurn0Fragments(t *testing.T) []session.Message {
	t.Helper()
	asm := prompt.NewMultiAssembler(
		prompt.SoulAssembler{Src: fakeSoulSrc{body: "PERSONA terse engineer"}},
		prompt.MemoryIndexAssembler{Src: fakeIndexSrc{entries: []tool.MemoryEntry{{
			Key: "pref/runner", Value: "gotestsum", Description: "preferred test runner",
		}}}},
	)
	msgs, err := asm.Assemble(context.Background(), memfs.NewWorkspace("/ws"))
	if err != nil {
		t.Fatalf("assemble turn-0 fragments: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 injected fragments (soul + memory), got %d", len(msgs))
	}
	// Sanity: both are RoleUser AND recognised as injected — so the only thing
	// keeping the pin off them is the genuine-user skip under test.
	for _, m := range msgs {
		if m.Role != session.RoleUser || !prompt.IsInjectedTurn0Fragment(m.Text) {
			t.Fatalf("fragment not a recognised injected RoleUser message: role=%s\n%s", m.Role, m.Text)
		}
	}
	return msgs
}

// injectedPrefixTaskConversation builds a tool-heavy conversation whose history
// OPENS with the system prompt + the real injected turn-0 fragments (soul, memory
// index), THEN the user's genuine first instruction (the GOAL), then settled
// assistant/tool work, then SEVERAL later genuine user turns. This isolates the
// PIN as the only thing that can save the goal:
//
//   - the goal is outside the count-tail (keep=6 trailing messages are all the
//     later turns + tool work);
//   - the goal sits BELOW the back-snap floor (userSnapFloor = one past the FIRST
//     genuine user) and the later genuine turns fill the recent-user back-snap
//     window (recentUserTurnsKept=3), so the back-snap anchors on a LATER turn,
//     never reaching back to the goal;
//   - therefore only firstUser/preservedHead pinning the GENUINE first user keeps
//     the goal. Under the OLD code the pin anchored on the injected soul fragment
//     (the first RoleUser) and the goal was summarised away — the bug.
func injectedPrefixTaskConversation(t *testing.T) *session.Conversation {
	t.Helper()
	conv := &session.Conversation{}
	conv.Append(session.NewSystemMessage("system rules"))
	for _, frag := range renderTurn0Fragments(t) {
		conv.Append(frag)
	}
	// The GENUINE goal — the first real user instruction, after the injected prefix.
	conv.Append(session.NewUserMessage("ACTUAL TASK: rename Foo to Bar"))
	// Settled assistant/tool work after the goal.
	for i := 0; i < 6; i++ {
		id := session.ToolCallID("t" + string(rune('a'+i)))
		conv.Append(session.NewAssistantMessage("", "", []session.ToolCall{
			session.NewToolCall(id, "Read", json.RawMessage(`{"path":"g.go"}`)),
		}))
		conv.Append(session.NewToolMessage(session.NewToolResult(id, strings.Repeat("X", 2000))))
	}
	// Several LATER genuine user turns: they fill the recent-user back-snap window
	// (well past recentUserTurnsKept) so the back-snap anchors here, NOT on the goal.
	for i := 0; i < 6; i++ {
		conv.Append(session.NewUserMessage("follow-up chatter about progress"))
		conv.Append(session.NewAssistantMessage("ack", "", nil))
	}
	return conv
}

// assertGenuineGoalPinnedNotFragment checks the GENUINE user instruction survives
// verbatim as a RoleUser message AND that no injected fragment was mistaken for the
// goal in a way that drops the real task. (Injected fragments MAY be absent — they
// are correctly summarised/dropped as harness context — the contract is only that
// the genuine goal survives and pairing holds.)
func assertGenuineGoalPinnedNotFragment(t *testing.T, compacted []session.Message) {
	t.Helper()
	if err := session.ValidateToolPairing(compacted); err != nil {
		t.Fatalf("compacted history is not tool-pairing valid: %v", err)
	}
	var sawGoal bool
	for _, m := range compacted {
		if m.Role == session.RoleUser && m.Text == "ACTUAL TASK: rename Foo to Bar" {
			sawGoal = true
		}
	}
	if !sawGoal {
		t.Fatalf("the GENUINE user goal did not survive compaction (the pin anchored on an injected fragment and the goal was summarised away):\n%+v", compacted)
	}
}

// TestHeuristicCompactorPinsGenuineGoalPastInjectedFragments is the pin-fix repro
// for the heuristic compactor. Reverting firstUser/userSnapFloor to anchor on the
// first RoleUser message (the injected soul fragment) makes sawGoal false → red.
func TestHeuristicCompactorPinsGenuineGoalPastInjectedFragments(t *testing.T) {
	conv := injectedPrefixTaskConversation(t)
	compacted, _, err := agent.HeuristicCompactor{}.Compact(context.Background(), conv)
	if err != nil {
		t.Fatalf("Compact: %v", err)
	}
	assertGenuineGoalPinnedNotFragment(t, compacted)
}

// TestCascadeCompactorPinsGenuineGoalPastInjectedFragments is the cascade parity
// (offline: BudgetTokens 0 runs every deterministic tier once, no LLM). The
// preservedHead pin must skip the injected fragments and anchor on the genuine
// goal; reverting preservedHead's isGenuineUserTurn skip drops the goal → red.
func TestCascadeCompactorPinsGenuineGoalPastInjectedFragments(t *testing.T) {
	conv := injectedPrefixTaskConversation(t)
	compacted, _, err := agent.CascadeCompactor{}.Compact(context.Background(), conv)
	if err != nil {
		t.Fatalf("Compact: %v", err)
	}
	assertGenuineGoalPinnedNotFragment(t, compacted)
}

// TestTurn0InjectionFiresOnceAcrossReopen is the resume re-injection fix (Bug 2):
// a FRESH session injects the turn-0 fragments exactly once; after Reopen + a new
// prompt the assembler must NOT fire again (it was gated on Counters.Turns==0,
// which Reopen zeroes, so it re-injected on every resume and bloated history). The
// gate is now "no genuine user turn recorded yet", so a resumed session skips it.
func TestTurn0InjectionFiresOnceAcrossReopen(t *testing.T) {
	ctx := context.Background()
	asm := &countingAssembler{msg: "Project instructions (AGENTS.md):\n\nthe house style"}
	llm := mockllm.New(mockllm.TextTurn("first done"), mockllm.TextTurn("second done"))
	cat := catalogWith(t, &fakeTool{name: "Read", readOnly: true, exec: okExec})
	e := newEngine(agent.Deps{LLM: llm, Catalog: cat, Instructions: asm})

	sess := newSession(t, session.Limits{})
	ws := memfs.NewWorkspace("/ws")

	// Fresh session: the assembler fires exactly once.
	drain(e.Run(ctx, sess, ws, "first prompt"))
	if asm.called != 1 {
		t.Fatalf("fresh-session injection: assembler called %d times, want 1", asm.called)
	}
	if got := countInjected(sess); got != 1 {
		t.Fatalf("fresh session: %d injected fragments in history, want 1", got)
	}

	// Resume: a completed session is Reopened (Counters zeroed) and re-driven. The
	// assembler must NOT fire again, and no duplicate fragment may enter history.
	if err := sess.Reopen(); err != nil {
		t.Fatalf("Reopen: %v", err)
	}
	drain(e.Run(ctx, sess, ws, "second prompt"))
	if asm.called != 1 {
		t.Fatalf("after Reopen: assembler called %d times, want 1 (re-injection regressed)", asm.called)
	}
	if got := countInjected(sess); got != 1 {
		t.Fatalf("after Reopen: %d injected fragments in history, want 1 (duplicate re-injection)", got)
	}
}

// countingAssembler counts Assemble calls and returns one injected-shaped fragment.
type countingAssembler struct {
	called int
	msg    string
}

func (a *countingAssembler) Assemble(context.Context, tool.Workspace) ([]session.Message, error) {
	a.called++
	return []session.Message{session.NewUserMessage(a.msg)}, nil
}

func countInjected(sess *session.Session) int {
	n := 0
	for _, m := range sess.Conversation.Messages {
		if m.Role == session.RoleUser && prompt.IsInjectedTurn0Fragment(m.Text) {
			n++
		}
	}
	return n
}
