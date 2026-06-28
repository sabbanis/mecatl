package modelhook_test

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/modelhook"
)

// TestParseOverrideDirectiveFirstLineOnly: the directive matches ONLY on the first
// non-empty line; a directive mid-text does NOT match.
func TestParseOverrideDirectiveFirstLineOnly(t *testing.T) {
	cases := []struct {
		name      string
		text      string
		wantFound bool
		wantTool  string
		wantCmd   string
		wantRem   string
	}{
		{
			name:      "bare directive then task",
			text:      "/guardrail-allow\nplease merge the PR",
			wantFound: true,
			wantRem:   "please merge the PR",
		},
		{
			name:      "tool-scoped",
			text:      "/guardrail-allow Bash\nrun the merge",
			wantFound: true,
			wantTool:  "Bash",
			wantRem:   "run the merge",
		},
		{
			name:      "tool + command substring",
			text:      "/guardrail-allow Bash -- gh pr merge\ngo ahead",
			wantFound: true,
			wantTool:  "Bash",
			wantCmd:   "gh pr merge",
			wantRem:   "go ahead",
		},
		{
			name:      "directive only (empty remainder)",
			text:      "/guardrail-allow Bash",
			wantFound: true,
			wantTool:  "Bash",
			wantRem:   "",
		},
		{
			name:      "leading blank line then directive (leading blanks preserved verbatim)",
			text:      "\n\n/guardrail-allow\ndo the thing",
			wantFound: true,
			wantRem:   "\n\ndo the thing",
		},
		{
			name:      "mid-text directive does NOT match",
			text:      "please run\n/guardrail-allow Bash\nthe merge",
			wantFound: false,
			wantRem:   "please run\n/guardrail-allow Bash\nthe merge",
		},
		{
			name:      "no directive",
			text:      "just a normal prompt",
			wantFound: false,
			wantRem:   "just a normal prompt",
		},
		{
			name:      "marker as substring of a word does NOT match",
			text:      "/guardrail-allowance please",
			wantFound: false,
			wantRem:   "/guardrail-allowance please",
		},
		{
			name:      "case-sensitive marker does NOT match",
			text:      "/Guardrail-Allow\ntask",
			wantFound: false,
			wantRem:   "/Guardrail-Allow\ntask",
		},
		{
			name:      "command substring preserves spaces",
			text:      "/guardrail-allow Bash -- git commit -m x\ntask",
			wantFound: true,
			wantTool:  "Bash",
			wantCmd:   "git commit -m x",
			wantRem:   "task",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			scope, rem, found := modelhook.ParseOverrideDirective(c.text)
			if found != c.wantFound {
				t.Fatalf("found=%v want %v", found, c.wantFound)
			}
			if rem != c.wantRem {
				t.Fatalf("remainder=%q want %q", rem, c.wantRem)
			}
			if scope.Tool != c.wantTool {
				t.Fatalf("tool=%q want %q", scope.Tool, c.wantTool)
			}
			if scope.Command != c.wantCmd {
				t.Fatalf("cmd=%q want %q", scope.Command, c.wantCmd)
			}
		})
	}
}

// TestOverrideArmerOneShot: an armed override is consumed exactly ONCE; a second
// consume misses.
func TestOverrideArmerOneShot(t *testing.T) {
	a := modelhook.NewOverrideArmer()
	a.Arm("s1", modelhook.OverrideScope{Tool: "Bash"})
	if !a.Consume("s1", "Bash", "git commit -m x") {
		t.Fatal("first consume must hit")
	}
	if a.Consume("s1", "Bash", "git commit -m x") {
		t.Fatal("second consume must miss (one-shot)")
	}
}

// TestOverrideArmerSessionIsolation: an arm on one session id does NOT authorize a
// block under a different session id (child isolation).
func TestOverrideArmerSessionIsolation(t *testing.T) {
	a := modelhook.NewOverrideArmer()
	a.Arm("parent", modelhook.OverrideScope{})
	if a.Consume("child", "Bash", "git commit -m x") {
		t.Fatal("a different session id must NOT consume the parent's arm")
	}
	if !a.Consume("parent", "Bash", "git commit -m x") {
		t.Fatal("the armed session must still consume")
	}
}

