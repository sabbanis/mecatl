package vmcpbroker

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	toolhiveauth "github.com/stacklok/toolhive/pkg/auth"
	"github.com/stacklok/toolhive/pkg/auth/upstreamtoken"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
	"github.com/stacklok/toolhive/pkg/vmcp"
	"github.com/stacklok/toolhive/pkg/vmcp/aggregator"
	vmcpauth "github.com/stacklok/toolhive/pkg/vmcp/auth"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/strategies"
	authtypes "github.com/stacklok/toolhive/pkg/vmcp/auth/types"
	vmcpclient "github.com/stacklok/toolhive/pkg/vmcp/client"
)

func TestBundledWorkspaceEnrollment_Scenario11_ProviderScopedAuthenticatedDiscovery(t *testing.T) {
	tokens := &recordingUpstreamTokens{credentials: map[string]upstreamtoken.UpstreamCredential{
		"auth-session/provider-a": {AccessToken: "credential-a"},
		"auth-session/provider-b": {AccessToken: "credential-b"},
	}}
	queries := &recordingCapabilityQuerier{wantTokens: map[string]string{"backend-a": "credential-a", "backend-b": "credential-b"}}
	process := discoveryTestProcess(tokens, queries)

	for _, backendID := range []string{"backend-a", "backend-b"} {
		got, err := process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), backendID)
		if err != nil {
			t.Fatalf("QueryAuthenticatedCapabilities(%q): %v", backendID, err)
		}
		if got.BackendID != backendID || len(got.Tools) != 1 || got.Tools[0].BackendID != backendID {
			t.Fatalf("capability candidates for %q = %#v", backendID, got)
		}
		if strings.Contains(got.Tools[0].Name, "provider-") || strings.Contains(got.Tools[0].Name, "credential-") {
			t.Fatalf("candidate leaked private provider material: %#v", got)
		}
	}
	if got := strings.Join(tokens.calls, ","); got != "auth-session/provider-a,auth-session/provider-b" {
		t.Fatalf("token lookups = %q, want backend-scoped provider pairs", got)
	}
	if got := strings.Join(queries.backends, ","); got != "backend-a,backend-b" {
		t.Fatalf("QueryCapabilities backends = %q, want one provider-scoped call each", got)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_RealToolHiveProviderScopedQuery(t *testing.T) {
	var requests atomic.Int32
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "status", Description: "status"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{}, struct{}{}, nil
	})
	mcpHandler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer credential-a" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		requests.Add(1)
		mcpHandler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		t.Fatalf("RegisterStrategy: %v", err)
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("NewHTTPBackendClient: %v", err)
	}
	resolver := aggregator.NewPrefixConflictResolver("{workload}_")
	backend := vmcp.Backend{ID: "backend-a", Name: "backend-a", BaseURL: server.URL, TransportType: "streamable-http", AuthConfig: upstreamInject("provider-a")}
	process := &Process{discovery: &authenticatedDiscovery{
		capabilities:  aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil),
		backends:      vmcp.NewImmutableRegistry([]vmcp.Backend{backend}),
		tokens:        &recordingUpstreamTokens{credentials: map[string]upstreamtoken.UpstreamCredential{"auth-session/provider-a": {AccessToken: "credential-a"}}},
		providerNames: map[string]string{"backend-a": "provider-a"},
	}}

	got, err := process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), "backend-a")
	if err != nil {
		t.Fatalf("QueryAuthenticatedCapabilities: %v", err)
	}
	if requests.Load() == 0 || len(got.Tools) != 1 || got.Tools[0].Name != "mcp__backend-a__status" {
		t.Fatalf("real ToolHive query requests/result = %d/%#v", requests.Load(), got)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedDiscoveryFailsClosed(t *testing.T) {
	tokens := &recordingUpstreamTokens{credentials: map[string]upstreamtoken.UpstreamCredential{"auth-session/provider-a": {AccessToken: "credential-a"}}}
	queries := &recordingCapabilityQuerier{wantTokens: map[string]string{"backend-a": "credential-a"}}
	process := discoveryTestProcess(tokens, queries)

	for _, backendID := range []string{"unknown", "anonymous"} {
		_, err := process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), backendID)
		if !errors.Is(err, ErrInvalidControlTarget) {
			t.Fatalf("QueryAuthenticatedCapabilities(%q) error = %v, want ErrInvalidControlTarget", backendID, err)
		}
	}
	if len(tokens.calls) != 0 || len(queries.backends) != 0 {
		t.Fatalf("invalid targets reached credentials/query: %#v/%#v", tokens.calls, queries.backends)
	}

	tokens.err = errors.New("provider-a credential-a auth-session")
	_, err := process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), "backend-a")
	if !errors.Is(err, ErrAuthenticatedDiscovery) || containsDiscoverySecret(err.Error()) {
		t.Fatalf("credential failure = %q, want generic non-secret error", err)
	}
	tokens.err = nil
	queries.err = errors.New("provider-a credential-a auth-session")
	_, err = process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), "backend-a")
	if !errors.Is(err, ErrAuthenticatedDiscovery) || containsDiscoverySecret(err.Error()) {
		t.Fatalf("query failure = %q, want generic non-secret error", err)
	}
	queries.err = nil
	queries.description = "credential-a"
	_, err = process.QueryAuthenticatedCapabilities(t.Context(), ToolHiveAuthSessionID("auth-session"), "backend-a")
	if !errors.Is(err, ErrAuthenticatedDiscovery) || containsDiscoverySecret(err.Error()) {
		t.Fatalf("credential-echo candidate failure = %q, want generic non-secret error", err)
	}
}

