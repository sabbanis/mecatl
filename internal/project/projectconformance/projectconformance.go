// Package projectconformance provides shared conformance tests for Project
// stores. It exercises only the backend-neutral project.Store contract.
package projectconformance

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/project"
)

// Run executes the Project-store contract against a fresh store factory.
func Run(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	t.Run("create is create-only and isolates values", func(t *testing.T) { runCreate(t, newStore) })
	t.Run("replace and delete use revision CAS", func(t *testing.T) { runRevisionCAS(t, newStore) })
	t.Run("concurrent replacements have one winner", func(t *testing.T) { runConcurrentReplace(t, newStore) })
	t.Run("owner-scoped reads and mutations hide foreign records", func(t *testing.T) { runOwnershipScope(t, newStore) })
	t.Run("page filters before ordering and keyset formation", func(t *testing.T) { runPage(t, newStore) })
	t.Run("cancelled context does not mutate", func(t *testing.T) { runCancelledContext(t, newStore) })
}

func runCreate(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	ctx := context.Background()
	store := newStore(t)
	want := fixture("one", nil, time.Unix(1_700_000_000, 0))
	if err := store.Create(ctx, want); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := store.Create(ctx, want); !errors.Is(err, project.ErrAlreadyExists) {
		t.Fatalf("second Create = %v, want ErrAlreadyExists", err)
	}
	got, err := store.Load(ctx, want.ID, project.Ownership{})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	got.Name = "changed"
	got.Owner = &session.Principal{Issuer: "other", Subject: "other"}
	again, err := store.Load(ctx, want.ID, project.Ownership{})
	if err != nil {
		t.Fatalf("Load again: %v", err)
	}
	if again.Name != want.Name || again.Owner != nil {
		t.Fatalf("store aliased loaded Project: %#v", again)
	}
}

func runRevisionCAS(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	ctx := context.Background()
	store := newStore(t)
	original := fixture("cas", nil, time.Unix(1_700_000_000, 0))
	if err := store.Create(ctx, original); err != nil {
		t.Fatalf("Create: %v", err)
	}
	replacement := original
	replacement.Name = "replacement"
	replacement.Revision = 2
	replacement.UpdatedAt = original.UpdatedAt.Add(time.Second)
	updated, err := store.Replace(ctx, replacement, original.Revision, project.Ownership{})
	if err != nil {
		t.Fatalf("Replace: %v", err)
	}
	if updated.Revision != 2 || updated.Name != replacement.Name {
		t.Fatalf("Replace = %#v", updated)
	}
	if _, err := store.Replace(ctx, replacement, original.Revision, project.Ownership{}); !errors.Is(err, project.ErrConflict) {
		t.Fatalf("stale Replace = %v, want ErrConflict", err)
	}
	stored, err := store.Load(ctx, original.ID, project.Ownership{})
	if err != nil || stored.Name != replacement.Name || stored.Revision != 2 {
		t.Fatalf("stale Replace changed record: %#v, %v", stored, err)
	}
	if err := store.Delete(ctx, original.ID, original.Revision, project.Ownership{}); !errors.Is(err, project.ErrConflict) {
		t.Fatalf("stale Delete = %v, want ErrConflict", err)
	}
	if err := store.Delete(ctx, original.ID, updated.Revision, project.Ownership{}); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Load(ctx, original.ID, project.Ownership{}); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("Load deleted = %v, want ErrNotFound", err)
	}
}

func runConcurrentReplace(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	ctx := context.Background()
	store := newStore(t)
	original := fixture("concurrent", nil, time.Unix(1_700_000_000, 0))
	if err := store.Create(ctx, original); err != nil {
		t.Fatalf("Create: %v", err)
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for _, name := range []string{"first", "second"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			candidate := original
			candidate.Name = name
			candidate.Revision = original.Revision + 1
			candidate.UpdatedAt = original.UpdatedAt.Add(time.Second)
			<-start
			_, err := store.Replace(ctx, candidate, original.Revision, project.Ownership{})
			results <- err
		}(name)
	}
	close(start)
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		if err == nil {
			wins++
		} else if !errors.Is(err, project.ErrConflict) {
			t.Fatalf("concurrent Replace = %v, want ErrConflict", err)
		}
	}
	if wins != 1 {
		t.Fatalf("concurrent Replace successes = %d, want 1", wins)
	}
}

