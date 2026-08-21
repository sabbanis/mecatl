package server

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/project"
)

func TestProjectCursorPreservesNanosecondsAcrossPages(t *testing.T) {
	store := projectstore.NewMemory()
	base := time.Unix(1_700_000_000, 0)
	for i, item := range []project.Project{
		{ID: "oldest", Name: "Oldest", UpdatedAt: base.Add(100 * time.Nanosecond)},
		{ID: "middle", Name: "Middle", UpdatedAt: base.Add(200 * time.Nanosecond)},
		{ID: "newest", Name: "Newest", UpdatedAt: base.Add(300 * time.Nanosecond)},
	} {
		item.Working = project.WorkingSource{Ref: "source", Label: "Source"}
		item.Revision = 1
		item.CreatedAt = base.Add(time.Duration(i+1) * 100 * time.Nanosecond)
		if err := store.Create(context.Background(), item); err != nil {
			t.Fatalf("Create(%s): %v", item.ID, err)
		}
	}

	first, err := store.Page(context.Background(), project.PageRequest{Limit: 1})
	if err != nil || len(first.Projects) != 1 || first.Projects[0].ID != "newest" {
		t.Fatalf("first page = %#v, %v", first, err)
	}
	encoded := encodeProjectCursor(first.NextCursor)
	request, err := projectPageRequest(1, encoded)
	if err != nil {
		t.Fatalf("decode cursor: %v", err)
	}
	if !request.Cursor.UpdatedAt.Equal(first.NextCursor.UpdatedAt) {
		t.Fatalf("cursor time = %s, want %s", request.Cursor.UpdatedAt, first.NextCursor.UpdatedAt)
	}
	second, err := store.Page(context.Background(), request)
	if err != nil || len(second.Projects) != 1 || second.Projects[0].ID != "middle" {
		t.Fatalf("second page = %#v, %v; nanosecond row was skipped", second, err)
	}
}
