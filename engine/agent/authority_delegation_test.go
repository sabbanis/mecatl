package agent

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/team"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestADR_0226_AuthorityAttenuation_Scenario6_SubagentVariantsCannotWiden(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read", "Subagent"}, []string{"reviewer"}, 2, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	want, err := parent.Descend()
	if err != nil {
		t.Fatalf("Descend: %v", err)
	}

	for _, tc := range []struct {
		name     string
		args     subagentArgs
		writable bool
	}{
		{name: "fresh"},
		{name: "background", args: subagentArgs{Background: true}},
		{name: "named", args: subagentArgs{Agent: "reviewer"}},
		{name: "model_override", args: subagentArgs{Model: "fast"}},
		{name: "direct_write", args: subagentArgs{Mode: subagentModeReadWrite}, writable: true},
		{name: "fork_history", args: subagentArgs{Fork: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, result, ok := deriveRunChildAuthority(parentCaps{authority: func() (governance.Authority, error) { return parent, nil }}, false, tc.args, tc.writable, nil, "call")
			if !ok || result.IsError {
				t.Fatalf("deriveRunChildAuthority = %q", result.Content)
			}
			wantVariant := want
			if !tc.writable {
				wantVariant, err = want.WithoutDirectWrite()
				if err != nil {
					t.Fatalf("WithoutDirectWrite: %v", err)
				}
			}
			if !wantVariant.Equal(got) {
				t.Fatalf("authority = %v, want %v", got, wantVariant)
			}
		})
	}

	persisted := mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	if canonical := mustCanonicalAuthority(t, persisted); canonical == "" {
		t.Fatal("persisted child authority must be durable")
	}
}

func TestADR_0226_AuthorityAttenuation_ManagedDefinitionCeilingAttenuatesAtSelection(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read", "Write", subagentToolName}, []string{"reviewer"}, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	ceiling := mustCanonicalAuthority(t, mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true}))
	subagent := &SubagentTool{agentMeta: []AgentMeta{{Name: "reviewer", AuthorityCeiling: &ceiling}}}
	got, result, ok := deriveRunChildAuthority(parentCaps{authority: func() (governance.Authority, error) { return parent, nil }}, false, subagentArgs{Agent: "reviewer"}, false, subagent.agentAuthorityCeiling("reviewer"), "call")
	if !ok || result.IsError || got.AllowsTool("Write") {
		t.Fatalf("managed ceiling must attenuate selected child: authority=%v result=%q", got, result.Content)
	}

	invalid := "not an authority"
	_, result, ok = deriveRunChildAuthority(parentCaps{authority: func() (governance.Authority, error) { return parent, nil }}, false, subagentArgs{Agent: "reviewer"}, false, &invalid, "call")
	if ok || !result.IsError {
		t.Fatal("invalid managed ceiling must fail closed")
	}
	_, result, ok = deriveRunChildAuthority(parentCaps{}, false, subagentArgs{Agent: "reviewer"}, false, &invalid, "call")
	if ok || !result.IsError {
		t.Fatal("invalid managed ceiling must not bypass an unbound legacy parent")
	}
}

