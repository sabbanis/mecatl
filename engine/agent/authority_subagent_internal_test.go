package agent

import (
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func subagentAuthorityForTest(t *testing.T, tools, delegates []string, depth int, profile governance.AuthorityProfile) governance.Authority {
	t.Helper()
	authority, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools: tools, Delegates: delegates, MaxDelegationDepth: depth, Profile: profile,
	})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	return authority
}

func TestAuthorityAttenuation_AllSubagentVariantsDeriveBeforeAcquisition(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read", "Subagent"}, []string{"reviewer"}, 1,
		governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	definition := subagentAuthorityForTest(t, []string{"Read", "Bash"}, []string{"reviewer"}, 1,
		governance.AuthorityProfile{FileSystem: true, Isolated: true})

	for _, tc := range []struct {
		name string
		args subagentArgs
		def  *tool.AgentAuthorityCeiling
	}{
		{name: "plain"},
		{name: "named", args: subagentArgs{Agent: "reviewer"}, def: authorityCeilingPtr(t, definition)},
		{name: "fork", args: subagentArgs{Fork: true}},
		{name: "background", args: subagentArgs{Background: true}},
		{name: "writable", args: subagentArgs{Mode: subagentModeReadWrite}},
		{name: "model_override", args: subagentArgs{Model: "fast"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := childAuthorityFor(parent, tc.def, tc.args)
			if err != nil {
				t.Fatalf("childAuthorityFor: %v", err)
			}
			want := parent
			if tc.def != nil {
				definitionAuthority, parseErr := governance.ParseAuthority(string(*tc.def))
				if parseErr != nil {
					t.Fatalf("ParseAuthority: %v", parseErr)
				}
				want, err = DeriveChildAuthority(parent, definitionAuthority, governance.UnrestrictedAuthority())
				if err != nil {
					t.Fatalf("DeriveChildAuthority: %v", err)
				}
			}
			want, err = want.Descend()
			if err != nil {
				t.Fatalf("Descend: %v", err)
			}
			if !got.Equal(want) {
				gotWire, _ := got.Canonical()
				wantWire, _ := want.Canonical()
				t.Fatalf("authority = %s, want %s", gotWire, wantWire)
			}
		})
	}
}

func TestAuthorityAttenuation_ParentCapsUsesSessionBound(t *testing.T) {
	engineRoot := subagentAuthorityForTest(t, []string{"Read", "Write", "Subagent"}, nil, 2,
		governance.AuthorityProfile{FileSystem: true, DirectWrite: true})
	parentBound := subagentAuthorityForTest(t, []string{"Read", "Subagent"}, nil, 1,
		governance.AuthorityProfile{FileSystem: true})
	e := NewEngine(Deps{Authority: engineRoot})
	sess := session.New("parent", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))
	bound, err := parentBound.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	if err := sess.BindAuthority(bound, "root"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}

	got, err := e.parentCaps(&Run{}, sess, 0).authority()
	if err != nil {
		t.Fatalf("parent authority: %v", err)
	}
	if !got.Equal(parentBound) {
		gotWire, _ := got.Canonical()
		wantWire, _ := parentBound.Canonical()
		t.Fatalf("parent authority = %s, want session bound %s", gotWire, wantWire)
	}
}

func TestAuthorityAttenuation_FreshChildSessionIsBoundBeforeExecution(t *testing.T) {
	authority := subagentAuthorityForTest(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{FileSystem: true})
	subagentTool := &SubagentTool{childEngine: NewEngine(Deps{})}
	child, result, ok := subagentTool.buildChildSession("call", "child", nil, "/ws", session.Limits{}, authority, "reviewer", nil)
	if !ok {
		t.Fatalf("buildChildSession: %s", result.Content)
	}
	got, identity, compatibilityOnly := child.AuthorityBound()
	want, err := authority.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	if got != want || identity != "reviewer" || compatibilityOnly {
		t.Fatalf("child authority = (%q, %q, legacy=%t), want (%q, reviewer, false)", got, identity, compatibilityOnly, want)
	}
}

func authorityCeilingPtr(t *testing.T, authority governance.Authority) *tool.AgentAuthorityCeiling {
	t.Helper()
	canonical, err := authority.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	ceiling := tool.AgentAuthorityCeiling(canonical)
	return &ceiling
}

func TestAuthorityAttenuation_OmittedDefinitionInheritsAndMalformedDefinitionDenies(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read", "Subagent"}, nil, 1,
		governance.AuthorityProfile{FileSystem: true})

	got, err := childAuthorityFor(parent, nil, subagentArgs{})
	if err != nil {
		t.Fatalf("omitted definition ceiling: %v", err)
	}
	want, err := parent.Descend()
	if err != nil {
		t.Fatalf("Descend: %v", err)
	}
	if !got.Equal(want) {
		gotWire, _ := got.Canonical()
		wantWire, _ := want.Canonical()
		t.Fatalf("omitted definition authority = %s, want parent-derived %s", gotWire, wantWire)
	}

	malformed := tool.AgentAuthorityCeiling("")
	if _, err := childAuthorityFor(parent, &malformed, subagentArgs{Agent: "reviewer"}); err == nil {
		t.Fatal("malformed definition ceiling was accepted")
	}
}

func TestAuthorityAttenuation_WideningFailsBeforeResourceAcquisition(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read", "Subagent"}, []string{"reviewer"}, 1,
		governance.AuthorityProfile{FileSystem: true})

	for _, tc := range []struct {
		name string
		args subagentArgs
		def  *tool.AgentAuthorityCeiling
	}{
		{name: "unknown_delegate", args: subagentArgs{Agent: "deployer"}},
		{name: "fork_without_isolation", args: subagentArgs{Fork: true}},
		{name: "direct_write", args: subagentArgs{Mode: "read-write"}},
		{name: "exhausted_depth", args: subagentArgs{}, def: authorityCeilingPtr(t, subagentAuthorityForTest(t, []string{"Read"}, []string{"reviewer"}, 0, governance.AuthorityProfile{FileSystem: true}))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := childAuthorityFor(parent, tc.def, tc.args); err == nil {
				t.Fatal("child authority widening was accepted before a child resource could be acquired")
			}
		})
	}
}
