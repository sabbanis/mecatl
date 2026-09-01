package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stacklok/toolhive/pkg/authserver/storage"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestDisconnectDeletesOnlyKnownProviderRows(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	for _, provider := range []string{"github-provider", "calendar-provider"} {
		if err := store.StoreUpstreamTokens(t.Context(), "auth-session", provider, &storage.UpstreamTokens{ProviderID: provider, AccessToken: provider, ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
			t.Fatalf("StoreUpstreamTokens: %v", err)
		}
	}
	runtime := newLifecycleRuntime(t, []Route{
		{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}},
		{BackendID: "calendar", Protected: true, Tool: tool.ToolSpec{Name: "calendar", Schema: json.RawMessage(`{}`)}},
	})
	openLifecycleSession(t, runtime, "parent")
	runtime.mu.Lock()
	runtime.tokenDeleter = store
	runtime.providerNames = map[string]string{"github": "github-provider", "calendar": "calendar-provider"}
	runtime.lifecycles["parent"].authSessions["auth-session"] = map[string]struct{}{"github-provider": {}, "calendar-provider": {}}
	runtime.mu.Unlock()

	if err := runtime.Disconnect("parent", "github"); err != nil {
		t.Fatalf("Disconnect: %v", err)
	}
	remaining, err := store.GetAllUpstreamTokens(t.Context(), "auth-session")
	if err != nil || remaining["github-provider"] != nil || remaining["calendar-provider"] == nil {
		t.Fatalf("provider rows after disconnect = %v, err=%v", mapKeys(remaining), err)
	}
}

func TestForgetDeletesRetainedAuthSessionsAfterTransportDrain(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	for _, authSession := range []string{"auth-generation-one", "auth-generation-two"} {
		if err := store.StoreUpstreamTokens(t.Context(), authSession, "provider", &storage.UpstreamTokens{ProviderID: "provider", AccessToken: authSession, ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
			t.Fatalf("StoreUpstreamTokens: %v", err)
		}
	}
	var drained atomic.Bool
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}}})
	opened := openLifecycleSession(t, runtime, "parent")
	opened.closeFunc = func() error { drained.Store(true); return nil }
	runtime.mu.Lock()
	runtime.tokenDeleter = drainCheckingTokenStorage{UpstreamTokenStorage: store, drained: &drained}
	runtime.lifecycles["parent"].authSessions["auth-generation-one"] = map[string]struct{}{"provider": {}}
	runtime.lifecycles["parent"].authSessions["auth-generation-two"] = map[string]struct{}{"provider": {}}
	// Grant invalidation must not erase the retained cleanup identities.
	runtime.grants[controlTarget{sessionID: "parent", backendID: "github"}] = downstreamGrant{authSession: "auth-generation-two"}
	runtime.mu.Unlock()
	runtime.invalidateProtectedAdmission("parent")

	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("ForgetSession: %v", err)
	}
	for _, authSession := range []string{"auth-generation-one", "auth-generation-two"} {
		remaining, err := store.GetAllUpstreamTokens(t.Context(), authSession)
		if err != nil || len(remaining) != 0 {
			t.Fatalf("retained rows for forgotten auth session: rows=%v err=%v", mapKeys(remaining), err)
		}
	}
	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("idempotent ForgetSession: %v", err)
	}
}