func TestAuthenticatedDiscovery_TerminalRefreshDeletesOnlyProvider(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	for _, provider := range []string{"provider-a", "provider-b"} {
		if err := store.StoreUpstreamTokens(t.Context(), "auth-session", provider, &storage.UpstreamTokens{ProviderID: provider, AccessToken: provider + "-credential", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
			t.Fatalf("StoreUpstreamTokens: %v", err)
		}
	}
	deleter := &countingTokenStorage{upstreamTokenDeleter: store}
	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{err: upstreamtoken.ErrRefreshFailed}, deleter: deleter}
	process := discoveryTestProcess(wrapped, &recordingCapabilityQuerier{})

	if _, err := process.QueryAuthenticatedCapabilities(t.Context(), "auth-session", "backend-a"); !errors.Is(err, ErrAuthenticatedDiscovery) {
		t.Fatalf("QueryAuthenticatedCapabilities: %v", err)
	}
	if got := deleter.providerDeletes.Load(); got != 1 {
		t.Fatalf("provider deletion attempts = %d, want exactly 1", got)
	}
	remaining, err := store.GetAllUpstreamTokens(t.Context(), "auth-session")
	if err != nil {
		t.Fatalf("GetAllUpstreamTokens: %v", err)
	}
	if _, deleted := remaining["provider-a"]; deleted || remaining["provider-b"] == nil {
		t.Fatalf("provider-scoped cleanup retained rows = %v, want provider-b only", mapKeys(remaining))
	}
}

func TestCleaningUpstreamTokens_BulkRefreshFailureDeletesOnlyFailedProvider(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	for _, provider := range []string{"provider-a", "provider-b"} {
		if err := store.StoreUpstreamTokens(t.Context(), "auth-session", provider, &storage.UpstreamTokens{ProviderID: provider, AccessToken: provider + "-credential", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
			t.Fatalf("StoreUpstreamTokens: %v", err)
		}
	}
	deleter := &countingTokenStorage{upstreamTokenDeleter: store}
	wrapped := &cleaningUpstreamTokens{
		service: bulkTokenService{credentials: map[string]upstreamtoken.UpstreamCredential{"provider-b": {AccessToken: "credential-b"}}, failed: []string{"provider-a"}},
		deleter: deleter,
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	credentials, failed, err := wrapped.GetAllUpstreamCredentials(ctx, "auth-session")
	if err != nil || credentials["provider-b"].AccessToken != "credential-b" || len(failed) != 1 || failed[0] != "provider-a" {
		t.Fatalf("GetAllUpstreamCredentials = %#v/%v/%v", credentials, failed, err)
	}
	if got := deleter.providerDeletes.Load(); got != 1 {
		t.Fatalf("bulk provider deletion attempts = %d, want exactly 1", got)
	}
	remaining, err := store.GetAllUpstreamTokens(t.Context(), "auth-session")
	if err != nil || remaining["provider-a"] != nil || remaining["provider-b"] == nil {
		t.Fatalf("bulk terminal cleanup retained rows = %v, want provider-b only (err=%v)", mapKeys(remaining), err)
	}
}

func TestAuthenticatedDiscovery_GenericFailureDoesNotDelete(t *testing.T) {
	store := storage.NewMemoryStorage()
	t.Cleanup(func() { _ = store.Close() })
	if err := store.StoreUpstreamTokens(t.Context(), "auth-session", "provider-a", &storage.UpstreamTokens{ProviderID: "provider-a", AccessToken: "credential", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatalf("StoreUpstreamTokens: %v", err)
	}
	deleter := &countingTokenStorage{upstreamTokenDeleter: store}
	wrapped := &cleaningUpstreamTokens{service: bulkTokenService{err: context.Canceled}, deleter: deleter}
	process := discoveryTestProcess(wrapped, &recordingCapabilityQuerier{})

	_, _ = process.QueryAuthenticatedCapabilities(t.Context(), "auth-session", "backend-a")
	if got := deleter.providerDeletes.Load(); got != 0 {
		t.Fatalf("generic failure deletion attempts = %d, want 0", got)
	}
	remaining, err := store.GetAllUpstreamTokens(t.Context(), "auth-session")
	if err != nil || remaining["provider-a"] == nil {
		t.Fatalf("generic failure deleted provider row: remaining=%v err=%v", mapKeys(remaining), err)
	}
}

func mapKeys[V any](values map[string]V) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}

func discoveryTestProcess(tokens upstreamCredentialReader, queries capabilityQuerier) *Process {
	backends := []vmcp.Backend{
		{ID: "backend-a", Name: "backend-a", AuthConfig: upstreamInject("provider-a")},
		{ID: "backend-b", Name: "backend-b", AuthConfig: upstreamInject("provider-b")},
		{ID: "anonymous", Name: "anonymous"},
	}
	return &Process{discovery: &authenticatedDiscovery{
		capabilities:  queries,
		backends:      vmcp.NewImmutableRegistry(backends),
		tokens:        tokens,
		providerNames: map[string]string{"backend-a": "provider-a", "backend-b": "provider-b"},
	}}
}

func upstreamInject(provider string) *authtypes.BackendAuthStrategy {
	return &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: provider}}
}

