package projectstore_test

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/project"
	"github.com/stacklok/mecatl/internal/project/projectconformance"
)

func TestLocalStoreReopenPreservesProject(t *testing.T) {
	dir := t.TempDir()
	store, err := projectstore.NewLocal(dir)
	if err != nil {
		t.Fatalf("NewLocal: %v", err)
	}
	item := project.Project{
		ID: "reopen", Name: "Reopen", Working: project.WorkingSource{Ref: "source-reopen", Label: "Working source"},
		Revision: 1, CreatedAt: time.Unix(1_700_000_000, 0), UpdatedAt: time.Unix(1_700_000_000, 0),
	}
	if err := store.Create(context.Background(), item); err != nil {
		t.Fatalf("Create: %v", err)
	}
	reopened, err := projectstore.NewLocal(dir)
	if err != nil {
		t.Fatalf("reopen NewLocal: %v", err)
	}
	got, err := reopened.Load(context.Background(), item.ID)
	if err != nil {
		t.Fatalf("reopened Load: %v", err)
	}
	if got != item {
		t.Fatalf("reopened Project = %#v, want %#v", got, item)
	}
}
func TestLocalStoreConformance(t *testing.T) {
	projectconformance.Run(t, func(t *testing.T) project.Store {
		store, err := projectstore.NewLocal(t.TempDir())
		if err != nil {
			t.Fatalf("NewLocal: %v", err)
		}
		return store
	})
}