func runOwnershipScope(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	ctx := context.Background()
	store := newStore(t)
	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	foreign := &session.Principal{Issuer: "issuer", Subject: "foreign"}
	item := fixture("owned", owner, time.Unix(1_700_000_000, 0))
	if err := store.Create(ctx, item); err != nil {
		t.Fatalf("Create: %v", err)
	}

	foreignScope := project.Ownership{Enforced: true, Owner: foreign}
	if _, err := store.Load(ctx, item.ID, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Load = %v, want ErrNotFound", err)
	}
	replacement := item
	replacement.Name = "foreign replacement"
	replacement.Revision++
	replacement.UpdatedAt = replacement.UpdatedAt.Add(time.Second)
	if _, err := store.Replace(ctx, replacement, item.Revision, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Replace = %v, want ErrNotFound", err)
	}
	if err := store.Delete(ctx, item.ID, item.Revision, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Delete = %v, want ErrNotFound", err)
	}

	ownerScope := project.Ownership{Enforced: true, Owner: owner}
	stored, err := store.Load(ctx, item.ID, ownerScope)
	if err != nil {
		t.Fatalf("owner Load: %v", err)
	}
	if stored.Name != item.Name || stored.Revision != item.Revision {
		t.Fatalf("foreign mutation changed Project: %#v", stored)
	}
	if _, err := store.Load(ctx, item.ID, project.Ownership{}); err != nil {
		t.Fatalf("ownerless Load: %v", err)
	}
}

func runPage(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	ctx := context.Background()
	store := newStore(t)
	alice := &session.Principal{Issuer: "issuer", Subject: "alice"}
	bob := &session.Principal{Issuer: "issuer", Subject: "bob"}
	at := time.Unix(1_700_000_000, 0)
	for _, item := range []project.Project{
		fixture("b", alice, at), fixture("a", alice, at), fixture("other", bob, at.Add(time.Hour)),
	} {
		if err := store.Create(ctx, item); err != nil {
			t.Fatalf("Create(%s): %v", item.ID, err)
		}
	}
	page, err := store.Page(ctx, project.PageRequest{Limit: 1, OwnershipEnforced: true, Owner: alice})
	if err != nil {
		t.Fatalf("Page: %v", err)
	}
	if page.TotalCount != 2 || len(page.Projects) != 1 || page.Projects[0].ID != "a" || page.NextCursor == nil {
		t.Fatalf("first page = %#v", page)
	}
	page, err = store.Page(ctx, project.PageRequest{Limit: 1, OwnershipEnforced: true, Owner: alice, Cursor: page.NextCursor})
	if err != nil {
		t.Fatalf("second Page: %v", err)
	}
	if page.TotalCount != 2 || len(page.Projects) != 1 || page.Projects[0].ID != "b" || page.NextCursor != nil {
		t.Fatalf("second page = %#v", page)
	}
}

func runCancelledContext(t *testing.T, newStore func(*testing.T) project.Store) {
	t.Helper()
	store := newStore(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	item := fixture("cancelled", nil, time.Unix(1_700_000_000, 0))
	if err := store.Create(ctx, item); !errors.Is(err, context.Canceled) {
		t.Fatalf("Create cancelled = %v", err)
	}
	if _, err := store.Load(context.Background(), item.ID, project.Ownership{}); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("cancelled Create persisted a record: %v", err)
	}
}

func fixture(id string, owner *session.Principal, at time.Time) project.Project {
	return project.Project{
		ID: id, Owner: owner.Clone(), Name: "Project " + id,
		Working:  project.WorkingSource{Ref: project.SourceRef("source-" + id), Label: "Working source"},
		Revision: 1, CreatedAt: at, UpdatedAt: at,
	}
}
