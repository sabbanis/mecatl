package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
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
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession(t *testing.T) {
	const id = session.SessionID("broker-canonical-id")

	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "calendar",
		Tool:      tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(_ context.Context, _ session.SessionID, _ vmcpbroker.Route, _ json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })

	entered := make(chan struct{})
	releaseFactory := make(chan struct{})
	var once sync.Once
	factory := func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		tools := server.VMCPBrokerTools(ctx)
		if len(tools) != 1 || tools[0].Spec().Name != "mcp__calendar__list_events" {
			return server.SessionEngineResult{}, errors.New("broker tools were not opened for the canonical session")
		}
		once.Do(func() { close(entered) })
		<-releaseFactory
		return server.SessionEngineResult{
			Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
			Close:  func() error { return nil },
		}, nil
	}
	svc, err := server.NewService(server.Config{
		Engine:        agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
		Store:         memstore.New(),
		Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		SessionEngine: factory,
		VMCPBroker:    runtime,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	t.Cleanup(svc.Close)

	firstDone := make(chan error, 1)
	go func() {
		_, err := svc.CreateSessionWithProfile(context.Background(), "/workspace", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSessionID(id))
		firstDone <- err
	}()
	<-entered

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := svc.CreateSessionWithProfile(ctx, "/workspace", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSessionID(id)); !errors.Is(err, server.ErrInvalidArgument) {
		t.Fatalf("concurrent create error = %v, want ErrInvalidArgument", err)
	}
	close(releaseFactory)
	if err := <-firstDone; err != nil {
		t.Fatalf("first CreateSessionWithProfile: %v", err)
	}
}

type failSaveStore struct {
	port.SessionStore
	err error
}

func (s failSaveStore) Save(context.Context, *session.Session) error { return s.err }

func TestSessionVMCPBroker_Scenario1_ClosesResourcesOnCreateFailure(t *testing.T) {
	createRuntime := func(t *testing.T) *vmcpbroker.Runtime {
		t.Helper()
		runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
			BackendID: "calendar",
			Tool:      tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
		}}, func(_ context.Context, _ session.SessionID, _ vmcpbroker.Route, _ json.RawMessage) (session.ToolResult, error) {
			return session.NewToolResult("call", "ok"), nil
		})
		if err != nil {
			t.Fatalf("NewRuntime: %v", err)
		}
		t.Cleanup(func() { _ = runtime.Close() })
		return runtime
	}

	for _, test := range []struct {
		name       string
		store      port.SessionStore
		factoryErr error
	}{
		{name: "factory", store: memstore.New(), factoryErr: errors.New("factory failed")},
		{name: "persistence", store: failSaveStore{SessionStore: memstore.New(), err: errors.New("save failed")}},
	} {
		t.Run(test.name, func(t *testing.T) {
			var brokerTool tool.Tool
			closedFactory := false
			factory := func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
				brokerTools := server.VMCPBrokerTools(ctx)
				if len(brokerTools) != 1 {
					return server.SessionEngineResult{}, errors.New("broker tools were not opened")
				}
				brokerTool = brokerTools[0]
				if test.factoryErr != nil {
					return server.SessionEngineResult{}, test.factoryErr
				}
				return server.SessionEngineResult{
					Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
					Close:  func() error { closedFactory = true; return nil },
				}, nil
			}
			svc, err := server.NewService(server.Config{
				Engine:        agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
				Store:         test.store,
				Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
				SessionEngine: factory,
				VMCPBroker:    createRuntime(t),
			})
			if err != nil {
				t.Fatalf("NewService: %v", err)
			}
			t.Cleanup(svc.Close)

			if _, err := svc.CreateSessionWithProfile(context.Background(), "/workspace", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSessionID("failed-create")); err == nil {
				t.Fatal("CreateSessionWithProfile succeeded, want failure")
			}
			if brokerTool == nil {
				t.Fatal("factory did not receive broker tool")
			}
			if _, err := brokerTool.Execute(context.Background(), session.NewToolCall("call", brokerTool.Spec().Name, []byte(`{}`)), tool.Environment{}); !errors.Is(err, vmcpbroker.ErrClosed) {
				t.Fatalf("broker tool after failed create error = %v, want ErrClosed", err)
			}
			if test.factoryErr == nil && !closedFactory {
				t.Fatal("factory resource was not closed after persistence failure")
			}
		})
	}
}
