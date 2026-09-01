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
	fixture := newServiceAuthorizationFixture(t)
	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	sess, err := fixture.store.Load(context.Background(), fixture.id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := sess.RestoreLabels(owner, session.Authority{}); err != nil {
		t.Fatalf("RestoreLabels: %v", err)
	}
	if err := fixture.store.Save(context.Background(), sess); err != nil {
		t.Fatalf("Save: %v", err)
	}
	fixture.svc.cfg.OwnershipEnforced = true
	foreign := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "issuer", Subject: "foreign"})
	if _, err := fixture.svc.MCPAuthorizationPresentation(foreign, fixture.id, fixture.control); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign presentation = %v, want ErrNotFound", err)
	}
	status, err := fixture.runtime.CheckAuthorization(context.Background(), fixture.id, "mcp__backend__read", fixture.control.AuthorizationID)
	if err != nil || status.Status != vmcpbroker.ConnectionPending {
		t.Fatalf("foreign presentation changed Runtime status=%+v err=%v", status, err)
	}
	assertAuthorizingStillPending(t, fixture.store, fixture.id)
}

func TestSessionMCPAuthorization_Scenario7_PendingRecheckIsInert(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	before, err := fixture.store.Load(context.Background(), fixture.id)
	if err != nil {
		t.Fatalf("Load before recheck: %v", err)
	}
	run, err := fixture.svc.RecheckMCPAuthorization(context.Background(), fixture.id, fixture.control)
	if err != nil || run != nil {
		t.Fatalf("pending RecheckMCPAuthorization = %v, %v; want nil continuation", run, err)
	}
	after, err := fixture.store.Load(context.Background(), fixture.id)
	if err != nil {
		t.Fatalf("Load after recheck: %v", err)
	}
	if after.State != session.StateAuthorizing || fixture.calls != 0 {
		t.Fatalf("pending recheck state=%q calls=%d, want authorizing and no execution", after.State, fixture.calls)
	}
	if pending, ok := after.PendingMCPAuthorization(); !ok || pending.AuthorizationID != fixture.control.AuthorizationID || len(after.Conversation.Messages) != len(before.Conversation.Messages) {
		t.Fatal("pending recheck changed the durable exact continuation")
	}
}

func TestSessionMCPAuthorization_Scenario7_ConnectedRecheckResumes(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	fixture.connect(t)

	run, err := fixture.svc.RecheckMCPAuthorization(context.Background(), fixture.id, fixture.control)
	if err != nil || run == nil {
		t.Fatalf("RecheckMCPAuthorization = %v, %v; want registered continuation", run, err)
	}
	for range run.Events() {
	}
	fixture.svc.FinishRun(fixture.id, run)
	if fixture.calls != 1 {
		t.Fatalf("protected calls = %d, want exactly one", fixture.calls)
	}
	stored, err := fixture.store.Load(context.Background(), fixture.id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if stored.State == session.StateAuthorizing {
		t.Fatal("connected recheck left the stored session authorizing")
	}
	if _, ok := stored.PendingMCPAuthorization(); ok {
		t.Fatal("connected recheck retained a pending authorization")
	}
	if _, err := fixture.svc.RecheckMCPAuthorization(context.Background(), fixture.id, fixture.control); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second recheck = %v, want ErrNotFound after the exact claim", err)
	}
}

func TestSessionMCPAuthorization_Scenario7_CancelAllowsFreshAttempt(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	run, err := fixture.svc.CancelMCPAuthorization(context.Background(), fixture.id, fixture.control)
	if err != nil || run == nil {
		t.Fatalf("CancelMCPAuthorization = %v, %v", run, err)
	}
	for range run.Events() {
	}
	fixture.svc.FinishRun(fixture.id, run)
	assertAuthorizationPaired(t, fixture.store, fixture.id, "cancelled")
	fresh, err := fixture.runtime.Connect(context.Background(), fixture.id, "backend")
	if err != nil || fresh.AuthorizationRequired == nil || fresh.AuthorizationRequired.Handle == fixture.control.AuthorizationID {
		t.Fatalf("Connect after cancel = %+v, %v; want a distinct fresh authorization", fresh, err)
	}
}

func TestSessionMCPAuthorization_Scenario7_MismatchedControlsFailClosed(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	for _, control := range []MCPAuthorizationControl{{SessionID: "other", AuthorizationID: fixture.control.AuthorizationID}, {SessionID: fixture.id, AuthorizationID: "other"}} {
		if _, err := fixture.svc.CancelMCPAuthorization(context.Background(), fixture.id, control); !errors.Is(err, ErrNotFound) {
			t.Fatalf("cancel %+v = %v, want ErrNotFound", control, err)
		}
		if _, err := fixture.svc.RecheckMCPAuthorization(context.Background(), fixture.id, control); !errors.Is(err, ErrNotFound) {
			t.Fatalf("recheck %+v = %v, want ErrNotFound", control, err)
		}
	}
	status, err := fixture.runtime.CheckAuthorization(context.Background(), fixture.id, "mcp__backend__read", fixture.control.AuthorizationID)
	if err != nil || status.Status != vmcpbroker.ConnectionPending || fixture.calls != 0 {
		t.Fatalf("mismatched controls changed Runtime status=%+v err=%v calls=%d", status, err, fixture.calls)
	}
	assertAuthorizingStillPending(t, fixture.store, fixture.id)
}

