package server

import (
	"context"
	"encoding/json"
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
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestSessionMCPAuthorization_Scenario3_BrokerSessionRegistryRaces(t *testing.T) {
	store := memstore.New()
	runtime := brokerRegistryRuntime(t)
	defer func() { _ = runtime.Close() }()
	sess := brokerRegistrySession(t, runtime, "race")
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatal(err)
	}

	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	var toolsMu sync.Mutex
	var firstTool tool.Tool
	svc := brokerRegistryService(t, store, runtime, func(ctx context.Context, _ ProviderSelector, _ []mcp.ServerConfig, _ SessionProfile, _ string, _ session.PermissionMode) (SessionEngineResult, error) {
		tools := VMCPBrokerTools(ctx)
		if len(tools) != 1 {
			t.Fatalf("broker tools = %d, want 1", len(tools))
		}
		toolsMu.Lock()
		if firstTool == nil {
			firstTool = tools[0]
		} else if firstTool != tools[0] {
			t.Error("concurrent rehydration received different SessionTools owners")
		}
		toolsMu.Unlock()
		entered <- struct{}{}
		<-release
		return brokerRegistryEngine(), nil
	})
	defer svc.Close()

	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = svc.buildAndRegisterSessionEngine(context.Background(), sess, ProviderSelector{}, ProfileDefault, session.ModeDefault, false)
		}()
	}
	<-entered
	shutdown := make(chan struct{})
	go func() { svc.Close(); close(shutdown) }()
	<-shutdown
	close(release)
	wg.Wait()
	svc.mu.Lock()
	owners := len(svc.brokerSessions)
	svc.mu.Unlock()
	if owners != 0 {
		t.Fatalf("broker owners after shutdown race = %d, want 0", owners)
	}
}

func TestSessionMCPAuthorization_Scenario3_BrokerSessionCloseOwnership(t *testing.T) {
	store := memstore.New()
	runtime := brokerRegistryRuntime(t)
	defer func() { _ = runtime.Close() }()
	first := brokerRegistrySession(t, runtime, "first")
	second := brokerRegistrySession(t, runtime, "second")
	if err := store.Save(context.Background(), first); err != nil {
		t.Fatal(err)
	}
	if err := store.Save(context.Background(), second); err != nil {
		t.Fatal(err)
	}
	svc := brokerRegistryService(t, store, runtime, nil)

	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), first, ProviderSelector{}, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), second, ProviderSelector{}, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatal(err)
	}
	svc.CloseSession(first.ID)
	svc.CloseSession(first.ID) // stale/repeated close must not affect another owner.
	svc.mu.Lock()
	_, secondLive := svc.brokerSessions[second.ID]
	_, firstLive := svc.brokerSessions[first.ID]
	svc.mu.Unlock()
	if firstLive || !secondLive {
		t.Fatalf("final close affected wrong broker owner: first=%t second=%t", firstLive, secondLive)
	}

	// A failed factory may only roll back an owner it created, never the live second owner.
	failing := brokerRegistryService(t, store, runtime, func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
		return SessionEngineResult{}, context.Canceled
	})
	if _, err := failing.buildAndRegisterSessionEngine(context.Background(), second, ProviderSelector{}, ProfileDefault, session.ModeDefault, false); err == nil {
		t.Fatal("factory failure succeeded")
	}
	svc.mu.Lock()
	_, secondLive = svc.brokerSessions[second.ID]
	svc.mu.Unlock()
	if !secondLive {
		t.Fatal("factory failure removed pre-existing broker owner")
	}
	svc.Close()
}

func brokerRegistryRuntime(t *testing.T) *vmcpbroker.Runtime {
	t.Helper()
	r, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{BackendID: "b", Tool: tool.ToolSpec{Name: "mcp__b__x", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("x", "ok"), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func brokerRegistrySession(t *testing.T, r *vmcpbroker.Runtime, id session.SessionID) *session.Session {
	t.Helper()
	s := session.New(id, session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	s.BrokerEnrollmentID = r.EnrollmentID()
	return s
}
func brokerRegistryEngine() SessionEngineResult {
	return SessionEngineResult{Engine: agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("done")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)})}
}
func brokerRegistryService(t *testing.T, store *memstore.Store, r *vmcpbroker.Runtime, f SessionEngineFactory) *Service {
	t.Helper()
	if f == nil {
		f = func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
			return brokerRegistryEngine(), nil
		}
	}
	s, err := NewService(Config{Engine: brokerRegistryEngine().Engine, Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, SessionEngine: f, VMCPBroker: r})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
