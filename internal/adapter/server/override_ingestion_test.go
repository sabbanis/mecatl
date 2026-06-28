package server_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/hookexec"
	"github.com/stacklok/mecatl/internal/adapter/modelhook"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// overrideScriptedChecker is a fixed-verdict checker for the composition e2e (the
// modelhook_test package's scriptedChecker is not visible here).
type overrideScriptedChecker struct{ unsafe bool }

func (c overrideScriptedChecker) Check(_ context.Context, _ modelhook.CheckRequest) (modelhook.Verdict, error) {
	safe := !c.unsafe
	return modelhook.Verdict{Safe: &safe, Reason: "mutating shell"}, nil
}

// newOverrideService builds a Service whose Config carries a fresh OverrideArmer, so the
// StartRunContent genuine-prompt scan (ADR 0059) can be exercised end-to-end. It returns
// the service, the armer (so a test can inspect the armed state), and the store (so a
// test can read back the recorded conversation to prove the directive line was stripped).
func newOverrideService(t *testing.T, llm *mockllm.Provider) (*server.Service, *modelhook.OverrideArmer, *memstore.Store) {
	t.Helper()
	armer := modelhook.NewOverrideArmer()
	store := memstore.New()
	engine := agent.NewEngine(agent.Deps{
		LLM:     llm,
		Catalog: tool.NewCatalog(),
		Policy:  permpolicy.NewPolicy(allowRules(), nil),
		Model:   "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine:        engine,
		OverrideArmer: armer,
		Store:         store,
		Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:           func() time.Time { return time.Unix(0, 0) },
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	return svc, armer, store
}

// TestOverrideArmsOnlyFromGenuinePromptText: a /guardrail-allow directive on the first
// line of the StartRunContent text param ARMS the shared armer for that session. This is
// the SOLE arming channel (ADR 0059) — the text param is the genuine, pre-expansion,
// pre-injection user prompt.
func TestOverrideArmsOnlyFromGenuinePromptText(t *testing.T) {
	llm := mockllm.New(mockllm.TextTurn("ok"))
	svc, armer, _ := newOverrideService(t, llm)
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := svc.StartRunContent(context.Background(), sess.ID, "/guardrail-allow Bash -- gh pr merge\nmerge the PR", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	// The override is now armed for this session with the parsed scope: a matching
	// Consume hits, proving the genuine prompt armed it.
	if !armer.Consume(string(sess.ID), "Bash", "gh pr merge 7 --squash") {
		t.Fatal("the genuine prompt directive must have armed the override with the Bash -- gh pr merge scope")
	}
}

// TestOverrideStripsDirectiveFromRecordedPrompt: the directive line is removed from the
// prompt before it is recorded / sent to the model (it must never reach the model or
// history).
func TestOverrideStripsDirectiveFromRecordedPrompt(t *testing.T) {
	llm := mockllm.New(mockllm.TextTurn("ok"))
	svc, _, _ := newOverrideService(t, llm)
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := svc.StartRunContent(context.Background(), sess.ID, "/guardrail-allow Bash\nplease merge the PR", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	svc.Persist(context.Background(), sess.ID)
	svc.FinishRun(sess.ID, run)

	loaded, err := svc.GetSession(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	var sawTask bool
	for _, m := range loaded.Conversation.Messages {
		if strings.Contains(m.Text, "/guardrail-allow") {
			t.Fatalf("the directive line must be STRIPPED from the recorded conversation; found in %q", m.Text)
		}
		if m.Role == session.RoleUser && strings.Contains(m.Text, "please merge the PR") {
			sawTask = true
		}
	}
	if !sawTask {
		t.Fatal("the genuine task text must survive the strip")
	}
}

// TestOverrideDirectiveOnlyMessageRejected: a message that is ONLY the directive (no
// task) is rejected — arming an override must still state a task.
func TestOverrideDirectiveOnlyMessageRejected(t *testing.T) {
	llm := mockllm.New(mockllm.TextTurn("ok"))
	svc, _, _ := newOverrideService(t, llm)
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	_, err = svc.StartRunContent(context.Background(), sess.ID, "/guardrail-allow Bash", nil)
	if err == nil {
		t.Fatal("a directive-only message (no task) must be rejected")
	}
	if !errors.Is(err, server.ErrInvalidArgument) {
		t.Fatalf("rejection must be ErrInvalidArgument; got %v", err)
	}
}

// TestOverrideNoDirectivePromptUnchanged: a normal prompt (no directive) is recorded
// verbatim and arms nothing.
func TestOverrideNoDirectivePromptUnchanged(t *testing.T) {
	llm := mockllm.New(mockllm.TextTurn("ok"))
	svc, armer, _ := newOverrideService(t, llm)
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := svc.StartRunContent(context.Background(), sess.ID, "just do the normal thing", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	svc.Persist(context.Background(), sess.ID)
	svc.FinishRun(sess.ID, run)
	if armer.Consume(string(sess.ID), "Bash", "anything") {
		t.Fatal("a prompt with no directive must arm nothing")
	}
	loaded, _ := svc.GetSession(context.Background(), sess.ID)
	var sawPrompt bool
	for _, m := range loaded.Conversation.Messages {
		if m.Role == session.RoleUser && strings.Contains(m.Text, "just do the normal thing") {
			sawPrompt = true
		}
	}
	if !sawPrompt {
		t.Fatal("a normal prompt must be recorded verbatim")
	}
}

// capturingDiag records WARN messages so the near-miss feedback can be asserted.
type capturingDiag struct{ warns []string }

func (d *capturingDiag) Log(_ context.Context, lvl port.Level, msg string, _ ...any) {
	if lvl == port.LevelWarn {
		d.warns = append(d.warns, msg)
	}
}
func (d *capturingDiag) With(...any) port.Diagnostics { return d }
func (d *capturingDiag) hasWarn(sub string) bool {
	for _, w := range d.warns {
		if strings.Contains(w, sub) {
			return true
		}
	}
	return false
}

// TestOverrideEndToEndThroughServiceAndRunner is the composition-level JOIN of the two
// halves (ADR 0059): arming via Service.StartRunContent's genuine-prompt scan AND
// consumption by THAT session's actual guardrails Runner on a block, through the SAME
// shared OverrideArmer. The Service's engine carries a real modelhook.Runner (Bash block
// rule + an unsafe scripted checker) sharing the armer the Service arms — exactly the
// production wiring (buildEngine threads one armer to both the Runner and server.Config).
//
// Residual seam note: this builds the Service + Runner directly rather than through
// app.Build, because app.Build constructs the engine-backed checker internally (it drives
// a real one-turn checker engine) and a deterministic offline verdict cannot be injected
// without a mock provider scripted to emit verdict JSON — brittle. The wiring under test
// (one shared armer reaching both the Service arm-point and the session's Runner
// consume-point) is identical; only the checker is a stub instead of an engine.
func TestOverrideEndToEndThroughServiceAndRunner(t *testing.T) {
	armer := modelhook.NewOverrideArmer()
	store := memstore.New()
	bash := &scriptTool{name: "Bash", readOnly: false, content: "ran"}

	bashRule, ok := modelhook.CompileRule(modelhook.RuleSpec{
		Match: "Bash", Phases: []string{"pre"}, Mode: string(modelhook.ModeBlock),
		SkipReadOnlyBash: true, Prompt: modelhook.DefaultBashPrePrompt,
	})
	if !ok {
		t.Fatal("bash rule must compile")
	}
	// The guardrails Runner shares the SAME armer the Service will arm — exactly the
	// production wiring (buildEngine threads ONE armer to both the Runner Options and
	// server.Config.OverrideArmer).
	hooks := modelhook.New(hookexec.New(nil), modelhook.Options{
		Rules:         []modelhook.CompiledRule{bashRule},
		Checker:       overrideScriptedChecker{unsafe: true}, // a block, absent an override
		OverrideArmer: armer,
	})

	cat := tool.NewCatalog()
	cat.MustRegister(bash)
	// The model calls a MUTATING Bash command (read-only would be pre-filtered and never
	// reach the checker), then finishes.
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Bash", `{"command":"gh pr merge 7 --squash"}`)),
		mockllm.TextTurn("done"),
	)
	engine := agent.NewEngine(agent.Deps{
		LLM:     llm,
		Catalog: cat,
		Policy:  permpolicy.NewPolicy([]governance.Rule{{Effect: governance.Allow}}, nil),
		Hooks:   hooks,
		Model:   "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine:        engine,
		OverrideArmer: armer, // the SAME instance the Runner consults
		Store:         store,
		Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:           func() time.Time { return time.Unix(0, 0) },
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Arm via the genuine prompt, then run: the SAME session's Runner must consume the
	// armed override on the Bash block, so the tool RUNS.
	run, err := svc.StartRunContent(context.Background(), sess.ID,
		"/guardrail-allow Bash -- gh pr merge\nmerge the PR", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	if !bash.ran() {
		t.Fatal("the override armed via StartRunContent must be consumed by that session's Runner — the Bash tool must run")
	}
	// One-shot: the override is gone (a re-issued plain prompt would re-block, proving it
	// was consumed, not still armed).
	if armer.Consume(string(sess.ID), "Bash", "gh pr merge 7 --squash") {
		t.Fatal("the override must have been CONSUMED by the run (one-shot), not still armed")
	}
}

// TestOverrideNearMissWarns: a first-line that looks like the directive but does not
// parse (wrong case) is NOT armed (fail-safe) and emits a WARN so the operator learns it
// was unrecognized; the text passes through as the task.
func TestOverrideNearMissWarns(t *testing.T) {
	diag := &capturingDiag{}
	armer := modelhook.NewOverrideArmer()
	engine := agent.NewEngine(agent.Deps{
		LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(),
		Policy: permpolicy.NewPolicy(allowRules(), nil), Model: "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine: engine, OverrideArmer: armer, Store: memstore.New(),
		Workspaces:  func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:         func() time.Time { return time.Unix(0, 0) },
		Diagnostics: diag,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	sess, _ := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	run, err := svc.StartRunContent(context.Background(), sess.ID, "/Guardrail-Allow Bash\ndo the task", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	if !diag.hasWarn("did not parse") {
		t.Fatalf("a near-miss directive must WARN; warns=%v", diag.warns)
	}
	// Fail-safe: nothing armed.
	if armer.Consume(string(sess.ID), "Bash", "anything") {
		t.Fatal("a near-miss must NOT arm anything")
	}
}

// TestOverrideMidTextGuardrailMentionDoesNotWarn: a legitimate prompt that mentions
// /guardrail mid-text (not the first line) must NOT trip the near-miss WARN.
func TestOverrideMidTextGuardrailMentionDoesNotWarn(t *testing.T) {
	diag := &capturingDiag{}
	engine := agent.NewEngine(agent.Deps{
		LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(),
		Policy: permpolicy.NewPolicy(allowRules(), nil), Model: "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine: engine, OverrideArmer: modelhook.NewOverrideArmer(), Store: memstore.New(),
		Workspaces:  func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:         func() time.Time { return time.Unix(0, 0) },
		Diagnostics: diag,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	sess, _ := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{})
	run, err := svc.StartRunContent(context.Background(), sess.ID,
		"explain how /guardrail-allow works in this codebase", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	drainRun(t, run)
	if diag.hasWarn("did not parse") {
		t.Fatal("a mid-text /guardrail mention (first line is normal prose) must NOT trip the near-miss WARN")
	}
}
