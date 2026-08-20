package app

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
)

func TestProjectWorkingMVP_LocalStoreDirWiresOwnerlessControlPlane(t *testing.T) {
	root := t.TempDir()
	built, err := Build(context.Background(), Config{
		Workspace:           root,
		StoreDir:            t.TempDir(),
		UseMock:             true,
		NoSoul:              true,
		EnableLocalProjects: true,
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	defer built.Close()

	sources, err := built.Service.ListProjects(context.Background(), project.PageRequest{Limit: 10})
	if err != nil {
		t.Fatalf("ListProjects: %v", err)
	}
	if sources.TotalCount != 0 {
		t.Fatalf("initial Project count = %d, want 0", sources.TotalCount)
	}
	working, err := built.Service.ListProjectWorkingSources(context.Background())
	if err != nil {
		t.Fatalf("ListProjectWorkingSources: %v", err)
	}
	if len(working) != 1 || working[0].Ref == "" || working[0].Label == "" {
		t.Fatalf("working source = %#v, want one opaque labelled source", working)
	}
	created, err := built.Service.CreateProject(context.Background(), "project-1", "Project", working[0].Ref)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if created.Owner != nil || created.Revision != 1 {
		t.Fatalf("ownerless local Project = %#v", created)
	}
	if _, err := built.Service.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{}); err != nil {
		t.Fatalf("CreateSessionFromProject: %v", err)
	}
}
