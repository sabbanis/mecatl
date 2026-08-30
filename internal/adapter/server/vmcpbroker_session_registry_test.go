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
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestSessionMCPAuthorization_Scenario3_BrokerOwnerCommitSemantics(t *testing.T) {
	store := brokerFailSaveStore{SessionStore: memstore.New(), err: context.Canceled}
	runtime := brokerRegistryRuntime(t)
	t.Cleanup(func() { _ = runtime.Close() })
	svc := brokerRegistryServiceWithStore(t, store, runtime, func(ctx context.Context, _ ProviderSelector, _ []mcp.ServerConfig, _ SessionProfile, _ string, _ session.PermissionMode) (SessionEngineResult, error) {
		if tools := VMCPBrokerTools(ctx); len(tools) != 1 {
			t.Fatalf("broker tools = %d, want 1", len(tools))
		}
		return brokerRegistryEngine(), nil
	})
	t.Cleanup(svc.Close)

	if _, err := svc.CreateSessionWithProfile(context.Background(), "/workspace", session.ModeDefault, session.Limits{}, ProviderSelector{}, ProfileDefault, WithSessionID("provisional")); err == nil {
		t.Fatal("CreateSessionWithProfile succeeded, want persistence failure")
	}
	svc.mu.Lock()
	_, retained := svc.brokerSessions["provisional"]
	svc.mu.Unlock()
	if retained {
		t.Fatal("failed create retained provisional broker owner")
	}

	retryStore := memstore.New()
	retrySession := brokerRegistrySession(t, runtime, "rehydration-retry")
	if err := retryStore.Save(context.Background(), retrySession); err != nil {
		t.Fatalf("save rehydration session: %v", err)
	}
	factoryFailed := false
	retryService := brokerRegistryService(t, retryStore, runtime, func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
		if !factoryFailed {
			factoryFailed = true
			return SessionEngineResult{}, context.Canceled
		}
		return brokerRegistryEngine(), nil
	})
	if err := brokerRegistryBind(retryService, retrySession.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := retryService.buildAndRegisterSessionEngine(context.Background(), retrySession, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err == nil {
		t.Fatal("failed rehydration factory succeeded")
	}
	retryService.mu.Lock()
	entry := retryService.brokerSessions[retrySession.ID]
	committed := entry != nil && entry.committed
	retryService.mu.Unlock()
	if !committed {
		t.Fatal("failed rehydration discarded its committed broker owner")
	}
	if _, err := retryService.buildAndRegisterSessionEngine(context.Background(), retrySession, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatalf("retry rehydration: %v", err)
	}
}

func TestSessionMCPAuthorization_Scenario3_BrokerOwnerReloadAfterClose(t *testing.T) {
	store := memstore.New()
	runtime := brokerRegistryRuntime(t)
	t.Cleanup(func() { _ = runtime.Close() })
	sess := brokerRegistrySession(t, runtime, "reload")
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatal(err)
	}
	svc := brokerRegistryService(t, store, runtime, nil)
	t.Cleanup(svc.Close)
	if err := brokerRegistryBind(svc, sess.ID); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), sess, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatalf("first load: %v", err)
	}
	svc.CloseSession(sess.ID)
	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), sess, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatalf("same-process reload after close: %v", err)
	}
}

func TestSessionMCPAuthorization_Scenario3_BrokerOwnerShutdownWakesWaiters(t *testing.T) {
	store := memstore.New()
	runtime := brokerRegistryRuntime(t)
	t.Cleanup(func() { _ = runtime.Close() })
	svc := brokerRegistryService(t, store, runtime, nil)
	entry := &brokerSession{ready: make(chan struct{}), done: make(chan struct{}), closing: true}
	svc.mu.Lock()
	svc.brokerSessions["closing"] = entry
	svc.mu.Unlock()

	waiter := make(chan struct{}, 1)
	waiterStarted := make(chan struct{})
	go func() {
		close(waiterStarted)
		<-entry.done
		waiter <- struct{}{}
	}()
	<-waiterStarted
	svc.Close()
	select {
	case <-waiter:
	case <-time.After(time.Second):
		t.Fatal("shutdown left broker waiter blocked")
	}
}

type brokerFailSaveStore struct {
	port.SessionStore
	err error
}

func (s brokerFailSaveStore) Save(context.Context, *session.Session) error { return s.err }

func TestInvariant_broker_finalization_is_attempt_scoped(t *testing.T) {
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
	if err := brokerRegistryBind(svc, sess.ID); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = svc.buildAndRegisterSessionEngine(context.Background(), sess, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false)
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
	first, err := runtime.OpenSession("attempt-scoped")
	if err != nil {
		t.Fatalf("open first attempt: %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("close first attempt: %v", err)
	}
	second, err := runtime.OpenSession("attempt-scoped")
	if err != nil {
		t.Fatalf("open replacement attempt: %v", err)
	}
	if err := second.Close(); err != nil {
		t.Fatalf("close replacement attempt: %v", err)
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
	if err := brokerRegistryBind(svc, first.ID, second.ID); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), first, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.buildAndRegisterSessionEngine(context.Background(), second, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err != nil {
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
	if err := brokerRegistryBind(failing, second.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := failing.buildAndRegisterSessionEngine(context.Background(), second, ProviderSelector{}, nil, ProfileDefault, session.ModeDefault, false); err == nil {
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
func brokerRegistryBind(s *Service, ids ...session.SessionID) error {
	for _, id := range ids {
		if err := s.cfg.VMCPBrokerBindings.Bind(id, s.cfg.VMCPBrokerGeneration); err != nil {
			return err
		}
	}
	return nil
}

func brokerRegistryService(t *testing.T, store *memstore.Store, r *vmcpbroker.Runtime, f SessionEngineFactory) *Service {
	return brokerRegistryServiceWithStore(t, store, r, f)
}

func brokerRegistryServiceWithStore(t *testing.T, store port.SessionStore, r *vmcpbroker.Runtime, f SessionEngineFactory) *Service {
	t.Helper()
	if f == nil {
		f = func(context.Context, ProviderSelector, []mcp.ServerConfig, SessionProfile, string, session.PermissionMode) (SessionEngineResult, error) {
			return brokerRegistryEngine(), nil
		}
	}
	s, err := NewService(Config{Engine: brokerRegistryEngine().Engine, Store: store, Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) }, SessionEngine: f, VMCPBroker: r, VMCPBrokerGeneration: r.EnrollmentID(), VMCPBrokerBindings: vmcpbroker.NewBindingIndex()})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