// TestADR_0226_AuthorityAttenuation_ResumeRejectsPersistedChildWidening proves
// that both resume paths reject a saved child whose immutable maximum is broader
// than the current parent before the child can run.
func TestADR_0226_AuthorityAttenuation_ResumeRejectsPersistedChildWidening(t *testing.T) {
	for _, background := range []bool{false, true} {
		name := "foreground"
		if background {
			name = "background"
		}
		t.Run(name, func(t *testing.T) {
			store := memstore.New()
			parentAuthority := mustAuthority(t, []string{"Read", subagentToolName}, nil, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
			childAuthority := mustAuthority(t, []string{"Read", "Write"}, nil, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true})
			childID := session.SessionID("subagent-parent-resume")
			child := session.New(childID, session.ModeDefault, "/ws", session.Limits{}, time.Now())
			if err := child.BindAuthority(mustCanonicalAuthority(t, childAuthority), ""); err != nil {
				t.Fatalf("BindAuthority: %v", err)
			}
			if err := child.Complete(); err != nil {
				t.Fatalf("Complete: %v", err)
			}
			if err := store.Save(context.Background(), child); err != nil {
				t.Fatalf("Save child: %v", err)
			}

			task := NewSubagentTool(authorityTestEngine(), WithSubagentStore(store))
			catalog := tool.NewCatalog()
			catalog.MustRegister(task)
			args := `{"resume":"subagent-parent-resume","prompt":"continue"}`
			if background {
				args = `{"resume":"subagent-parent-resume","prompt":"continue","background":true}`
			}
			parent := NewEngine(Deps{
				LLM: mockllm.New(
					mockllm.ToolCallTurn(session.NewToolCall("resume", subagentToolName, json.RawMessage(args))),
					mockllm.TextTurn("done"),
				),
				Catalog: catalog,
				Policy:  permpolicy.NewPolicy(permpolicy.AllowAllFloorRules(), nil),
			})
			parentSession := session.New("parent", session.ModeDefault, "/ws", session.Limits{}, time.Now())
			if err := parentSession.BindAuthority(mustCanonicalAuthority(t, parentAuthority), ""); err != nil {
				t.Fatalf("BindAuthority parent: %v", err)
			}

			run := parent.Run(context.Background(), parentSession, testEnvironment(memfs.NewWorkspace("/ws"), nil), RunRequest{Text: "go"})
			var result *session.ToolResult
			for event := range run.Events() {
				if event.Type == session.EvToolResult && event.ToolResult.CallID == "resume" {
					result = event.ToolResult
				}
			}
			if result == nil || !result.IsError || result.Content != "Subagent: resumed child authority exceeds the parent maximum; refusing delegation" {
				t.Fatalf("resume result = %+v", result)
			}
		})
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario6_ParallelAndTeamCannotWiden(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read", "Parallel", "Team"}, nil, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})

	branch, err := parallelChildAuthority(parent)
	if err != nil || branch.AllowsTool("Write") || !parent.Contains(branch) {
		t.Fatalf("parallel authority = %v, err = %v", branch, err)
	}

	write := &fakeOverlayTool{name: "Write"}
	read := &fakeOverlayTool{name: "Read"}
	sup := NewSupervisor(team.New("authority"), testEnvironment(memfs.NewWorkspace("/ws"), nil), func(MemberSpec, string) MemberBuild {
		return MemberBuild{Engine: authorityTestEngine(read, write)}
	}, WithTeamAuthority(parent))
	if err := sup.AddMember(context.Background(), MemberSpec{Name: "lead", Lead: true}); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	member := sup.members["lead"]
	bound, _, legacy := member.sess.AuthorityBound()
	if legacy || bound == "" {
		t.Fatalf("team member authority = %q, legacy = %t", bound, legacy)
	}
	request := member.engine.startRun(context.Background(), member.sess, RunRequest{}, func(context.Context, *Run) {})
	specs := member.engine.buildRequest(context.Background(), request, member.sess, member.env).Tools
	if names := authorityToolNames(specs); !sameAuthorityToolNames(names, []string{"Read"}) {
		t.Fatalf("team member disclosed tools %v, want [Read]", names)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario6_DirectTeamsHaveOnlyStructuralCoordinationAuthorityAndAreNotResumable(t *testing.T) {
	t.Parallel()
	tm := team.New("direct")
	write := &fakeOverlayTool{name: "Write"}
	coordination := MemberTools(tm, "lead", nil)
	authorizedNames := MemberToolNames()
	toolNames := make([]string, 0, len(authorizedNames))
	for name := range authorizedNames {
		toolNames = append(toolNames, name)
	}
	directAuthority := mustAuthority(t, toolNames, nil, 1, governance.AuthorityProfile{})
	tools := append([]tool.Tool{write}, coordination...)
	sup := NewSupervisor(tm, testEnvironment(memfs.NewWorkspace("/ws"), nil), func(MemberSpec, string) MemberBuild {
		return MemberBuild{Engine: authorityTestEngine(tools...)}
	}, WithTeamAuthority(directAuthority))
	if err := sup.AddMember(context.Background(), MemberSpec{Name: "lead", Lead: true}); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	member := sup.members["lead"]
	run := member.engine.startRun(context.Background(), member.sess, RunRequest{}, func(context.Context, *Run) {})
	specs := member.engine.buildRequest(context.Background(), run, member.sess, member.env).Tools
	if names := authorityToolNames(specs); !sameAuthorityToolNames(names, toolNames) {
		t.Fatalf("direct team advertised tools %v, want coordination tools %v", names, toolNames)
	}
	if _, ok := member.engine.lookupTool(run, "Write"); ok {
		t.Fatal("direct team executed an ordinary tool")
	}
	if _, ok := member.engine.lookupTool(run, "RecordFinding"); !ok {
		t.Fatal("direct team coordination tool was unauthorized")
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario5_ManagedLocalDefinitionNarrowsChild(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read", "Write", subagentToolName, teamToolName}, []string{"reviewer"}, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	ceiling := mustCanonicalAuthority(t, mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true}))
	const identity = "explicit:reviewer"

	subagent := &SubagentTool{agentMeta: []AgentMeta{{Name: "reviewer", AuthorityCeiling: &ceiling, DefinitionIdentity: identity}}}
	child, result, ok := deriveRunChildAuthority(parentCaps{authority: func() (governance.Authority, error) { return parent, nil }}, false, subagentArgs{Agent: "reviewer"}, false, subagent.agentAuthorityCeiling("reviewer"), "call")
	if !ok || result.IsError || child.AllowsTool("Write") {
		t.Fatalf("named subagent authority=%v result=%q, want managed ceiling to remove Write", child, result.Content)
	}

	read, write := &fakeOverlayTool{name: "Read"}, &fakeOverlayTool{name: "Write"}
	sup := NewSupervisor(team.New("managed"), testEnvironment(memfs.NewWorkspace("/ws"), nil), func(MemberSpec, string) MemberBuild {
		return MemberBuild{Engine: authorityTestEngine(read, write), AuthorityCeiling: &ceiling, DefinitionIdentity: identity}
	}, WithTeamAuthority(parent))
	if err := sup.AddMember(context.Background(), MemberSpec{Name: "reviewer", AgentType: "reviewer", Lead: true}); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	bound, gotIdentity, legacy := sup.members["reviewer"].sess.AuthorityBound()
	if legacy || gotIdentity != identity {
		t.Fatalf("team member identity=%q legacy=%t, want %q and bound", gotIdentity, legacy, identity)
	}
	memberAuthority, err := governance.ParseAuthority(bound)
	if err != nil || memberAuthority.AllowsTool("Write") {
		t.Fatalf("team member authority=%q err=%v, want managed ceiling to remove Write", bound, err)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario5_DefinitionCeilingPresenceIsPreserved(t *testing.T) {
	t.Parallel()
	empty := ""
	for _, tc := range []struct {
		name string
		def  tool.AgentDef
		want *string
	}{
		{name: "absent", def: tool.AgentDef{Name: "reviewer", Origin: tool.AgentOriginExplicit}},
		{name: "present_empty", def: tool.AgentDef{Name: "reviewer", Origin: tool.AgentOriginExplicit, AuthorityCeiling: &empty}, want: &empty},
		{name: "driver", def: tool.AgentDef{Name: "reviewer", Origin: tool.AgentOriginDriver, AuthorityCeiling: &empty}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.def.ManagedAuthorityCeiling()
			if (got == nil) != (tc.want == nil) || got != nil && *got != *tc.want {
				t.Fatalf("ManagedAuthorityCeiling()=%v, want %v", got, tc.want)
			}
		})
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged(t *testing.T) {
	t.Parallel()
	ceiling := mustCanonicalAuthority(t, mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true}))
	remote := tool.AgentDef{Name: "reviewer", Origin: tool.AgentOriginDriver, AuthorityCeiling: &ceiling}
	if got := remote.ManagedAuthorityCeiling(); got != nil {
		t.Fatalf("driver ceiling=%q, want no managed ceiling", *got)
	}
	profile := AgentMeta{Name: "reviewer"}
	if got := profile.AuthorityCeiling; got != nil {
		t.Fatalf("remote profile ceiling=%q, want nil", *got)
	}
}

func mustCanonicalAuthority(t *testing.T, authority governance.Authority) string {
	t.Helper()
	canonical, err := authority.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	return canonical
}