func TestForgetCleanupFailureTearsDownAndRetriesIdempotently(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	if err := store.StoreUpstreamTokens(t.Context(), "private-auth-session", "private-provider", &storage.UpstreamTokens{ProviderID: "private-provider", AccessToken: "private-token", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatalf("StoreUpstreamTokens: %v", err)
	}
	flaky := &failOnceTokenStorage{UpstreamTokenStorage: store}
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}}})
	openLifecycleSession(t, runtime, "parent")
	runtime.mu.Lock()
	runtime.tokenDeleter = flaky
	runtime.lifecycles["parent"].authSessions["private-auth-session"] = map[string]struct{}{"private-provider": {}}
	runtime.tokenCleanup[tokenCleanupTarget{authSession: "private-auth-session", provider: "private-provider"}] = struct{}{}
	runtime.mu.Unlock()

	err := runtime.ForgetSession("parent")
	if !errors.Is(err, errAuthorizationCleanup) || err.Error() != errAuthorizationCleanup.Error() || strings.Contains(err.Error(), "private-") {
		t.Fatalf("first ForgetSession error = %q, want fixed private cleanup error", err)
	}
	runtime.mu.RLock()
	_, sessionExists := runtime.sessions["parent"]
	_, lifecycleExists := runtime.lifecycles["parent"]
	_, tombstoned := runtime.tombstones["parent"]
	runtime.mu.RUnlock()
	if sessionExists || lifecycleExists || tombstoned {
		t.Fatalf("failed cleanup retained in-memory state: session/lifecycle/tombstone=%t/%t/%t", sessionExists, lifecycleExists, tombstoned)
	}

	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("retry ForgetSession: %v", err)
	}
	remaining, err := store.GetAllUpstreamTokens(t.Context(), "private-auth-session")
	if err != nil || len(remaining) != 0 {
		t.Fatalf("retry retained token rows: rows=%v err=%v", mapKeys(remaining), err)
	}
	runtime.mu.RLock()
	remainingBacklog := len(runtime.tokenCleanup)
	runtime.mu.RUnlock()
	if remainingBacklog != 0 {
		t.Fatalf("retry retained %d cleanup targets", remainingBacklog)
	}
}

func TestSuccessfulProviderCleanupClearsCoveredBacklogOnly(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	runtime := newLifecycleRuntime(t, nil)
	runtime.mu.Lock()
	runtime.tokenDeleter = store
	runtime.tokenCleanup[tokenCleanupTarget{authSession: "auth-session", provider: "provider-a"}] = struct{}{}
	runtime.tokenCleanup[tokenCleanupTarget{owner: "parent", authSession: "auth-session", provider: "provider-a"}] = struct{}{}
	sibling := tokenCleanupTarget{owner: "parent", authSession: "auth-session", provider: "provider-b"}
	runtime.tokenCleanup[sibling] = struct{}{}
	runtime.mu.Unlock()

	if err := runtime.cleanupTokenTargets([]tokenCleanupTarget{{owner: "other", authSession: "auth-session", provider: "provider-a"}}); err != nil {
		t.Fatalf("cleanupTokenTargets: %v", err)
	}
	runtime.mu.RLock()
	_, siblingRetained := runtime.tokenCleanup[sibling]
	remaining := len(runtime.tokenCleanup)
	runtime.mu.RUnlock()
	if !siblingRetained || remaining != 1 {
		t.Fatalf("provider cleanup backlog count/sibling = %d/%t, want 1/true", remaining, siblingRetained)
	}
}

func TestSuccessfulBundleCleanupClearsAllCoveredBacklog(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	runtime := newLifecycleRuntime(t, nil)
	other := tokenCleanupTarget{authSession: "other-auth-session", provider: "provider"}
	runtime.mu.Lock()
	runtime.tokenDeleter = store
	for _, target := range []tokenCleanupTarget{
		{authSession: "auth-session", provider: "provider-a"},
		{owner: "parent", authSession: "auth-session", provider: "provider-b"},
		{owner: "parent", authSession: "auth-session"},
		other,
	} {
		runtime.tokenCleanup[target] = struct{}{}
	}
	runtime.mu.Unlock()

	if err := runtime.cleanupTokenTargets([]tokenCleanupTarget{{owner: "parent", authSession: "auth-session"}}); err != nil {
		t.Fatalf("cleanupTokenTargets: %v", err)
	}
	runtime.mu.RLock()
	_, otherRetained := runtime.tokenCleanup[other]
	remaining := len(runtime.tokenCleanup)
	runtime.mu.RUnlock()
	if !otherRetained || remaining != 1 {
		t.Fatalf("bundle cleanup backlog count/other = %d/%t, want 1/true", remaining, otherRetained)
	}
}