// TestOverrideArmerScopeMatching: tool/command scoping gates the consume; a non-match
// leaves the arm in place.
func TestOverrideArmerScopeMatching(t *testing.T) {
	a := modelhook.NewOverrideArmer()

	// Tool-scoped: a different tool does not consume.
	a.Arm("s", modelhook.OverrideScope{Tool: "Bash"})
	if a.Consume("s", "WebFetch", "") {
		t.Fatal("a tool-scoped override must not fire on a different tool")
	}
	if !a.Consume("s", "Bash", "anything") {
		t.Fatal("the tool-scoped override must still be armed for the right tool")
	}

	// Command-scoped: only a command containing the substring fires.
	a.Arm("s", modelhook.OverrideScope{Tool: "Bash", Command: "gh pr merge"})
	if a.Consume("s", "Bash", "git status") {
		t.Fatal("a command-scoped override must not fire on a non-matching command")
	}
	if !a.Consume("s", "Bash", "gh pr merge 12 --squash") {
		t.Fatal("the command-scoped override must fire on a containing command")
	}

	// Any-tool (zero scope): fires on any tool.
	a.Arm("s", modelhook.OverrideScope{})
	if !a.Consume("s", "WebFetch", "") {
		t.Fatal("a zero-scope override must fire on any tool")
	}
}

// TestOverrideArmerCommandScopeNeverFiresOnNonBash: a Command-scoped override never
// fires on a non-Bash block (cmd is "" there), so a `-- gh pr merge` override cannot
// be burned by an unrelated MCP/WebFetch block.
func TestOverrideArmerCommandScopeNeverFiresOnNonBash(t *testing.T) {
	a := modelhook.NewOverrideArmer()
	a.Arm("s", modelhook.OverrideScope{Command: "gh pr merge"})
	if a.Consume("s", "WebFetch", "") {
		t.Fatal("a command-scoped override must not fire on a non-Bash block (cmd is empty)")
	}
}

// TestOverrideArmerNilSafe: a nil *OverrideArmer is safe — Arm is a no-op, Consume
// returns false.
func TestOverrideArmerNilSafe(t *testing.T) {
	var a *modelhook.OverrideArmer
	a.Arm("s", modelhook.OverrideScope{}) // must not panic
	if a.Consume("s", "Bash", "git commit -m x") {
		t.Fatal("nil armer Consume must return false")
	}
}

// TestOverrideArmerArmReplaces: a fresh arm supersedes a stale un-consumed one.
func TestOverrideArmerArmReplaces(t *testing.T) {
	a := modelhook.NewOverrideArmer()
	a.Arm("s", modelhook.OverrideScope{Tool: "WebFetch"})
	a.Arm("s", modelhook.OverrideScope{Tool: "Bash"}) // supersedes
	if a.Consume("s", "WebFetch", "") {
		t.Fatal("the stale WebFetch arm must have been replaced")
	}
	if !a.Consume("s", "Bash", "git status") {
		t.Fatal("the fresh Bash arm must be active")
	}
}

// TestOverrideArmerConcurrent: arm/consume under concurrency must not race or panic
// (run with -race). It exercises the mutex.
func TestOverrideArmerConcurrent(t *testing.T) {
	a := modelhook.NewOverrideArmer()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			a.Arm("s", modelhook.OverrideScope{Tool: "Bash"})
		}()
		go func() {
			defer wg.Done()
			_ = a.Consume("s", "Bash", "git commit -m x")
		}()
	}
	wg.Wait()
	// One final deterministic round.
	a.Arm("s", modelhook.OverrideScope{})
	if !a.Consume("s", "Bash", "x") {
		t.Fatal("a final arm must be consumable")
	}
}

// TestOverrideArmerExactlyOnceUnderContention pins the ATOMIC test-and-clear: against a
// SINGLE Arm, N goroutines racing Consume must yield EXACTLY ONE true. (The existing
// concurrent test only proves no race / no panic; this proves the one-shot guarantee
// holds under contention — two callers must never both be authorized by one arm.)
func TestOverrideArmerExactlyOnceUnderContention(t *testing.T) {
	const n = 64
	a := modelhook.NewOverrideArmer()
	a.Arm("s", modelhook.OverrideScope{Tool: "Bash"})

	var hits atomic.Int64
	var wg sync.WaitGroup
	start := make(chan struct{})
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start // line everyone up so the Consumes genuinely contend
			if a.Consume("s", "Bash", "git commit -m x") {
				hits.Add(1)
			}
		}()
	}
	close(start)
	wg.Wait()

	if got := hits.Load(); got != 1 {
		t.Fatalf("exactly one Consume must win against a single Arm; got %d", got)
	}
}
