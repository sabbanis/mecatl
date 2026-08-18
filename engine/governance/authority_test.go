package governance

import (
	"strings"
	"testing"
)

func TestGovernanceAuthorityCanonicalizationAndIntersection(t *testing.T) {
	t.Parallel()

	parent, err := NewAuthority(AuthoritySpec{
		Tools:              []string{"Grep", "Read", "Grep"},
		Delegates:          []string{"reviewer", "reviewer"},
		MaxDelegationDepth: 2,
		Profile:            AuthorityProfile{FileSystem: true, DirectWrite: false, Isolated: true},
	})
	if err != nil {
		t.Fatalf("NewAuthority(parent): %v", err)
	}
	canonical, err := parent.Canonical()
	if err != nil {
		t.Fatalf("Canonical(parent): %v", err)
	}
	if want := `{"v":1,"kind":"restricted","tools":["Grep","Read"],"delegates":["reviewer"],"depth":2,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`; canonical != want {
		t.Fatalf("canonical = %s, want %s", canonical, want)
	}

	equivalent, err := ParseAuthority(`{"profile":{"isolated":true,"direct_write":false,"filesystem":true},"depth":2,"delegates":["reviewer"],"tools":["Read","Grep"],"kind":"restricted","v":1}`)
	if err != nil {
		t.Fatalf("ParseAuthority(equivalent): %v", err)
	}
	if !parent.Contains(equivalent) || !equivalent.Contains(parent) {
		t.Fatal("equivalent authorities must contain each other")
	}

	ceiling, err := NewAuthority(AuthoritySpec{
		Tools:              []string{"Read", "Bash"},
		Delegates:          []string{"reviewer", "deployer"},
		MaxDelegationDepth: 1,
		Profile:            AuthorityProfile{FileSystem: true, DirectWrite: true, Isolated: true},
	})
	if err != nil {
		t.Fatalf("NewAuthority(ceiling): %v", err)
	}
	child, err := parent.Intersect(ceiling)
	if err != nil {
		t.Fatalf("Intersect: %v", err)
	}
	if got, err := child.Canonical(); err != nil || got != `{"v":1,"kind":"restricted","tools":["Read"],"delegates":["reviewer"],"depth":1,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}` {
		t.Fatalf("child canonical = %q, %v", got, err)
	}
	if !parent.Contains(child) || !ceiling.Contains(child) {
		t.Fatal("intersection must be contained by both inputs")
	}
	if child.Contains(parent) || child.Contains(ceiling) {
		t.Fatal("intersection must not broaden into either input")
	}

	for _, raw := range []string{
		`{"v":2,"kind":"restricted","tools":[],"delegates":[],"depth":0,"profile":{"filesystem":false,"direct_write":false,"isolated":false}}`,
		`{"v":1,"kind":"restricted","tools":["Read "],"delegates":[],"depth":0,"profile":{"filesystem":false,"direct_write":false,"isolated":false}}`,
		`{"v":1,"kind":"restricted","tools":[],"delegates":[],"depth":0,"profile":{"filesystem":false,"direct_write":false,"isolated":false},"unknown":true}`,
	} {
		if _, err := ParseAuthority(raw); err == nil {
			t.Errorf("ParseAuthority(%s) succeeded; want fail-closed rejection", raw)
		}
	}

	none := NoneAuthority()
	empty, err := NewAuthority(AuthoritySpec{})
	if err != nil {
		t.Fatalf("NewAuthority(empty): %v", err)
	}
	unrestricted := UnrestrictedAuthority()
	if none.Equal(empty) || empty.Equal(unrestricted) || none.Equal(unrestricted) {
		t.Fatal("none, empty, and unrestricted must remain distinct")
	}
	if _, err := none.Intersect(unrestricted); err == nil {
		t.Fatal("none authority must fail closed during intersection")
	}
	if unrestricted.Contains(none) || empty.Contains(unrestricted) {
		t.Fatal("none and unrestricted must not silently broaden containment")
	}
	if _, err := ParseAuthority(strings.Replace(canonical, `"Read"`, `"Read "`, 1)); err == nil {
		t.Fatal("non-canonical name must be rejected")
	}
}