type countingTokenStorage struct {
	upstreamTokenDeleter
	providerDeletes atomic.Int32
	sessionDeletes  atomic.Int32
}

func (s *countingTokenStorage) DeleteUpstreamTokens(ctx context.Context, authSession string) error {
	s.sessionDeletes.Add(1)
	return s.upstreamTokenDeleter.DeleteUpstreamTokens(ctx, authSession)
}

func (s *countingTokenStorage) DeleteUpstreamTokensForProvider(ctx context.Context, authSession, provider string) error {
	s.providerDeletes.Add(1)
	return s.upstreamTokenDeleter.DeleteUpstreamTokensForProvider(ctx, authSession, provider)
}

type bulkTokenService struct {
	credentials map[string]upstreamtoken.UpstreamCredential
	failed      []string
	err         error
}

func (s bulkTokenService) GetValidTokens(context.Context, string, string) (*upstreamtoken.UpstreamCredential, error) {
	return nil, s.err
}

func (s bulkTokenService) GetAllUpstreamCredentials(context.Context, string) (map[string]upstreamtoken.UpstreamCredential, []string, error) {
	return s.credentials, s.failed, s.err
}

type recordingUpstreamTokens struct {
	credentials map[string]upstreamtoken.UpstreamCredential
	calls       []string
	err         error
}

func (r *recordingUpstreamTokens) GetValidTokens(_ context.Context, sessionID, providerName string) (*upstreamtoken.UpstreamCredential, error) {
	r.calls = append(r.calls, sessionID+"/"+providerName)
	if r.err != nil {
		return nil, r.err
	}
	credential, ok := r.credentials[sessionID+"/"+providerName]
	if !ok {
		return nil, errors.New("missing credential")
	}
	return &credential, nil
}

// recordingCapabilityQuerier deliberately implements only QueryCapabilities;
// the retained discovery seam has no QueryAllCapabilities surface to invoke.
type recordingCapabilityQuerier struct {
	wantTokens  map[string]string
	backends    []string
	description string
	err         error
	beforeQuery func(string) error
}

func (r *recordingCapabilityQuerier) QueryCapabilities(ctx context.Context, backend vmcp.Backend) (*aggregator.BackendCapabilities, error) {
	r.backends = append(r.backends, backend.ID)
	if r.beforeQuery != nil {
		if err := r.beforeQuery(backend.ID); err != nil {
			return nil, err
		}
	}
	if r.err != nil {
		return nil, r.err
	}
	identity, ok := toolhiveauth.IdentityFromContext(ctx)
	if !ok || len(identity.UpstreamTokens) != 1 || identity.UpstreamTokens[backend.AuthConfig.UpstreamInject.ProviderName] != r.wantTokens[backend.ID] {
		return nil, errors.New("wrong provider credential")
	}
	description := r.description
	if description == "" {
		description = "status"
	}
	return &aggregator.BackendCapabilities{BackendID: backend.ID, Tools: []vmcp.Tool{{Name: "status", Description: description, InputSchema: map[string]any{"type": "object"}, BackendID: backend.ID}}}, nil
}

func containsDiscoverySecret(value string) bool {
	return strings.Contains(value, "provider-a") || strings.Contains(value, "credential-a") || strings.Contains(value, "auth-session")
}
