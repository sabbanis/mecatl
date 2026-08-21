package server_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
)

type projectRegistry struct {
	source       project.WorkingSource
	env          tool.Environment
	resolveErr   error
	listErr      error
	empty        bool
	afterResolve func()
}

func (r *projectRegistry) ListWorking(context.Context) ([]project.WorkingSource, error) {
	if r.listErr != nil {
		return nil, r.listErr
	}
	if r.empty {
		return nil, nil
	}
	return []project.WorkingSource{r.source}, nil
}

func (r *projectRegistry) ResolveWorking(_ context.Context, ref project.SourceRef) (tool.Environment, error) {
	if ref != r.source.Ref {
		return tool.Environment{}, project.ErrSourceNotFound
	}
	if r.resolveErr != nil {
		return tool.Environment{}, r.resolveErr
	}
	if r.afterResolve != nil {
		r.afterResolve()
	}
	return r.env, nil
}

func newProjectService(t *testing.T, ownership bool) (*server.Service, project.WorkingSource, *memstore.Store, *projectRegistry) {
	return newProjectServiceWithFactory(t, ownership, true)
}

func newProjectServiceWithFactory(t *testing.T, ownership, withFactory bool) (*server.Service, project.WorkingSource, *memstore.Store, *projectRegistry) {
	t.Helper()
	root := "/project"
	source := project.WorkingSource{Ref: "opaque-source", Label: "Working copy"}
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: root}, memfs.NewWorkspace(root), nil)
	registry := &projectRegistry{source: source, env: env}
	savedAt := time.Unix(1, 0)
	sessions := memstore.New(memstore.WithNow(func() time.Time {
		savedAt = savedAt.Add(time.Second)
		return savedAt
	}))
	var factory server.SessionEngineFactory
	if withFactory {
		factory = func(_ context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
			return server.SessionEngineResult{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)})}, nil
		}
	}
	svc, err := server.NewService(server.Config{
		Engine:            agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
		Store:             sessions,
		Workspaces:        func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:               func() time.Time { return time.Unix(1, 0) },
		NewID:             func() session.SessionID { return "session-1" },
		OwnershipEnforced: ownership,
		ProjectStore:      projectstore.NewMemory(),
		ProjectSources:    registry,
		SessionEngine:     factory,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc, source, sessions, registry
}

func TestProjectServiceRequiresSessionFactoryForCapability(t *testing.T) {
	svc, _, _, _ := newProjectServiceWithFactory(t, false, false)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	caps, err := client.GetServerCapabilities(context.Background(), &mecatlv1.GetServerCapabilitiesRequest{})
	if err != nil {
		t.Fatalf("GetServerCapabilities: %v", err)
	}
	if caps.GetCapabilities().GetProjects() {
		t.Fatal("projects capability = true without a Project Session factory")
	}
}

func TestProjectServiceRequiresNonemptyReachableSourceRegistryForCapability(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*projectRegistry)
	}{
		{name: "empty", mutate: func(r *projectRegistry) { r.empty = true }},
		{name: "list failure", mutate: func(r *projectRegistry) { r.listErr = errors.New("unavailable") }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, _, _, registry := newProjectService(t, false)
			tc.mutate(registry)
			client, cleanup := dialGRPC(t, svc)
			defer cleanup()
			caps, err := client.GetServerCapabilities(context.Background(), &mecatlv1.GetServerCapabilitiesRequest{})
			if err != nil {
				t.Fatalf("GetServerCapabilities: %v", err)
			}
			if caps.GetCapabilities().GetProjects() {
				t.Fatal("projects capability = true without a reachable nonempty working-source registry")
			}
		})
	}
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
func TestProjectWorkingMVP_Scenario4_UnsupportedPagerFailsHonestly(t *testing.T) {
	ctx := context.Background()
	store := &nonPagingSessionStore{inner: memstore.New()}
	source := project.WorkingSource{Ref: "opaque-source", Label: "Working copy"}
	registry := &projectRegistry{source: source, env: tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/project"}, memfs.NewWorkspace("/project"), nil)}
	engine := func() *agent.Engine {
		return agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)})
	}
	svc, err := server.NewService(server.Config{
		Engine: engine(), Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now: func() time.Time { return time.Unix(1, 0) }, NewID: func() session.SessionID { return "session" },
		ProjectStore: projectstore.NewMemory(), ProjectSources: registry,
		SessionEngine: func(_ context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
			return server.SessionEngineResult{Engine: engine()}, nil
		},
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	if _, err := svc.CreateProject(ctx, "project", "Project", source.Ref); err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if _, err := svc.ListSessionPage(ctx, server.ListSessionsPageRequest{ProjectID: "project"}); !errors.Is(err, port.ErrSessionMetadataPagingUnsupported) {
		t.Fatalf("Project page without pager = %v, want unsupported", err)
	}
	if store.loads != 0 {
		t.Fatalf("unsupported Project pager loaded %d Session snapshots", store.loads)
	}
}

type nonPagingSessionStore struct {
	inner *memstore.Store
	loads int
}

func (s *nonPagingSessionStore) Save(ctx context.Context, sess *session.Session) error {
	return s.inner.Save(ctx, sess)
}
func (s *nonPagingSessionStore) Load(ctx context.Context, id session.SessionID) (*session.Session, error) {
	s.loads++
	return s.inner.Load(ctx, id)
}

func TestInvariant_project_access_is_caller_separated(t *testing.T) {
	t.Parallel()

	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	foreign := &session.Principal{Issuer: "issuer", Subject: "other"}
	store := projectstore.NewMemory()
	item := project.Project{
		ID: "project-1", Owner: owner, Name: "Project one",
		Working:  project.WorkingSource{Ref: "opaque-source", Label: "Working copy"},
		Revision: 1, CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(1, 0),
	}
	if err := store.Create(context.Background(), item); err != nil {
		t.Fatalf("Create: %v", err)
	}
	foreignScope := project.Ownership{Enforced: true, Owner: foreign}
	if _, err := store.Load(context.Background(), item.ID, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Load = %v, want absence-shaped ErrNotFound", err)
	}
	if _, err := store.Replace(context.Background(), item, item.Revision, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Replace = %v, want absence-shaped ErrNotFound", err)
	}
	if err := store.Delete(context.Background(), item.ID, item.Revision, foreignScope); !errors.Is(err, project.ErrNotFound) {
		t.Fatalf("foreign Delete = %v, want absence-shaped ErrNotFound", err)
	}
	page, err := store.Page(context.Background(), project.PageRequest{Limit: 1, OwnershipEnforced: true, Owner: foreign})
	if err != nil || page.TotalCount != 0 || len(page.Projects) != 0 {
		t.Fatalf("foreign Page = %#v, %v", page, err)
	}

	// This MVP never shares its writable source across ownership domains.
	svc, _, _, _ := newProjectService(t, true)
	if _, err := svc.CreateProject(session.WithPrincipal(context.Background(), owner), "blocked", "Blocked", "opaque-source"); !errors.Is(err, project.ErrUnsupported) {
		t.Fatalf("ownership-enforced CreateProject = %v, want unsupported", err)
	}
}
