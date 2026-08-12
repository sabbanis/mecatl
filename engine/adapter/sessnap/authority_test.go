package sessnap_test

import (
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
)

func TestAuthorityAttenuation_LegacySnapshotIsExplicitlyCompatibilityOnly(t *testing.T) {
	t.Parallel()

	legacy := sessnap.Snapshot{
		ID:        "legacy-child",
		State:     session.StateIdle,
		Mode:      session.ModeDefault,
		CreatedAt: time.Unix(1, 0).UTC(),
	}
	restored, err := legacy.Restore()
	if err != nil {
		t.Fatalf("Restore legacy snapshot: %v", err)
	}
	bound, definition, compatibilityOnly := restored.AuthorityBound()
	if !compatibilityOnly {
		t.Fatal("legacy snapshot must be explicitly marked compatibility-only")
	}
	if bound != "" || definition != "" {
		t.Fatalf("legacy authority = %q, definition = %q; want no v1 bound", bound, definition)
	}
}

func TestAuthorityAttenuation_NewChildPersistsBoundBeforeExecution(t *testing.T) {
	t.Parallel()

	authority, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools:              []string{"Read"},
		Delegates:          []string{"reviewer"},
		MaxDelegationDepth: 1,
		Profile:            governance.AuthorityProfile{FileSystem: true, Isolated: true},
	})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	bound, err := authority.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}

	child := session.New("child", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(1, 0).UTC())
	if err := child.BindAuthority(bound, "operator:reviewer"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	snapshot, err := sessnap.Of(child)
	if err != nil {
		t.Fatalf("sessnap.Of: %v", err)
	}
	if snapshot.Authority != bound || snapshot.DefinitionIdentity != "operator:reviewer" || snapshot.AuthorityCompatibilityOnly {
		t.Fatalf("snapshot authority = %+v; want bound and non-legacy marker", snapshot)
	}

	restored, err := snapshot.Restore()
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	got, definition, compatibilityOnly := restored.AuthorityBound()
	if got != bound || definition != "operator:reviewer" || compatibilityOnly {
		t.Fatalf("restored authority = %q, %q, compatibilityOnly=%v", got, definition, compatibilityOnly)
	}
}
