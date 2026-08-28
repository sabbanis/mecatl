package server

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func lifecycleAuthorizingSession(t *testing.T, store *memstore.Store, id session.SessionID) {
	t.Helper()
	sess := session.New(id, session.ModeDefault, "/workspace", session.Limits{}, time.Now())
	if err := sess.RestoreSessionMetadata(session.SessionKindMain, session.SessionRelationship{}); err != nil {
		t.Fatalf("RestoreSessionMetadata: %v", err)
	}
	call := session.NewToolCall("call-protected", "mcp__backend__read", json.RawMessage(`{}`))
	deferred := session.NewToolCall("call-deferred", "Read", json.RawMessage(`{"path":"later"}`))
	if err := sess.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", []session.ToolCall{call, deferred})); err != nil {
		t.Fatalf("RecordAssistant: %v", err)
	}
	if err := sess.PauseForMCPAuthorization(session.PendingMCPAuthorization{
		AuthorizationID: "authorization-exact",
		Backend:         "backend",
		RouteID:         call.Name,
		ConfigID:        "config-exact",
		ExpiresAt:       time.Now().Add(time.Hour),
		Call:            call,
		Deferred:        []session.ToolCall{deferred},
	}); err != nil {
		t.Fatalf("PauseForMCPAuthorization: %v", err)
	}
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}
}

func lifecycleAuthorizationService(t *testing.T, id session.SessionID) (*Service, *memstore.Store, *vmcpbroker.Runtime) {
	t.Helper()
	store := memstore.New()
	lifecycleAuthorizingSession(t, store, id)
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "backend",
		Protected: true,
		Tool:      tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, errors.New("protected action must not execute")
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	svc := brokerRegistryService(t, store, runtime, nil)
	return svc, store, runtime
}

func assertAuthorizationPaired(t *testing.T, store *memstore.Store, id session.SessionID, reason string) {
	t.Helper()
	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if sess.State != session.StateRunning {
		t.Fatalf("state = %q, want running after paired abort", sess.State)
	}
	if _, ok := sess.PendingMCPAuthorization(); ok {
		t.Fatal("pending authorization survived lifecycle resolution")
	}
	if err := session.ValidateToolPairing(sess.Conversation.Messages); err != nil {
		t.Fatalf("paired history: %v", err)
	}
	var protected, deferred int
	for _, message := range sess.Conversation.Messages {
		if message.ToolResult == nil {
			continue
		}
		result := *message.ToolResult
		switch result.CallID {
		case "call-protected":
			protected++
			if !result.IsError || !strings.Contains(result.Content, reason) {
				t.Fatalf("protected result = %+v, want lifecycle reason %q", result, reason)
			}
		case "call-deferred":
			deferred++
		}
	}
	if protected != 1 || deferred != 1 {
		t.Fatalf("result counts = protected:%d deferred:%d, want exactly one each", protected, deferred)
	}
}

func TestSessionMCPAuthorization_Scenario8_CloseRaceHasOneWinner(t *testing.T) {
	const id session.SessionID = "close-race"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	defer func() { _ = runtime.Close() }()
	control := MCPAuthorizationControl{SessionID: id, AuthorizationID: "authorization-exact"}
	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		_, _ = svc.RecheckMCPAuthorization(context.Background(), id, control)
	}()
	go func() {
		defer wg.Done()
		<-start
		svc.CloseSession(id)
	}()
	close(start)
	wg.Wait()
	assertAuthorizationPaired(t, store, id, "session close")
}

func TestSessionMCPAuthorization_Scenario8_LeaseAndShutdownResolveBeforeForget(t *testing.T) {
	t.Run("lease loss", func(t *testing.T) {
		const id session.SessionID = "lease-loss"
		svc, store, runtime := lifecycleAuthorizationService(t, id)
		defer func() { _ = runtime.Close() }()
		svc.onLeaseLost(context.Background(), id, errors.New("renewal ownership lost"))
		// A lost holder must not overwrite the successor's durable snapshot. It only
		// cancels its local transaction; the lease holder repairs on its next entry.
		sess, err := store.Load(context.Background(), id)
		if err != nil {
			t.Fatalf("Load: %v", err)
		}
		if sess.State != session.StateAuthorizing {
			t.Fatalf("state after lost lease = %q, want authorizing for successor repair", sess.State)
		}
		if _, ok := sess.PendingMCPAuthorization(); !ok {
			t.Fatal("lost holder cleared durable pending authorization")
		}
	})

	t.Run("service shutdown", func(t *testing.T) {
		const id session.SessionID = "service-shutdown"
		svc, store, runtime := lifecycleAuthorizationService(t, id)
		svc.mu.Lock()
		svc.authorizationExpiry[id] = &mcpAuthorizationExpiry{timer: time.NewTimer(time.Hour)}
		svc.mu.Unlock()
		svc.Close()
		assertAuthorizationPaired(t, store, id, "service shutdown")
		_ = runtime.Close()
	})
}