func TestSessionMCPAuthorization_Scenario7_PostClaimCrashNeverRetries(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	fixture.connect(t)
	// Registering the post-claim Run is the crash window. Closing the real Service
	// before recheck makes registration lose after the durable claim.
	fixture.svc.mu.Lock()
	fixture.svc.closed = true
	fixture.svc.mu.Unlock()
	t.Cleanup(func() {
		fixture.svc.mu.Lock()
		fixture.svc.closed = false
		fixture.svc.mu.Unlock()
	})
	if _, err := fixture.svc.RecheckMCPAuthorization(context.Background(), fixture.id, fixture.control); !errors.Is(err, ErrNoActiveRun) {
		t.Fatalf("RecheckMCPAuthorization after registration loss = %v, want ErrNoActiveRun", err)
	}
	stored, err := fixture.store.Load(context.Background(), fixture.id)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if stored.State != session.StateIdle || fixture.calls != 0 {
		t.Fatalf("post-claim repair state=%q calls=%d, want idle with no old execution", stored.State, fixture.calls)
	}
	if err := session.ValidateToolPairing(stored.Conversation.Messages); err != nil {
		t.Fatalf("post-claim repair left unmatched history: %v", err)
	}
}

func TestSessionMCPAuthorization_Scenario8_ParkRetainsLease(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	if err := fixture.svc.acquireLease(context.Background(), fixture.id); err != nil {
		t.Fatalf("acquireLease: %v", err)
	}
	fixture.svc.scheduleMCPAuthorizationExpiry(fixture.id)
	fixture.svc.mu.Lock()
	_, held := fixture.svc.heldLeases[fixture.id]
	_, expiryScheduled := fixture.svc.authorizationExpiry[fixture.id]
	fixture.svc.mu.Unlock()
	if !held || !expiryScheduled {
		t.Fatalf("parked Service lease=%t expiry=%t, want both retained without a live Run", held, expiryScheduled)
	}
	fixture.svc.CloseSession(fixture.id)
	fixture.svc.mu.Lock()
	_, held = fixture.svc.heldLeases[fixture.id]
	fixture.svc.mu.Unlock()
	if held {
		t.Fatal("session close retained the parked authorization lease")
	}
}

func TestInvariant_restarted_authorization_never_executes_old_call(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	if err := fixture.runtime.Close(); err != nil {
		t.Fatalf("close original Runtime: %v", err)
	}
	fresh, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{BackendID: "backend", Protected: true, Tool: tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		t.Fatal("a restarted Service executed the old protected call")
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = fresh.Close() })
	restarted := brokerRegistryService(t, fixture.store, fresh, nil)
	t.Cleanup(restarted.Close)
	run, err := restarted.StartRunContent(context.Background(), fixture.id, "new prompt", nil)
	if run != nil || !errors.Is(err, ErrFailedPrecondition) {
		t.Fatalf("StartRunContent after restart = %v, %v; want enrollment precondition", run, err)
	}
	assertAuthorizationPaired(t, fixture.store, fixture.id, "restart")
	if fixture.calls != 0 {
		t.Fatalf("original protected caller ran %d times after restart", fixture.calls)
	}
}

func TestSessionMCPAuthorization_Scenario8_NewRuntimeIsNotContinuity(t *testing.T) {
	fixture := newServiceAuthorizationFixture(t)
	if err := fixture.runtime.Close(); err != nil {
		t.Fatalf("close original Runtime: %v", err)
	}
	fresh, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{BackendID: "backend", Protected: true, Tool: tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		t.Fatal("fresh Runtime treated an old authorization as connected")
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = fresh.Close() })
	restarted := brokerRegistryService(t, fixture.store, fresh, nil)
	t.Cleanup(restarted.Close)
	run, err := restarted.StartRunContent(context.Background(), fixture.id, "new prompt", nil)
	if run != nil || !errors.Is(err, ErrFailedPrecondition) {
		t.Fatalf("StartRunContent with a fresh Runtime = %v, %v; want enrollment precondition", run, err)
	}
	assertAuthorizationPaired(t, fixture.store, fixture.id, "restart")
	if fixture.calls != 0 {
		t.Fatalf("original Runtime executed %d calls after replacement", fixture.calls)
	}
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
