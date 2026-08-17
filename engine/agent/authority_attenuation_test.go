package agent

import (
	"testing"

	"github.com/stacklok/mecatl/engine/governance"
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

func TestADR_0226_AuthorityAttenuation_Scenario3_DerivesBeforeRuntimeAcquisition(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, []string{"reviewer"}, 1, governance.AuthorityProfile{FileSystem: true, Isolated: true})
	child, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{delegate: "reviewer"})
	if err != nil || child.AllowsTool("Write") {
		t.Fatalf("derive child before resources: child=%v err=%v", child, err)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_EnvironmentPostureCannotWiden(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{Isolated: true})
	if _, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{directWrite: true}); err == nil {
		t.Fatal("shell-less/no-fs authority widened to direct-write")
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})
	child, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{})
	if err != nil || child.Contains(mustAuthority(t, []string{"Read"}, nil, 0, governance.AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true})) {
		t.Fatalf("read-only child retained direct-write authority: child=%v err=%v", child, err)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario3_RejectsEnvironmentMismatchBeforeResolve(t *testing.T) {
	t.Parallel()
	parent := mustAuthority(t, []string{"Read"}, nil, 1, governance.AuthorityProfile{Isolated: true})
	if _, err := deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{filesystem: true}); err == nil {
		t.Fatal("incompatible environment was admitted")
	}
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
