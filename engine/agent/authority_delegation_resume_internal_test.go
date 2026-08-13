package agent

import (
	"testing"

	"github.com/stacklok/mecatl/engine/governance"
)

func authorityForTest(t *testing.T, tools, delegates []string, depth int, profile governance.AuthorityProfile) governance.Authority {
	t.Helper()
	authority, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools: tools, Delegates: delegates, MaxDelegationDepth: depth, Profile: profile,
	})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	return authority
}

func TestAuthorityAttenuation_ParallelBranchesCannotWiden(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read", "Parallel"}, nil, 2, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	got, err := parallelChildAuthority(parent)
	if err != nil {
		t.Fatalf("parallelChildAuthority: %v", err)
	}
	if got.Contains(authorityForTest(t, []string{"Bash"}, nil, 0, governance.AuthorityProfile{})) {
		t.Fatal("parallel branch gained parent-excluded Bash")
	}
}

func TestAuthorityAttenuation_TeamLeadAndMembersCannotWiden(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read", "Team"}, nil, 2, governance.AuthorityProfile{FileSystem: true})
	for _, role := range []string{"lead", "member"} {
		t.Run(role, func(t *testing.T) {
			got, err := teamChildAuthority(parent)
			if err != nil {
				t.Fatalf("teamChildAuthority: %v", err)
			}
			if got.Contains(authorityForTest(t, []string{"Write"}, nil, 0, governance.AuthorityProfile{})) {
				t.Fatal("team child gained parent-excluded Write")
			}
		})
	}
}

func TestAuthorityAttenuation_RunTeamDerivesCompatibilityRoot(t *testing.T) {
	root := subagentAuthorityForTest(t, []string{"Read", "Team"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	got, err := teamChildAuthority(root)
	if err != nil {
		t.Fatalf("teamChildAuthority: %v", err)
	}
	if got.Contains(authorityForTest(t, []string{"Bash"}, nil, 0, governance.AuthorityProfile{})) {
		t.Fatal("RunTeam compatibility root widened to Bash")
	}
}

func TestAuthorityAttenuation_ResumeUsesPersistedChildBound(t *testing.T) {
	persisted := subagentAuthorityForTest(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	got, err := resumedChildAuthority(persisted, governance.UnrestrictedAuthority())
	if err != nil {
		t.Fatalf("resumedChildAuthority: %v", err)
	}
	if got.Contains(authorityForTest(t, []string{"Bash"}, nil, 0, governance.AuthorityProfile{})) {
		t.Fatal("resume used ambient authority instead of persisted child bound")
	}
}

func TestAuthorityAttenuation_ResumeAppliesOperatorRevocationOnlyAsNarrowing(t *testing.T) {
	persisted := subagentAuthorityForTest(t, []string{"Read", "Grep"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	revocation := subagentAuthorityForTest(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	got, err := resumedChildAuthority(persisted, revocation)
	if err != nil {
		t.Fatalf("resumedChildAuthority: %v", err)
	}
	if got.Contains(authorityForTest(t, []string{"Grep"}, nil, 0, governance.AuthorityProfile{})) {
		t.Fatal("operator revocation did not narrow resumed authority")
	}
}

func TestAuthorityAttenuation_ResumeRequestCannotUpgradeAuthority(t *testing.T) {
	persisted := subagentAuthorityForTest(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{FileSystem: true})
	request := subagentAuthorityForTest(t, []string{"Read", "Write"}, nil, 1, governance.AuthorityProfile{FileSystem: true, DirectWrite: true})
	got, err := resumedChildAuthority(persisted, request)
	if err != nil {
		t.Fatalf("resumedChildAuthority: %v", err)
	}
	if got.Contains(request) {
		t.Fatal("resume request upgraded persisted authority")
	}
}

func TestAuthorityAttenuation_ForeignResumeRemainsAbsent(t *testing.T) {
	if _, err := persistedChildAuthority(""); err == nil {
		t.Fatal("missing persisted authority was accepted")
	}
}

func TestAuthorityAttenuation_ChildBoundPersistenceIsParentBoundAndMonotonic(t *testing.T) {
	parent := subagentAuthorityForTest(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	child, err := parallelChildAuthority(parent)
	if err != nil {
		t.Fatalf("parallelChildAuthority: %v", err)
	}
	if !parent.Contains(child) {
		t.Fatal("persisted child bound is not parent-bounded")
	}
	if _, err := resumedChildAuthority(child, parent); err != nil {
		t.Fatalf("monotonic resume bound: %v", err)
	}
}

func TestAuthorityAttenuation_LiveRevocationIsNotPersistedAsGrant(t *testing.T) {
	persisted := subagentAuthorityForTest(t, []string{"Read", "Grep"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	revoked := subagentAuthorityForTest(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true})
	if _, err := resumedChildAuthority(persisted, revoked); err != nil {
		t.Fatalf("revoked resume: %v", err)
	}
	got, err := resumedChildAuthority(persisted, governance.UnrestrictedAuthority())
	if err != nil {
		t.Fatalf("later resume: %v", err)
	}
	if !got.Equal(persisted) {
		t.Fatal("live revocation was persisted as a new authority grant")
	}
}