func TestRuntimeCloseRetriesAllCleanupBacklog(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	if err := store.StoreUpstreamTokens(t.Context(), "auth-session", "provider", &storage.UpstreamTokens{ProviderID: "provider", AccessToken: "token", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatalf("StoreUpstreamTokens: %v", err)
	}
	counting := &countingTokenStorage{upstreamTokenDeleter: store}
	runtime := newLifecycleRuntime(t, nil)
	runtime.mu.Lock()
	runtime.tokenDeleter = counting
	runtime.tokenCleanup[tokenCleanupTarget{authSession: "auth-session", provider: "provider"}] = struct{}{}
	runtime.mu.Unlock()

	if err := runtime.Close(); err != nil {
		t.Fatalf("Runtime.Close: %v", err)
	}
	if got := counting.providerDeletes.Load(); got != 1 {
		t.Fatalf("Runtime.Close provider deletion attempts = %d, want 1", got)
	}
	runtime.mu.RLock()
	remainingBacklog := len(runtime.tokenCleanup)
	runtime.mu.RUnlock()
	if remainingBacklog != 0 {
		t.Fatalf("Runtime.Close retained %d cleanup targets", remainingBacklog)
	}
}

func TestSessionVMCPBroker_Scenario4_DisconnectIsBackendScoped(t *testing.T) {
	runtime := newLifecycleRuntime(t, []Route{
		{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}},
		{BackendID: "calendar", Protected: true, Tool: tool.ToolSpec{Name: "calendar", Schema: json.RawMessage(`{}`)}},
	})
	openLifecycleSession(t, runtime, "parent")
	github := controlTarget{sessionID: "parent", backendID: "github"}
	calendar := controlTarget{sessionID: "parent", backendID: "calendar"}
	runtime.mu.Lock()
	runtime.grants[github] = downstreamGrant{accessToken: "github"}
	runtime.grants[calendar] = downstreamGrant{accessToken: "calendar"}
	runtime.transactions[github] = authorizationTransaction{handle: "pending", expiresAt: time.Now().Add(time.Minute)}
	runtime.mu.Unlock()

	if err := runtime.Disconnect("parent", "github"); err != nil {
		t.Fatalf("Disconnect: %v", err)
	}
	if err := runtime.Disconnect("parent", "github"); err != nil {
		t.Fatalf("second Disconnect: %v", err)
	}
	runtime.mu.RLock()
	_, githubGrant := runtime.grants[github]
	_, githubTransaction := runtime.transactions[github]
	_, calendarGrant := runtime.grants[calendar]
	runtime.mu.RUnlock()
	if githubGrant || githubTransaction || !calendarGrant {
		t.Fatalf("disconnect state github grant/pending/calendar grant = %t/%t/%t, want false/false/true", githubGrant, githubTransaction, calendarGrant)
	}
}

func TestSessionVMCPBroker_Scenario4_ReconnectRequiresConnectUpstream(t *testing.T) {
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}}})
	openLifecycleSession(t, runtime, "parent")
	runtime.authorizeEndpoint = "https://broker.invalid/oauth/authorize"
	runtime.callbackURL = "https://client.invalid/callback"
	runtime.clientID = "client"
	if err := runtime.Disconnect("parent", "github"); err != nil {
		t.Fatalf("Disconnect: %v", err)
	}
	_, err := runtime.Connect(context.Background(), "parent", "github")
	if !errors.Is(err, ErrUnsupportedCapability) {
		t.Fatalf("Connect after Disconnect error = %v, want ErrUnsupportedCapability", err)
	}
	if got := err.Error(); got == "" || containsCredentialMaterial(got) {
		t.Fatalf("reconnect error = %q, want documented non-secret limitation", got)
	}
}

