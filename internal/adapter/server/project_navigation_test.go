package server_test

import (
	"context"
	"errors"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
)

// TestInvariant_project_session_filter_precedes_paging pins ADR 0234 decision 9:
// Project and owner selection are part of the pager query, before its count and cursor.
func TestInvariant_project_session_filter_precedes_paging(t *testing.T) {
	ctx := context.Background()
	svc, source, sessions, _ := newProjectService(t, false)
	for _, id := range []string{"one", "two"} {
		if _, err := svc.CreateProject(ctx, id, id, source.Ref); err != nil {
			t.Fatalf("CreateProject(%q): %v", id, err)
		}
	}
	for _, fixture := range []struct {
		id, project string
	}{
		{id: "ordinary"}, {id: "one-a", project: "one"}, {id: "two", project: "two"}, {id: "one-b", project: "one"},
	} {
		s := session.New(session.SessionID(fixture.id), session.ModeDefault, "/project", session.Limits{}, time.Unix(1, 0))
		if fixture.project != "" {
			s.Project = &session.ProjectBinding{ProjectID: fixture.project, ProjectNameAtCreation: fixture.project, Working: session.ProjectSourceBinding{LabelAtCreation: "Working copy"}}
		}
		if err := sessions.Save(ctx, s); err != nil {
			t.Fatalf("Save(%q): %v", fixture.id, err)
		}
	}

	first, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{PageSize: 1, ProjectID: "one"})
	if err != nil {
		t.Fatalf("filtered first page: %v", err)
	}
	if len(first.Sessions) != 1 || first.TotalCount != 2 || first.NextCursor == "" || first.Sessions[0].ProjectID != "one" {
		t.Fatalf("filtered first page = %#v, want one Project row, total 2, cursor", first)
	}
	second, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{PageSize: 1, ProjectID: "one", Cursor: first.NextCursor})
	if err != nil {
		t.Fatalf("filtered second page: %v", err)
	}
	if len(second.Sessions) != 1 || second.TotalCount != 2 || second.NextCursor != "" || second.Sessions[0].ProjectID != "one" || second.Sessions[0].SessionID == first.Sessions[0].SessionID {
		t.Fatalf("filtered second page = %#v, want the remaining Project row", second)
	}
	if _, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{PageSize: 1, ProjectID: "two", Cursor: first.NextCursor}); !errors.Is(err, port.ErrSessionMetadataCursorRestart) {
		t.Fatalf("cross-Project cursor = %v, want rejected", err)
	}
	if _, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{ProjectID: "missing"}); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("missing Project filter = %v, want not found", err)
	}
}

func TestProjectWorkingMVP_Scenario4_CompactProvenanceProjection(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	projectDoc, err := svc.CreateProject(context.Background(), "project", "Safe name", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	created, err := svc.CreateSessionFromProject(context.Background(), projectDoc.ID, "", session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	page, err := svc.ListSessionPage(context.Background(), server.ListSessionsPageRequest{ProjectID: projectDoc.ID})
	if err != nil || len(page.Sessions) != 1 {
		t.Fatalf("ListSessionPage = %#v, %v", page, err)
	}
	row := page.Sessions[0]
	if row.ProjectID != "project" || row.ProjectNameAtCreation != "Safe name" || row.WorkingLabelAtCreation != "Working copy" {
		t.Fatalf("compact provenance = %#v", row)
	}
	if row.SessionID != string(created.ID) {
		t.Fatalf("session ID = %q, want %q", row.SessionID, created.ID)
	}
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	wire, err := client.ListSessions(context.Background(), &mecatlv1.ListSessionsRequest{ProjectId: projectDoc.ID})
	if err != nil || len(wire.GetSessions()) != 1 {
		t.Fatalf("wire Project page = %#v, %v", wire, err)
	}
	got := wire.GetSessions()[0]
	if got.GetProjectId() != "project" || got.GetProjectNameAtCreation() != "Safe name" || got.GetWorkingLabelAtCreation() != "Working copy" {
		t.Fatalf("wire compact provenance = %#v", got)
	}
}

func TestProjectWorkingMVP_Scenario4_DeletedProjectHistory(t *testing.T) {
	ctx := context.Background()
	svc, source, _, _ := newProjectService(t, false)
	projectDoc, err := svc.CreateProject(ctx, "project", "Historic", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	created, err := svc.CreateSessionFromProject(ctx, projectDoc.ID, "", session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteProject(ctx, projectDoc.ID, projectDoc.Revision); err != nil {
		t.Fatal(err)
	}
	projects, err := svc.ListProjects(ctx, project.PageRequest{Limit: 10})
	if err != nil || len(projects.Projects) != 0 {
		t.Fatalf("ListProjects after delete = %#v, %v", projects, err)
	}
	page, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{})
	if err != nil || len(page.Sessions) != 1 || page.Sessions[0].SessionID != string(created.ID) || page.Sessions[0].ProjectID != "project" {
		t.Fatalf("ordinary history after delete = %#v, %v", page, err)
	}
}