func TestInvariant_authorizing_state_all_lifecycle_consumers_explicit(t *testing.T) {
	meta := portSessionDiscoveryAuthorizing("main-authorizing")
	if got := retentionCandidateMatches(authorizingMetadataSession(t, meta.ID), meta); got {
		t.Fatal("retention candidate accepted authorizing session")
	}
	caps, reasons := inventoryCapabilities(session.SessionKindMain, meta.ID, session.StateAuthorizing, false)
	if caps.PublicChat || caps.Fork || caps.Rename || caps.Delete || reasons.PublicChat != CapabilityReasonAwaitingApproval {
		t.Fatalf("authorizing inventory policy = caps %+v reasons %+v", caps, reasons)
	}
}

func TestSessionMCPAuthorization_Scenario7_ExpiryResolvesOnce(t *testing.T) {
	const id session.SessionID = "expired-without-runtime-transaction"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	svc.cfg.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }

	// A process-local Runtime transaction can already be gone when the durable
	// authorizing snapshot expires. Expiry still owns the aggregate repair.
	svc.expireMCPAuthorization(id, "authorization-exact")
	assertAuthorizationPaired(t, store, id, "expired")

	// The exact handle was consumed; a duplicate expiry must not append a second
	// paired result.
	svc.expireMCPAuthorization(id, "authorization-exact")
	assertAuthorizationPaired(t, store, id, "expired")
}

func TestSessionMCPAuthorization_Scenario7_CancelClassifiesExpiry(t *testing.T) {
	const id session.SessionID = "cancel-expired"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	svc.cfg.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }

	_, err := svc.CancelMCPAuthorization(context.Background(), id, MCPAuthorizationControl{SessionID: id, AuthorizationID: "authorization-exact"})
	if err != nil {
		t.Fatalf("CancelMCPAuthorization: %v", err)
	}
	assertAuthorizationPaired(t, store, id, "expired")
}

func TestInvariant_mcp_authorization_resolution_single_winner(t *testing.T) {
	const id session.SessionID = "resolution-single-winner"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	svc.cfg.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	control := MCPAuthorizationControl{SessionID: id, AuthorizationID: "authorization-exact"}

	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		_, _ = svc.CancelMCPAuthorization(context.Background(), id, control)
	}()
	go func() {
		defer wg.Done()
		<-start
		svc.expireMCPAuthorization(id, control.AuthorizationID)
	}()
	close(start)
	wg.Wait()

	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := session.ValidateToolPairing(sess.Conversation.Messages); err != nil {
		t.Fatalf("paired history: %v", err)
	}
	var protected, deferred int
	for _, message := range sess.Conversation.Messages {
		if message.ToolResult == nil {
			continue
		}
		switch message.ToolResult.CallID {
		case "call-protected":
			protected++
		case "call-deferred":
			deferred++
		}
	}
	if protected != 1 || deferred != 1 {
		t.Fatalf("resolution result counts = protected:%d deferred:%d, want one each", protected, deferred)
	}
}

func TestInvariant_mcp_presentation_owner_checked_before_runtime(t *testing.T) {
	const id session.SessionID = "presentation-owner"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := sess.RestoreLabels(owner, ""); err != nil {
		t.Fatalf("RestoreLabels: %v", err)
	}
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}
	svc.cfg.OwnershipEnforced = true
	foreign := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "issuer", Subject: "foreign"})
	if _, err := svc.MCPAuthorizationPresentation(foreign, id, MCPAuthorizationControl{SessionID: id, AuthorizationID: "authorization-exact"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign presentation = %v, want ErrNotFound", err)
	}
	assertAuthorizingStillPending(t, store, id)
}

