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
	sess.BrokerEnrollmentID = "broker-enrollment"
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

func TestSessionMCPAuthorization_Scenario3_BrokerSessionOwnership(t *testing.T) {
	store := memstore.New()
	runtime := scenario3Runtime(t)
	defer func() { _ = runtime.Close() }()

	bindings := vmcpbroker.NewBindingIndex()
	first := scenario3Service(t, store, runtime, nil, bindings)
	sess, err := first.CreateSession(context.Background(), "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	first.Close()
	if err := bindings.Bind(sess.ID, runtime.EnrollmentID()); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Close(); err != nil {
		t.Fatalf("close first runtime: %v", err)
	}
	// A process restart creates a new Runtime; closed broker sessions are never
	// resurrected in the prior runtime.
	runtime = scenario3Runtime(t)
	defer func() { _ = runtime.Close() }()

	factoryCalls := 0
	restored := scenario3Service(t, store, runtime, func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		factoryCalls++
		if tools := server.VMCPBrokerTools(ctx); len(tools) != 1 || tools[0].Spec().Name != "mcp__calendar__list" {
			t.Fatalf("restored factory broker tools = %#v, want session-local broker wrapper", tools)
		}
		return scenario3EngineResult(), nil
	}, bindings)
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

func scenario3Service(t *testing.T, store *memstore.Store, runtime *vmcpbroker.Runtime, factory server.SessionEngineFactory, bindings *vmcpbroker.BindingIndex) *server.Service {
	t.Helper()
	if factory == nil {
		factory = func(context.Context, server.ProviderSelector, []mcp.ServerConfig, server.SessionProfile, string, session.PermissionMode) (server.SessionEngineResult, error) {
			return scenario3EngineResult(), nil
		}
	}
	if bindings == nil {
		bindings = vmcpbroker.NewBindingIndex()
	}
	svc, err := server.NewService(server.Config{
		Engine:               scenario3EngineResult().Engine,
		Store:                store,
		Workspaces:           func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		SessionEngine:        factory,
		VMCPBroker:           runtime,
		VMCPBrokerGeneration: runtime.EnrollmentID(),
		VMCPBrokerBindings:   bindings,
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

func TestSessionMCPAuthorization_Scenario3_LoadWithMCPRetainsBrokerTools(t *testing.T) {
	store := memstore.New()
	runtime := scenario3Runtime(t)
	t.Cleanup(func() { _ = runtime.Close() })
	sess := session.New("broker-load", session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	sess.BrokerEnrollmentID = runtime.EnrollmentID()
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	bindings := vmcpbroker.NewBindingIndex()
	if err := bindings.Bind(sess.ID, runtime.EnrollmentID()); err != nil {
		t.Fatal(err)
	}
	factoryCalls := 0
	svc := scenario3Service(t, store, runtime, func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		factoryCalls++
		tools := server.VMCPBrokerTools(ctx)
		if len(tools) != 1 || tools[0].Spec().Name != "mcp__calendar__list" {
			return server.SessionEngineResult{}, errors.New("broker wrappers were dropped during MCP load")
		}
		return scenario3EngineResult(), nil
	}, bindings)
	t.Cleanup(svc.Close)

	if _, err := svc.LoadSessionWithMCP(context.Background(), sess.ID, []mcp.ServerConfig{{Name: "editor"}}); err != nil {
		t.Fatalf("LoadSessionWithMCP: %v", err)
	}
	if factoryCalls != 1 {
		t.Fatalf("factory calls = %d, want 1", factoryCalls)
	}
}

func TestSessionMCPAuthorization_Scenario3_BrokerReloadRetriesWithoutResurrection(t *testing.T) {
	store := memstore.New()
	runtime := scenario3Runtime(t)
	t.Cleanup(func() { _ = runtime.Close() })
	sess := session.New("broker-retry", session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	sess.BrokerEnrollmentID = runtime.EnrollmentID()
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	bindings := vmcpbroker.NewBindingIndex()
	if err := bindings.Bind(sess.ID, runtime.EnrollmentID()); err != nil {
		t.Fatal(err)
	}
	calls := 0
	var retained tool.Tool
	svc := scenario3Service(t, store, runtime, func(ctx context.Context, _ server.ProviderSelector, _ []mcp.ServerConfig, _ server.SessionProfile, _ string, _ session.PermissionMode) (server.SessionEngineResult, error) {
		calls++
		tools := server.VMCPBrokerTools(ctx)
		if len(tools) != 1 {
			return server.SessionEngineResult{}, errors.New("broker wrappers were dropped during reload")
		}
		if calls == 1 {
			return server.SessionEngineResult{}, errors.New("transient factory failure")
		}
		if retained == nil {
			retained = tools[0]
		} else if tools[0] != retained {
			return server.SessionEngineResult{}, errors.New("same-process reload replaced the retained broker owner")
		}
		return scenario3EngineResult(), nil
	}, bindings)
	t.Cleanup(svc.Close)

	specs := []mcp.ServerConfig{{Name: "editor"}}
	if _, err := svc.LoadSessionWithMCP(context.Background(), sess.ID, specs); err == nil {
		t.Fatal("first LoadSessionWithMCP succeeded, want factory failure")
	}
	if _, err := svc.LoadSessionWithMCP(context.Background(), sess.ID, specs); err != nil {
		t.Fatalf("retry LoadSessionWithMCP: %v", err)
	}
	if _, err := svc.LoadSessionWithMCP(context.Background(), sess.ID, specs); err != nil {
		t.Fatalf("same-process reload: %v", err)
	}
	if calls != 3 {
		t.Fatalf("factory calls = %d, want 3", calls)
	}
}
func TestInvariant_broker_enrollment_identity_covers_compiled_inventory(t *testing.T) {
	store := memstore.New()
	original := scenario3Runtime(t)
	bindings := vmcpbroker.NewBindingIndex()
	first := scenario3Service(t, store, original, nil, bindings)
	sess, err := first.CreateSession(context.Background(), "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	first.Close()
	if err := bindings.Bind(sess.ID, original.EnrollmentID()); err != nil {
		t.Fatal(err)
	}
	_ = original.Close()

	for _, changedRoute := range []vmcpbroker.Route{
		{BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"string"}`)}},
		{BackendID: "calendar-v2", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)}, Protected: true},
	} {
		changed, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{changedRoute}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
			return session.NewToolResult("call", "ok"), nil
		})
		if err != nil {
			t.Fatalf("NewRuntime: %v", err)
		}
		restored := scenario3Service(t, store, changed, nil, bindings)
		if _, err := restored.StartRun(context.Background(), sess.ID, "continue"); !errors.Is(err, server.ErrFailedPrecondition) {
			t.Fatalf("StartRun with changed compiled inventory = %v, want ErrFailedPrecondition", err)
		}
		restored.Close()
		_ = changed.Close()
	}
}
