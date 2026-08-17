package agent

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestADR_0226_AuthorityAttenuation_Scenario2_RebuildCannotGrantNewTool(t *testing.T) {
	t.Parallel()
	bound := mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	if bound.AllowsTool("PublishedLater") {
		t.Fatal("persisted authority granted a later tool")
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario2_LiveRevocationRecheckedBeforeDispatch(t *testing.T) {
	t.Parallel()
	bound := mustAuthority(t, []string{"Read", "Write"}, nil, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	revoked := mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	effective, err := bound.Intersect(revoked)
	if err != nil || effective.AllowsTool("Write") || !bound.AllowsTool("Write") {
		t.Fatalf("live revocation must be transient: effective=%v err=%v", effective, err)
	}
}

type authorityCountingForker struct{ calls int }

func (f *authorityCountingForker) Fork(_ context.Context, env tool.Environment, _ string) (tool.Environment, func() error, string, error) {
	f.calls++
	return env, func() error { return nil }, "", nil
}

func TestADR_0226_AuthorityAttenuation_Scenario3_DerivesBeforeRuntimeAcquisition(t *testing.T) {
	parent := mustAuthority(t, []string{subagentToolName}, nil, 2, governance.AuthorityProfile{FileSystem: true})
	forker := &authorityCountingForker{}
	task := NewSubagentTool(authorityTestEngine(), WithChildForker(forker)).(*SubagentTool)
	result, err := task.run(context.Background(), session.NewToolCall("call", subagentToolName, json.RawMessage(`{"prompt":"review"}`)), testEnvironment(memfs.NewWorkspace("/ws"), nil), nil, parentCaps{authority: func() (governance.Authority, error) { return parent, nil }})
	if err != nil || !result.IsError || forker.calls != 0 {
		t.Fatalf("result=%+v err=%v fork calls=%d, want preflight rejection before runtime acquisition", result, err, forker.calls)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_EnvironmentPostureCannotWiden(t *testing.T) {
	for _, authority := range []governance.Authority{
		mustAuthority(t, []string{subagentToolName}, nil, 2, governance.AuthorityProfile{}),
		mustAuthority(t, []string{subagentToolName}, nil, 2, governance.AuthorityProfile{FileSystem: true}),
	} {
		forker := &authorityCountingForker{}
		task := NewSubagentTool(authorityTestEngine(), WithChildForker(forker)).(*SubagentTool)
		result, err := task.run(context.Background(), session.NewToolCall("call", subagentToolName, json.RawMessage(`{"prompt":"review"}`)), testEnvironment(memfs.NewWorkspace("/ws"), nil), nil, parentCaps{authority: func() (governance.Authority, error) { return authority, nil }})
		if err != nil || !result.IsError || forker.calls != 0 {
			t.Fatalf("result=%+v err=%v fork calls=%d, want posture rejection before forking", result, err, forker.calls)
		}
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable(t *testing.T) {
	store := scenario3ChildStore(t, mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true}), "/ws")
	views := 0
	task := NewSubagentTool(authorityTestEngine(), WithSubagentStore(store), WithWritableChildEngine(authorityTestEngine()), WithSharedChildWorkspace(func(string) tool.Workspace { views++; return memfs.NewWorkspace("/ws") })).(*SubagentTool)
	parent := mustAuthority(t, []string{subagentToolName}, nil, 2, governance.AuthorityProfile{FileSystem: true, DirectWrite: true})
	result, err := task.run(context.Background(), session.NewToolCall("call", subagentToolName, json.RawMessage(`{"resume":"subagent-child","prompt":"continue","mode":"read-write"}`)), testEnvironment(memfs.NewWorkspace("/ws"), nil), nil, parentCaps{authority: func() (governance.Authority, error) { return parent, nil }})
	if err != nil || !result.IsError || views != 0 {
		t.Fatalf("result=%+v err=%v views=%d, want read-only resume rejected before writable workspace selection", result, err, views)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_RejectsEnvironmentMismatchBeforeResolve(t *testing.T) {
	store := scenario3ChildStore(t, mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{}), "")
	forker := &authorityCountingForker{}
	task := NewSubagentTool(authorityTestEngine(), WithSubagentStore(store), WithChildForker(forker)).(*SubagentTool)
	parent := mustAuthority(t, []string{subagentToolName}, nil, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	result, err := task.run(context.Background(), session.NewToolCall("call", subagentToolName, json.RawMessage(`{"resume":"subagent-child","prompt":"continue"}`)), testEnvironment(memfs.NewWorkspace("/ws"), nil), nil, parentCaps{authority: func() (governance.Authority, error) { return parent, nil }})
	if err != nil || !result.IsError || forker.calls != 0 {
		t.Fatalf("result=%+v err=%v fork calls=%d, want mismatch rejected before resolver/forker acquisition", result, err, forker.calls)
	}
}

func scenario3ChildStore(t *testing.T, authority governance.Authority, workspace string) *memstore.Store {
	t.Helper()
	store := memstore.New()
	child := session.New("subagent-child", session.ModeDefault, workspace, session.Limits{}, time.Now())
	if err := child.BindAuthority(mustCanonicalAuthority(t, authority), ""); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	if err := child.Complete(); err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if err := store.Save(context.Background(), child); err != nil {
		t.Fatalf("Save: %v", err)
	}
	return store
}

func TestADR_0226_AuthorityAttenuation_Scenario4_ChildIsMonotonicIntersection(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	ceiling := mustAuthority(t, []string{"Read", "Write"}, []string{"reviewer", "other"}, 4, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	child, err := deriveChildAuthority(parent, ceiling, childAuthorityRequest{delegate: "reviewer"})
	if err != nil || child.AllowsTool("Write") || child.Contains(parent) {
		t.Fatalf("child widened parent: child=%v err=%v", child, err)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario4_ExcludedOrUnknownToolCannotBeDisclosedOrDispatched(t *testing.T) {
	t.Parallel()
	bound := mustAuthority(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{})
	if bound.AllowsTool("Write") || bound.AllowsTool("forged") {
		t.Fatal("excluded tool is authorized")
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario4_DefinitionAndDepthCannotWiden(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 0, governance.AuthorityProfile{})
	if _, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{delegate: "other"}); err == nil {
		t.Fatal("unknown delegate admitted")
	}
	if _, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{delegate: "reviewer"}); err == nil {
		t.Fatal("exhausted depth admitted")
	}
}

func mustAuthority(t *testing.T, tools, delegates []string, depth int, profile governance.AuthorityProfile) governance.Authority {
	t.Helper()
	a, err := governance.NewAuthority(governance.AuthoritySpec{Tools: tools, Delegates: delegates, MaxDelegationDepth: depth, Profile: profile})
	if err != nil {
		t.Fatal(err)
	}
	return a
}
