package server_test

import (
	"context"
	"encoding/json"
	"errors"
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

func TestInvariant_broker_rehydration_never_falls_back_global(t *testing.T) {
	store := memstore.New()
	sess := session.New("broker-restart", session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	sess.BrokerEnrolled = true
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}
	sharedCalls := 0
	shared := agent.NewEngine(agent.Deps{
		LLM:     mockllm.New(mockllm.TextTurn("shared engine must not run")),
		Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil),
	})
	svc, err := server.NewService(server.Config{
		Engine: shared, Store: store,
		Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		SessionEngine: func(context.Context, server.ProviderSelector, []mcp.ServerConfig, server.SessionProfile, string, session.PermissionMode) (server.SessionEngineResult, error) {
			sharedCalls++
			return scenario3EngineResult(), nil
		},
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	defer svc.Close()
	if _, err := svc.StartRun(context.Background(), sess.ID, "continue"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("StartRun error = %v, want ErrFailedPrecondition", err)
	}
	if sharedCalls != 0 {
		t.Fatalf("session factory calls = %d, want 0 when broker runtime is missing", sharedCalls)
	}
}

func TestSessionMCPAuthorization_Scenario3_RestoresBrokerCatalog(t *testing.T) {
	store := memstore.New()
	runtime := scenario3Runtime(t)
	defer func() { _ = runtime.Close() }()

	first := scenario3Service(t, store, runtime, nil)
	sess, err := first.CreateSession(context.Background(), "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	first.Close()

	factoryCalls := 0
	restored := scenario3Service(t, store, runtime, func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		factoryCalls++
		if tools := server.VMCPBrokerTools(ctx); len(tools) != 1 || tools[0].Spec().Name != "mcp__calendar__list" {
			t.Fatalf("restored factory broker tools = %#v, want session-local broker wrapper", tools)
		}
		return scenario3EngineResult(), nil
	})
	defer restored.Close()

	run, err := restored.StartRun(context.Background(), sess.ID, "continue")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	for range run.Events() {
	}
	restored.FinishRun(sess.ID, run)
	if factoryCalls != 1 {
		t.Fatalf("broker session factory calls = %d, want 1 during rehydration", factoryCalls)
	}
}

func scenario3Runtime(t *testing.T) *vmcpbroker.Runtime {
	t.Helper()
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "calendar",
		Tool:      tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	return runtime
}

func scenario3Service(t *testing.T, store *memstore.Store, runtime *vmcpbroker.Runtime, factory server.SessionEngineFactory) *server.Service {
	t.Helper()
	if factory == nil {
		factory = func(context.Context, server.ProviderSelector, []mcp.ServerConfig, server.SessionProfile, string, session.PermissionMode) (server.SessionEngineResult, error) {
			return scenario3EngineResult(), nil
		}
	}
	svc, err := server.NewService(server.Config{
		Engine:        scenario3EngineResult().Engine,
		Store:         store,
		Workspaces:    func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		SessionEngine: factory,
		VMCPBroker:    runtime,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc
}

func scenario3EngineResult() server.SessionEngineResult {
	return server.SessionEngineResult{
		Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("done")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)}),
		Close:  func() error { return nil },
	}
}

func TestInvariant_broker_rehydration_never_falls_back_global_on_route_change(t *testing.T) {
	store := memstore.New()
	original := scenario3Runtime(t)
	first := scenario3Service(t, store, original, nil)
	sess, err := first.CreateSession(context.Background(), "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	first.Close()
	_ = original.Close()

	changed, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__changed", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer func() { _ = changed.Close() }()
	factoryCalls := 0
	restored := scenario3Service(t, store, changed, func(context.Context, server.ProviderSelector, []mcp.ServerConfig, server.SessionProfile, string, session.PermissionMode) (server.SessionEngineResult, error) {
		factoryCalls++
		return scenario3EngineResult(), nil
	})
	defer restored.Close()

	if _, err := restored.StartRun(context.Background(), sess.ID, "continue"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("StartRun error = %v, want ErrFailedPrecondition", err)
	}
	if factoryCalls != 0 {
		t.Fatalf("session factory calls = %d, want 0 after incompatible broker route change", factoryCalls)
	}
}
