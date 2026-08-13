package agent_test

import (
	"testing"

	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
)

func authorityForTest(t *testing.T, tools, delegates []string, depth int, profile governance.AuthorityProfile) governance.Authority {
	t.Helper()
	a, err := governance.NewAuthority(governance.AuthoritySpec{Tools: tools, Delegates: delegates, MaxDelegationDepth: depth, Profile: profile})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	return a
}

func TestAuthorityAttenuation_ChildIsThreeWayIntersection(t *testing.T) {
	parent := authorityForTest(t, []string{"Read", "Grep", "Write"}, []string{"reviewer", "writer"}, 3, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	definition := authorityForTest(t, []string{"Read", "Write"}, []string{"writer"}, 2, governance.AuthorityProfile{FileSystem: true, DirectWrite: true})
	call := authorityForTest(t, []string{"Read"}, []string{"writer"}, 1, governance.AuthorityProfile{FileSystem: true})

	got, err := agent.DeriveChildAuthority(parent, definition, call)
	if err != nil {
		t.Fatalf("DeriveChildAuthority: %v", err)
	}
	want := authorityForTest(t, []string{"Read"}, []string{"writer"}, 1, governance.AuthorityProfile{FileSystem: true})
	if !want.Equal(got) {
		gotWire, _ := got.Canonical()
		wantWire, _ := want.Canonical()
		t.Fatalf("child authority = %s, want %s", gotWire, wantWire)
	}
}

func TestAuthorityAttenuation_DelegateAndDepthCannotWiden(t *testing.T) {
	parent := authorityForTest(t, []string{"Read"}, []string{"reviewer"}, 1, governance.AuthorityProfile{FileSystem: true})
	widening := authorityForTest(t, []string{"Read"}, []string{"reviewer", "writer"}, 2, governance.AuthorityProfile{FileSystem: true})
	got, err := agent.DeriveChildAuthority(parent, governance.UnrestrictedAuthority(), widening)
	if err != nil {
		t.Fatalf("DeriveChildAuthority: %v", err)
	}
	gotWire, _ := got.Canonical()
	if gotWire != `{"v":1,"kind":"restricted","tools":["Read"],"delegates":["reviewer"],"depth":1,"profile":{"filesystem":true,"direct_write":false,"isolated":false}}` {
		t.Fatalf("child widened delegates/depth: %s", gotWire)
	}
}

func TestAuthorityAttenuation_ProfileCannotEscalate(t *testing.T) {
	parent := authorityForTest(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{FileSystem: true})
	widening := authorityForTest(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	got, err := agent.DeriveChildAuthority(parent, governance.UnrestrictedAuthority(), widening)
	if err != nil {
		t.Fatalf("DeriveChildAuthority: %v", err)
	}
	gotWire, _ := got.Canonical()
	if gotWire != `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":false}}` {
		t.Fatalf("child profile escalated: %s", gotWire)
	}
}
