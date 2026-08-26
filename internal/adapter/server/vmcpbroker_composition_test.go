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
		Engine:                agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
		Store:                 memstore.New(),
		Workspaces:            func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		SessionEngine:         factory,
		VMCPBroker:            runtime,
		VMCPBrokerGeneration:  "config-v1",
		VMCPBrokerBindings:    vmcpbroker.NewBindingIndex(),
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

func TestSessionVMCPBroker_Scenario4_RestartIsExplicit(t *testing.T) {
	const id = session.SessionID("broker-restart-id")
	store := memstore.New()
	bindings := vmcpbroker.NewBindingIndex()
	factory := func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		if len(server.VMCPBrokerTools(ctx)) != 1 {
			return server.SessionEngineResult{}, errors.New("broker session was not reattached")
		}
		return server.SessionEngineResult{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}), Close: func() error { return nil }}, nil
	}
	newRuntime := func(t *testing.T) *vmcpbroker.Runtime {
		t.Helper()
		runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
			return session.ToolResult{}, nil
		})
		if err != nil {
			t.Fatalf("NewRuntime: %v", err)
		}
		return runtime
	}
	firstRuntime := newRuntime(t)
	first, err := server.NewService(server.Config{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}), Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, SessionEngine: factory, VMCPBroker: firstRuntime, VMCPBrokerGeneration: "config-v1", VMCPBrokerBindings: bindings})
	if err != nil {
		t.Fatalf("first NewService: %v", err)
	}
	if _, err := first.CreateSessionWithProfile(context.Background(), "/workspace", session.ModeDefault, session.Limits{}, server.ProviderSelector{}, server.ProfileDefault, server.WithSessionID(id)); err != nil {
		t.Fatalf("CreateSessionWithProfile: %v", err)
	}
	first.Close()
	_ = firstRuntime.Close()

	secondRuntime := newRuntime(t)
	second, err := server.NewService(server.Config{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}), Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, SessionEngine: factory, VMCPBroker: secondRuntime, VMCPBrokerGeneration: "config-v1", VMCPBrokerBindings: bindings})
	if err != nil {
		t.Fatalf("second NewService: %v", err)
	}
	t.Cleanup(func() { second.Close(); _ = secondRuntime.Close() })
	if _, err := second.StartRun(context.Background(), id, "restart"); err != nil {
		t.Fatalf("restart with matching broker configuration: %v", err)
	}
	second.CloseSession(id)

	withoutRuntime, err := server.NewService(server.Config{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}), Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, SessionEngine: factory, VMCPBrokerBindings: bindings})
	if err != nil {
		t.Fatalf("NewService without runtime: %v", err)
	}
	t.Cleanup(withoutRuntime.Close)
	if _, err := withoutRuntime.StartRun(context.Background(), id, "must not use shared engine"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("restart without broker error = %v, want ErrFailedPrecondition", err)
	}
}
