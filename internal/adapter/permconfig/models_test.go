package permconfig

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/slogdiag"
)

const operatorModelsYAML = `
models:
  slots:
    compaction: cheap
    guardrail: fast
  aliases:
    cheap: gpt-4o-mini
    fast: gpt-4o
`

// TestOperatorModelsFromCLIHonoured pins that an OPERATOR-TIER (CLI explicit)
// models: block is honoured and parsed faithfully (ADR 0030).
func TestOperatorModelsFromCLIHonoured(t *testing.T) {
	env := envWithExplicit("/etc/mecatl/models.yaml", operatorModelsYAML)
	r := newWithEnv(Options{ExplicitFiles: []string{"/etc/mecatl/models.yaml"}}, env)
	if r == nil {
		t.Fatal("resolver should be non-nil with an explicit file")
	}
	m := r.OperatorModelSlots()
	if m == nil {
		t.Fatal("operator-tier models must be honoured from the CLI/explicit tier")
	}
	if m.Slots["compaction"] != "cheap" || m.Slots["guardrail"] != "fast" {
		t.Fatalf("slots not parsed faithfully: %+v", m.Slots)
	}
	if m.Aliases["cheap"] != "gpt-4o-mini" || m.Aliases["fast"] != "gpt-4o" {
		t.Fatalf("aliases not parsed faithfully: %+v", m.Aliases)
	}
}

// TestProjectModelsIgnoredWithWarn pins the operator-tier gate (ADR 0030): a
// project-tier models: block is IGNORED with a WARN (re-pointing a slot from a
// project repo is deferred to the allowlist-capped Layer-3 work).
func TestProjectModelsIgnoredWithWarn(t *testing.T) {
	var buf bytes.Buffer
	diag := slogdiag.New(&buf, false, port.LevelDebug)

	ws := &countingWS{Workspace: memfs.NewWorkspace("/repo")}
	ws.seed(t, projectFileMecatl, operatorModelsYAML)

	r := newWithEnv(Options{Conventional: true, TrustProject: true, Diagnostics: diag}, fakeEnv())
	_ = r.Resolve(context.Background(), ws)

	if r.OperatorModelSlots() != nil {
		t.Fatal("a PROJECT-tier models: block must NOT become operator models")
	}
	if log := buf.String(); !strings.Contains(log, "IGNORING a project-tier models") {
		t.Fatalf("expected an ignore-WARN naming the project tier; got:\n%s", log)
	}
}

// TestModelsStrictUnknownKeyRejected pins the strict parse (ADR 0030): a typo'd key
// inside the models: subtree is a parse error (so a binding map can't be silently
// dropped), surfaced through the per-file skip.
func TestModelsStrictUnknownKeyRejected(t *testing.T) {
	const bad = `
models:
  slotz:
    compaction: cheap
`
	if _, err := parseYAML([]byte(bad)); err == nil {
		t.Fatal("an unknown key inside models: must be a strict parse error")
	} else if !strings.Contains(err.Error(), "models") {
		t.Fatalf("error should name the models subtree; got %v", err)
	}
}
