package server

import (
	"context"
	"errors"
	"sync/atomic"
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
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/project"
)

type projectTransactionRegistry struct {
	source project.WorkingSource
	env    tool.Environment
}

func (r projectTransactionRegistry) ListWorking(context.Context) ([]project.WorkingSource, error) {
	return []project.WorkingSource{r.source}, nil
}

func (r projectTransactionRegistry) ResolveWorking(context.Context, project.SourceRef) (tool.Environment, error) {
	return r.env, nil
}

type failingProjectSessionStore struct {
	*memstore.Store
	err error
}

func (s failingProjectSessionStore) Save(context.Context, *session.Session) error { return s.err }

// TestProjectWorkingMVP_Scenario2_FailureRollback proves Project Session creation
// publishes neither an engine nor an Environment until its labelled aggregate saves.
func TestProjectWorkingMVP_Scenario2_FailureRollback(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name       string
		factoryErr error
		saveErr    error
		wantClosed int32
	}{
		{name: "factory", factoryErr: errors.New("factory failed")},
		{name: "save", saveErr: errors.New("save failed"), wantClosed: 1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			store := memstore.New()
			var sessionStore port.SessionStore = store
			if tt.saveErr != nil {
				sessionStore = failingProjectSessionStore{Store: store, err: tt.saveErr}
			}
			var closed atomic.Int32
			root := "/project"
			svc, err := NewService(Config{
				Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
				Store:  sessionStore,
				Workspaces: func(root string) tool.Workspace {
					return memfs.NewWorkspace(root)
				},
				Now:          func() time.Time { return time.Unix(1, 0) },
				NewID:        func() session.SessionID { return "project-session" },
				ProjectStore: projectstore.NewMemory(),
				ProjectSources: projectTransactionRegistry{
					source: project.WorkingSource{Ref: "source", Label: "Working"},
					env:    tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: root}, memfs.NewWorkspace(root), nil),
				},
				SessionEngine: func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
					if tt.factoryErr != nil {
						return SessionEngineResult{}, tt.factoryErr
					}
					return SessionEngineResult{
						Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("ok")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
						Close:  func() error { closed.Add(1); return nil },
					}, nil
				},
			})
			if err != nil {
				t.Fatalf("NewService: %v", err)
			}
			created, err := svc.CreateProject(context.Background(), "project", "Project", "source")
			if err != nil {
				t.Fatalf("CreateProject: %v", err)
			}

			if _, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, ProviderSelector{}); err == nil {
				t.Fatal("CreateSessionFromProject succeeded, want failure")
			}
			if _, err := store.Load(context.Background(), "project-session"); !errors.Is(err, port.ErrSessionNotFound) {
				t.Fatalf("failed transaction persisted Session: %v", err)
			}
			svc.mu.Lock()
			_, hasEngine := svc.sessionEngines["project-session"]
			_, hasEnvironment := svc.sessionEnvironments["project-session"]
			svc.mu.Unlock()
			if hasEngine || hasEnvironment {
				t.Fatalf("failed transaction published engine=%v environment=%v", hasEngine, hasEnvironment)
			}
			if got := closed.Load(); got != tt.wantClosed {
				t.Fatalf("factory close count = %d, want %d", got, tt.wantClosed)
			}
		})
	}
}