func TestSessionVMCPBroker_Scenario4_ForgetRevokesAndTombstones(t *testing.T) {
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}}})
	openLifecycleSession(t, runtime, "parent")
	target := controlTarget{sessionID: "parent", backendID: "github"}
	runtime.mu.Lock()
	runtime.grants[target] = downstreamGrant{accessToken: "access", refreshToken: "refresh"}
	runtime.transactions[target] = authorizationTransaction{handle: "pending", expiresAt: time.Now().Add(time.Minute)}
	runtime.mu.Unlock()

	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("ForgetSession: %v", err)
	}
	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("second ForgetSession: %v", err)
	}
	runtime.mu.RLock()
	_, opened := runtime.sessions["parent"]
	_, tombstoned := runtime.tombstones["parent"]
	_, grant := runtime.grants[target]
	_, pending := runtime.transactions[target]
	runtime.mu.RUnlock()
	if opened || tombstoned || grant || pending {
		t.Fatalf("forget state opened/tombstoned/grant/pending = %t/%t/%t/%t, want false/false/false/false", opened, tombstoned, grant, pending)
	}
}

func TestSessionVMCPBroker_Scenario4_LateOperationsCannotResurrect(t *testing.T) {
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github", Schema: json.RawMessage(`{}`)}}})
	openLifecycleSession(t, runtime, "parent")
	target := controlTarget{sessionID: "parent", backendID: "github"}
	runtime.mu.Lock()
	runtime.grants[target] = downstreamGrant{accessToken: "old", refreshToken: "refresh"}
	runtime.mu.Unlock()
	if err := runtime.ForgetSession("parent"); err != nil {
		t.Fatalf("ForgetSession: %v", err)
	}
	if err := runtime.restoreGrant(target, downstreamGrant{accessToken: "late"}); !errors.Is(err, ErrInvalidControlTarget) {
		t.Fatalf("late grant restore error = %v, want ErrInvalidControlTarget", err)
	}
	if err := runtime.Disconnect("parent", "github"); !errors.Is(err, ErrInvalidControlTarget) {
		t.Fatalf("late Disconnect: %v, want ErrInvalidControlTarget", err)
	}
	if _, err := runtime.Connect(context.Background(), "parent", "github"); !errors.Is(err, ErrInvalidControlTarget) {
		t.Fatalf("late Connect error = %v, want ErrInvalidControlTarget", err)
	}
}

func TestSessionVMCPBroker_Scenario4_CloseDrainsInFlightCall(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	runtime, err := NewRuntime([]Route{{BackendID: "calendar", Tool: tool.ToolSpec{Name: "calendar", Schema: json.RawMessage(`{}`)}}}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		calls.Add(1)
		close(started)
		<-release
		return session.NewToolResult("call", "done"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	tools := openLifecycleSession(t, runtime, "parent")
	callDone := make(chan error, 1)
	go func() {
		_, err := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "calendar", json.RawMessage(`{}`)), tool.Environment{})
		callDone <- err
	}()
	<-started
	closed := make(chan error, 1)
	go func() { closed <- tools.Close() }()
	select {
	case err := <-closed:
		t.Fatalf("Close returned before in-flight call settled: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	if _, err := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("new", "calendar", json.RawMessage(`{}`)), tool.Environment{}); !errors.Is(err, ErrClosed) {
		t.Fatalf("new call after Close started error = %v, want ErrClosed", err)
	}
	close(release)
	if err := <-callDone; err != nil {
		t.Fatalf("in-flight Execute: %v", err)
	}
	if err := <-closed; err != nil {
		t.Fatalf("Close: %v", err)
	}
	runtime.mu.RLock()
	_, exists := runtime.sessions["parent"]
	runtime.mu.RUnlock()
	if exists || calls.Load() != 1 {
		t.Fatalf("post-close session exists/calls = %t/%d, want false/1", exists, calls.Load())
	}
}

func TestSessionVMCPBroker_Scenario5_SessionCloseOrdering(t *testing.T) {
	var firstClosed, secondClosed atomic.Bool
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "calendar", Tool: tool.ToolSpec{Name: "calendar", Schema: json.RawMessage(`{}`)}}})
	first := openLifecycleSession(t, runtime, "first")
	second := openLifecycleSession(t, runtime, "second")
	first.closeFunc = func() error { firstClosed.Store(true); return nil }
	second.closeFunc = func() error { secondClosed.Store(true); return nil }
	if err := first.Close(); err != nil {
		t.Fatalf("first.Close: %v", err)
	}
	if !firstClosed.Load() || secondClosed.Load() {
		t.Fatalf("close ownership first/second = %t/%t, want true/false", firstClosed.Load(), secondClosed.Load())
	}
	if _, err := second.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "calendar", json.RawMessage(`{}`)), tool.Environment{}); err != nil {
		t.Fatalf("second tool after first Close: %v", err)
	}
}

