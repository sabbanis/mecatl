package server_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
)

type projectRegistry struct {
	source     project.WorkingSource
	env        tool.Environment
	resolveErr error
}

func (r *projectRegistry) ListWorking(context.Context) ([]project.WorkingSource, error) {
	return []project.WorkingSource{r.source}, nil
}

func (r *projectRegistry) ResolveWorking(_ context.Context, ref project.SourceRef) (tool.Environment, error) {
	if ref != r.source.Ref {
		return tool.Environment{}, project.ErrSourceNotFound
	}
	if r.resolveErr != nil {
		return tool.Environment{}, r.resolveErr
	}
	return r.env, nil
}

func newProjectService(t *testing.T, ownership bool) (*server.Service, project.WorkingSource, *memstore.Store, *projectRegistry) {
	t.Helper()
	root := "/project"
	source := project.WorkingSource{Ref: "opaque-source", Label: "Working copy"}
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: root}, memfs.NewWorkspace(root), nil)
	registry := &projectRegistry{source: source, env: env}
	sessions := memstore.New()
	svc, err := server.NewService(server.Config{
		Engine:            agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
		Store:             sessions,
		Workspaces:        func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:               func() time.Time { return time.Unix(1, 0) },
		NewID:             func() session.SessionID { return "session-1" },
		OwnershipEnforced: ownership,
		ProjectStore:      projectstore.NewMemory(),
		ProjectSources:    registry,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc, source, sessions, registry
}

func TestProjectServiceResolutionFailureIsOpaqueAndLeavesNoSession(t *testing.T) {
	svc, source, sessions, registry := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Project one", source.Ref)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	registry.resolveErr = errors.New("open /private/project/root: permission denied")

	_, err = svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("CreateSessionFromProject error = %v, want ErrFailedPrecondition", err)
	}
	if strings.Contains(err.Error(), "/private/project/root") {
		t.Fatalf("CreateSessionFromProject leaked locator: %v", err)
	}
	if _, err := sessions.Load(context.Background(), "session-1"); !errors.Is(err, port.ErrSessionNotFound) {
		t.Fatalf("failed Project creation persisted a Session: %v", err)
	}
}
func TestInvariant_project_access_is_caller_separated(t *testing.T) {
	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	ctx := session.WithPrincipal(context.Background(), owner)
	svc, source, _, _ := newProjectService(t, true)

	created, err := svc.CreateProject(ctx, "project-1", "Project one", source.Ref)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if created.Owner == nil || !created.Owner.SameIdentity(owner) || created.Working.Label != source.Label || created.Revision != 1 {
		t.Fatalf("server-owned Project = %#v", created)
	}

	sess, err := svc.CreateSessionFromProject(ctx, created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatalf("CreateSessionFromProject: %v", err)
	}
	if sess.Project == nil || sess.Project.ProjectID != created.ID || sess.Project.Working.SourceRef != string(source.Ref) || sess.EnvironmentRef.ID != "/project" {
		t.Fatalf("captured project binding = %#v, environment = %#v", sess.Project, sess.EnvironmentRef)
	}
	if sess.Owner == nil || !sess.Owner.SameIdentity(owner) {
		t.Fatalf("session owner = %#v, want %#v", sess.Owner, owner)
	}

	foreign := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "issuer", Subject: "other"})
	if _, err := svc.GetProject(foreign, created.ID); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign GetProject error = %v, want absence-shaped ErrNotFound", err)
	}
	if _, err := svc.GetProject(foreign, "missing"); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("missing GetProject error = %v, want absence-shaped ErrNotFound", err)
	}
	if _, err := svc.ReplaceProject(foreign, created.ID, "Foreign change", source.Ref, created.Revision); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign ReplaceProject error = %v, want absence-shaped ErrNotFound", err)
	}
	if err := svc.DeleteProject(foreign, created.ID, created.Revision); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign DeleteProject error = %v, want absence-shaped ErrNotFound", err)
	}
	stored, err := svc.GetProject(ctx, created.ID)
	if err != nil {
		t.Fatalf("owner GetProject after foreign mutations: %v", err)
	}
	if stored.Name != created.Name || stored.Revision != created.Revision {
		t.Fatalf("foreign mutation changed Project: %#v", stored)
	}
}