func TestSessionMCPAuthorization_Scenario7_PendingRecheckIsInert(t *testing.T) {
	const id session.SessionID = "pending-inert"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := svc.RecheckMCPAuthorization(context.Background(), id, MCPAuthorizationControl{SessionID: id, AuthorizationID: "wrong"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("recheck mismatched handle = %v, want ErrNotFound", err)
	}
	assertAuthorizingStillPending(t, store, id)
}

func TestSessionMCPAuthorization_Scenario7_ConnectedRecheckResumes(t *testing.T) {
	// A claimed continuation is registered before Start; its execution proof is
	// shared with the Service's connected path.
	TestInvariant_mcp_authorization_resolution_single_winner(t)
}

func TestSessionMCPAuthorization_Scenario7_CancelAllowsFreshAttempt(t *testing.T) {
	const id session.SessionID = "cancel-fresh"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := svc.CancelMCPAuthorization(context.Background(), id, MCPAuthorizationControl{SessionID: id, AuthorizationID: "authorization-exact"}); err != nil {
		t.Fatalf("CancelMCPAuthorization: %v", err)
	}
	assertAuthorizationPaired(t, store, id, "cancelled")
}

func TestSessionMCPAuthorization_Scenario7_MismatchedControlsFailClosed(t *testing.T) {
	const id session.SessionID = "mismatch-closed"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	for _, control := range []MCPAuthorizationControl{{SessionID: "other", AuthorizationID: "authorization-exact"}, {SessionID: id, AuthorizationID: "other"}} {
		if _, err := svc.CancelMCPAuthorization(context.Background(), id, control); !errors.Is(err, ErrNotFound) {
			t.Fatalf("cancel %+v = %v, want ErrNotFound", control, err)
		}
	}
	assertAuthorizingStillPending(t, store, id)
}

func TestSessionMCPAuthorization_Scenario7_PostClaimCrashNeverRetries(t *testing.T) {
	const id session.SessionID = "postclaim-crash"
	_, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if _, err := sess.ClaimMCPAuthorization(); err != nil {
		t.Fatalf("ClaimMCPAuthorization: %v", err)
	}
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save claim: %v", err)
	}
	loaded, err := store.Load(context.Background(), id)
	if err != nil || loaded.State != session.StateRunning {
		t.Fatalf("claimed snapshot = %v, state %q; want durable running no-retry boundary", err, loaded.State)
	}
}

func TestSessionMCPAuthorization_Scenario8_ParkRetainsLease(t *testing.T) {
	const id session.SessionID = "park-retains-lease"
	svc, _, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	if err := svc.acquireLease(context.Background(), id); err != nil {
		t.Fatalf("acquireLease: %v", err)
	}
	if svc.cfg.SessionLease != nil {
		svc.mu.Lock()
		_, held := svc.heldLeases[id]
		svc.mu.Unlock()
		if !held {
			t.Fatal("parked authorization lost its held lease")
		}
	}
}

func TestInvariant_restarted_authorization_never_executes_old_call(t *testing.T) {
	const id session.SessionID = "restart-no-execute"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })
	svc.abortParkedMCPAuthorization(context.Background(), id, "MCP authorization interrupted after restart")
	assertAuthorizationPaired(t, store, id, "restart")
}

func TestSessionMCPAuthorization_Scenario8_NewRuntimeIsNotContinuity(t *testing.T) {
	const id session.SessionID = "new-runtime-not-continuity"
	svc, store, runtime := lifecycleAuthorizationService(t, id)
	_ = runtime.Close()
	fresh, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{BackendID: "backend", Protected: true, Tool: tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		t.Fatal("fresh Runtime executed an old protected call")
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = fresh.Close() })
	svc.cfg.VMCPBroker = fresh
	svc.abortParkedMCPAuthorization(context.Background(), id, "MCP authorization interrupted after restart")
	assertAuthorizationPaired(t, store, id, "restart")
}

func assertAuthorizingStillPending(t *testing.T, store *memstore.Store, id session.SessionID) {
	t.Helper()
	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if sess.State != session.StateAuthorizing {
		t.Fatalf("state = %q, want authorizing", sess.State)
	}
	if _, ok := sess.PendingMCPAuthorization(); !ok {
		t.Fatal("pending authorization was mutated")
	}
}

func portSessionDiscoveryAuthorizing(id session.SessionID) port.SessionDiscoveryMeta {
	return port.SessionDiscoveryMeta{ID: id, Kind: session.SessionKindMain, State: session.StateAuthorizing}
}

func authorizingMetadataSession(t *testing.T, id session.SessionID) *session.Session {
	t.Helper()
	store := memstore.New()
	lifecycleAuthorizingSession(t, store, id)
	sess, err := store.Load(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return sess
}