func TestSessionVMCPBroker_Scenario5_RuntimeCloseOrdering(t *testing.T) {
	var order []string
	runtime := newLifecycleRuntime(t, []Route{{BackendID: "calendar", Tool: tool.ToolSpec{Name: "calendar", Schema: json.RawMessage(`{}`)}}})
	runtime.sharedClosers = []namedCloser{{name: "vmcp", close: func() error { order = append(order, "vmcp"); return nil }}, {name: "authserver", close: func() error { order = append(order, "authserver"); return nil }}}
	tools := openLifecycleSession(t, runtime, "parent")
	if err := runtime.Close(); err != nil {
		t.Fatalf("Runtime.Close: %v", err)
	}
	if err := runtime.Close(); err != nil {
		t.Fatalf("second Runtime.Close: %v", err)
	}
	if got := strings.Join(order, ","); got != "vmcp,authserver" {
		t.Fatalf("shared close order = %q, want vmcp,authserver (authserver owns storage)", got)
	}
	if _, err := runtime.OpenSession("new"); !errors.Is(err, ErrClosed) {
		t.Fatalf("OpenSession after Runtime.Close error = %v, want ErrClosed", err)
	}
	if _, err := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "calendar", json.RawMessage(`{}`)), tool.Environment{}); !errors.Is(err, ErrClosed) {
		t.Fatalf("tool call after Runtime.Close error = %v, want ErrClosed", err)
	}
}

func TestToolHiveClientRegistry_HasNoRemovalAPI(t *testing.T) {
	registry := reflect.TypeFor[storage.ClientRegistry]()
	if _, exists := registry.MethodByName("RemoveClient"); exists {
		t.Fatal("ToolHive ClientRegistry now exposes RemoveClient; Runtime.Close must use it directly")
	}
}

type failOnceTokenStorage struct {
	storage.UpstreamTokenStorage
	failed atomic.Bool
}

func (s *failOnceTokenStorage) DeleteUpstreamTokens(ctx context.Context, authSession string) error {
	if s.failed.CompareAndSwap(false, true) {
		return errors.New("private storage failure")
	}
	return s.UpstreamTokenStorage.DeleteUpstreamTokens(ctx, authSession)
}

type drainCheckingTokenStorage struct {
	storage.UpstreamTokenStorage
	drained *atomic.Bool
}

func (s drainCheckingTokenStorage) DeleteUpstreamTokens(ctx context.Context, authSession string) error {
	if !s.drained.Load() {
		return errors.New("cleanup ran before transport drain")
	}
	return s.UpstreamTokenStorage.DeleteUpstreamTokens(ctx, authSession)
}

func (s drainCheckingTokenStorage) DeleteUpstreamTokensForProvider(ctx context.Context, authSession, provider string) error {
	if !s.drained.Load() {
		return errors.New("cleanup ran before transport drain")
	}
	return s.UpstreamTokenStorage.DeleteUpstreamTokensForProvider(ctx, authSession, provider)
}

func newLifecycleRuntime(t *testing.T, routes []Route) *Runtime {
	t.Helper()
	runtime, err := NewRuntime(routes, func(_ context.Context, _ session.SessionID, _ Route, _ json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	return runtime
}

func openLifecycleSession(t *testing.T, runtime *Runtime, id session.SessionID) *SessionTools {
	t.Helper()
	tools, err := runtime.OpenSession(id)
	if err != nil {
		t.Fatalf("OpenSession(%q): %v", id, err)
	}
	return tools
}

func containsCredentialMaterial(value string) bool {
	for _, forbidden := range []string{"access", "refresh", "token", "secret", "verifier", "code"} {
		if strings.Contains(strings.ToLower(value), forbidden) {
			return true
		}
	}
	return false
}
