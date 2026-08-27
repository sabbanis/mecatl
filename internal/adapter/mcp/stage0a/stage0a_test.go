package stage0a_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/ory/fosite"
	thauth "github.com/stacklok/toolhive/pkg/auth"
	"github.com/stacklok/toolhive/pkg/auth/upstreamtoken"
	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
	"github.com/stacklok/toolhive/pkg/vmcp"
	"github.com/stacklok/toolhive/pkg/vmcp/aggregator"
	vmcpauth "github.com/stacklok/toolhive/pkg/vmcp/auth"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/factory"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/strategies"
	authtypes "github.com/stacklok/toolhive/pkg/vmcp/auth/types"
	"github.com/stacklok/toolhive/pkg/vmcp/client"
	"github.com/stacklok/toolhive/pkg/vmcp/config"
	"github.com/stacklok/toolhive/pkg/vmcp/router"
	"github.com/stacklok/toolhive/pkg/vmcp/server"
	"github.com/stacklok/toolhive/pkg/vmcp/session"
)

// TestStaticEmbeddedFixture constructs the public, static ToolHive composition.
// It deliberately does not construct a Kubernetes client, operator, CRD, or workload.
func TestStaticEmbeddedFixture(t *testing.T) {
	ctx := context.Background()
	upstream := httptest.NewServer(http.NotFoundHandler())
	defer upstream.Close()

	mux := http.NewServeMux()
	gateway := httptest.NewServer(mux)
	defer gateway.Close()

	store := storage.NewMemoryStorage()
	authServer, err := runner.NewEmbeddedAuthServerWithStorage(ctx, &authserver.RunConfig{
		SchemaVersion:    "v1",
		Issuer:           gateway.URL,
		AllowedAudiences: []string{gateway.URL},
		Upstreams: []authserver.UpstreamRunConfig{{
			Name: "upstream",
			Type: authserver.UpstreamProviderTypeOAuth2,
			OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
				AuthorizationEndpoint: upstream.URL + "/authorize",
				TokenEndpoint:         upstream.URL + "/token",
				ClientID:              "stage0a-client",
				RedirectURI:           gateway.URL + "/oauth/callback",
				IdentityFromToken:     &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"},
				AllowPrivateIPs:       true,
				InsecureAllowHTTP:     true,
			},
		}},
		InsecureAllowHTTP: true,
	}, store)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	defer func() {
		if err := authServer.Close(); err != nil {
			t.Errorf("auth server close: %v", err)
		}
	}()

	reader := upstreamtoken.NewInProcessService(authServer.IDPTokenStorage(), authServer.UpstreamTokenRefresher())
	incoming, _, authInfo, err := factory.NewIncomingAuthMiddleware(ctx, &config.IncomingAuthConfig{
		Type: "oidc",
		OIDC: &config.OIDCConfig{
			Issuer: gateway.URL, Audience: gateway.URL, Resource: gateway.URL,
			JWKSURL:            gateway.URL + "/.well-known/jwks.json",
			JwksAllowPrivateIP: true, ProtectedResourceAllowPrivateIP: true, InsecureAllowHTTP: true,
		},
	}, "stage0a", nil, reader, authServer.KeyProvider())
	if err != nil {
		t.Fatalf("NewIncomingAuthMiddleware: %v", err)
	}

	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		t.Fatalf("register upstream injection: %v", err)
	}
	backendClient, err := client.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("NewHTTPBackendClient: %v", err)
	}
	resolver, err := aggregator.NewConflictResolver(&config.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		t.Fatalf("NewConflictResolver: %v", err)
	}
	registry := vmcp.NewImmutableRegistry(nil)
	srv, err := server.New(ctx, &server.Config{
		Name: "stage0a", Version: "test", AuthMiddleware: incoming, AuthInfoHandler: authInfo,
		AuthServer: authServer, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil),
		SessionFactory: session.NewSessionFactory(outgoing),
	}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, registry, nil)
	if err != nil {
		t.Fatalf("static vmcp server.New: %v", err)
	}
	defer func() {
		if err := srv.Stop(context.Background()); err != nil {
			t.Errorf("vmcp stop: %v", err)
		}
	}()
	handler, err := srv.Handler(ctx)
	if err != nil {
		t.Fatalf("vmcp Handler: %v", err)
	}
	mux.Handle("/", handler)

	response, err := gateway.Client().Get(gateway.URL + "/.well-known/jwks.json")
	if err != nil {
		t.Fatalf("embedded jwks request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("embedded jwks status = %d", response.StatusCode)
	}
}

func TestEmbeddedAuthorizationCodePKCE(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	t.Setenv("STAGE0A_CLIENT_SECRET", "client-secret-canary")
	var upstreamCode, upstreamChallenge string
	var refreshCalls int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			if r.URL.Query().Get("code_challenge_method") != "S256" || r.URL.Query().Get("code_challenge") == "" {
				http.Error(w, "invalid PKCE", http.StatusBadRequest)
				return
			}
			upstreamCode = "upstream-code"
			upstreamChallenge = r.URL.Query().Get("code_challenge")
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code="+upstreamCode+"&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
		case "/token":
			if err := r.ParseForm(); err != nil {
				t.Errorf("upstream ParseForm: %v", err)
				return
			}
			if r.Form.Get("grant_type") == "authorization_code" {
				verifier := r.Form.Get("code_verifier")
				digest := sha256.Sum256([]byte(verifier))
				if r.Form.Get("code") != upstreamCode || verifier == "" || base64.RawURLEncoding.EncodeToString(digest[:]) != upstreamChallenge {
					http.Error(w, "invalid PKCE", http.StatusBadRequest)
					return
				}
			}
			w.Header().Set("Content-Type", "application/json")
			if r.Form.Get("grant_type") == "refresh_token" {
				refreshCalls++
				switch refreshCalls {
				case 1:
					if r.Form.Get("refresh_token") != "upstream-refresh-canary" {
						http.Error(w, "invalid refresh", http.StatusBadRequest)
						return
					}
					_, _ = io.WriteString(w, `{"access_token":"upstream-access-rotated-canary","refresh_token":"upstream-refresh-rotated-canary","token_type":"Bearer","expires_in":3600,"sub":"same-subject"}`)
				case 2:
					if r.Form.Get("refresh_token") != "upstream-refresh-rotated-canary" {
						http.Error(w, "invalid refresh", http.StatusBadRequest)
						return
					}
					_, _ = io.WriteString(w, `{"access_token":"upstream-access-final-canary","refresh_token":"upstream-refresh-final-canary","token_type":"Bearer","expires_in":3600,"sub":"same-subject"}`)
				default:
					http.Error(w, "unexpected refresh", http.StatusBadRequest)
				}
				return
			}
			_, _ = io.WriteString(w, `{"access_token":"upstream-access-canary","refresh_token":"upstream-refresh-canary","token_type":"Bearer","expires_in":-1,"sub":"same-subject"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	var injectedAuthorization string
	remoteServer := mcp.NewServer(&mcp.Implementation{Name: "remote", Version: "test"}, nil)
	mcp.AddTool(remoteServer, &mcp.Tool{Name: "protected"}, func(context.Context, *mcp.CallToolRequest, struct{}) (*mcp.CallToolResult, struct{}, error) {
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "protected result"}}}, struct{}{}, nil
	})
	remoteHandler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return remoteServer }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		injectedAuthorization = r.Header.Get("Authorization")
		remoteHandler.ServeHTTP(w, r)
	}))
	defer func() {
		remote.CloseClientConnections()
		remote.Close()
	}()
	mux := http.NewServeMux()
	gateway := httptest.NewServer(mux)
	defer gateway.Close()
	store := storage.NewMemoryStorage()
	scopeStore := scopedStorage{Storage: store, scope: "owner=issuer/sub;session=stage0a;profile=profile-a;provider=upstream"}
	authServer, err := runner.NewEmbeddedAuthServerWithStorage(ctx, &authserver.RunConfig{
		SchemaVersion: "v1", Issuer: gateway.URL, AllowedAudiences: []string{gateway.URL}, InsecureAllowHTTP: true,
		Upstreams: []authserver.UpstreamRunConfig{{Name: "upstream", Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: upstream.URL + "/authorize", TokenEndpoint: upstream.URL + "/token", ClientID: "stage0a-upstream-client", ClientSecretEnvVar: "STAGE0A_CLIENT_SECRET", RedirectURI: gateway.URL + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"}, AllowPrivateIPs: true, InsecureAllowHTTP: true,
		}}},
	}, scopeStore)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	defer func() {
		if err := authServer.Close(); err != nil {
			t.Errorf("embedded authserver close: %v", err)
		}
	}()
	reader := upstreamtoken.NewInProcessService(authServer.IDPTokenStorage(), authServer.UpstreamTokenRefresher())
	incoming, _, authInfo, err := factory.NewIncomingAuthMiddleware(ctx, &config.IncomingAuthConfig{Type: "oidc", OIDC: &config.OIDCConfig{
		Issuer: gateway.URL, Audience: gateway.URL, Resource: gateway.URL, JWKSURL: gateway.URL + "/.well-known/jwks.json", JwksAllowPrivateIP: true, ProtectedResourceAllowPrivateIP: true, InsecureAllowHTTP: true,
	}}, "stage0a", nil, reader, authServer.KeyProvider())
	if err != nil {
		t.Fatalf("NewIncomingAuthMiddleware: %v", err)
	}
	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		t.Fatalf("register upstream injection: %v", err)
	}
	backendClient, err := client.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("NewHTTPBackendClient: %v", err)
	}
	resolver, err := aggregator.NewConflictResolver(&config.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		t.Fatalf("NewConflictResolver: %v", err)
	}
	registry := vmcp.NewImmutableRegistry([]vmcp.Backend{{ID: "protected", Name: "same-display-name", BaseURL: remote.URL, TransportType: "streamable-http", AuthConfig: &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: "upstream"}}}})
	vmcpServer, err := server.New(ctx, &server.Config{Name: "stage0a", Version: "test", AuthMiddleware: incoming, AuthInfoHandler: authInfo, AuthServer: authServer, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil), SessionFactory: session.NewSessionFactory(outgoing)}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, registry, nil)
	if err != nil {
		t.Fatalf("server.New: %v", err)
	}
	defer func() {
		if err := vmcpServer.Stop(ctx); err != nil {
			t.Errorf("vMCP stop: %v", err)
		}
	}()
	handler, err := vmcpServer.Handler(ctx)
	if err != nil {
		t.Fatalf("vmcp Handler: %v", err)
	}
	mux.Handle("/", handler)
	redirectURI := "https://client.invalid/callback"
	if err := store.RegisterClient(ctx, &fosite.DefaultClient{ID: "stage0a-mcp-client", RedirectURIs: []string{redirectURI}, GrantTypes: []string{"authorization_code"}, ResponseTypes: []string{"code"}, Scopes: []string{"openid"}, Audience: []string{gateway.URL}, Public: true}); err != nil {
		t.Fatalf("RegisterClient: %v", err)
	}
	verifier := "stage0a-verifier-0123456789012345678901234567890123456789"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	httpClient := *gateway.Client()
	httpClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	authorizeURL := gateway.URL + "/oauth/authorize?response_type=code&client_id=stage0a-mcp-client&redirect_uri=" + url.QueryEscape(redirectURI) + "&scope=openid&state=client-state&resource=" + url.QueryEscape(gateway.URL) + "&code_challenge=" + challenge + "&code_challenge_method=S256"
	response, err := httpClient.Get(authorizeURL)
	if err != nil {
		t.Fatalf("authorize: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusFound {
		t.Fatalf("embedded authorization request rejected")
	}
	response, err = httpClient.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("upstream authorize: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusFound {
		t.Fatalf("upstream authorize status = %d", response.StatusCode)
	}
	response, err = httpClient.Get(response.Header.Get("Location"))
	if err != nil {
		t.Fatalf("callback: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusSeeOther {
		t.Fatalf("embedded callback rejected")
	}
	callback, err := url.Parse(response.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	code := callback.Query().Get("code")
	if code == "" {
		t.Fatal("embedded callback omitted authorization code")
	}
	form := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {redirectURI}, "client_id": {"stage0a-mcp-client"}, "code_verifier": {verifier}}
	response, err = gateway.Client().Post(gateway.URL+"/oauth/token", "application/x-www-form-urlencoded", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("token exchange: %v", err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("ToolHive token exchange failed with status %d", response.StatusCode)
	}
	var tokenResponse struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResponse); err != nil || tokenResponse.AccessToken == "" {
		t.Fatalf("token exchange response: %v", err)
	}
	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "client", Version: "test"}, nil)
	clientSession, err := mcpClient.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: gateway.URL + "/mcp", DisableStandaloneSSE: true, HTTPClient: &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, Transport: bearerTransport{token: tokenResponse.AccessToken, origin: gateway.URL}}}, nil)
	if err != nil {
		t.Fatalf("authenticated MCP connect: %v", err)
	}
	defer func() {
		if err := clientSession.Close(); err != nil {
			t.Errorf("MCP client session close: %v", err)
		}
	}()
	tools, err := clientSession.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("authenticated tools/list: %v", err)
	}
	if len(tools.Tools) != 1 || tools.Tools[0].Name == "" {
		t.Fatalf("tools/list = %#v", tools.Tools)
	}
	result, err := clientSession.CallTool(ctx, &mcp.CallToolParams{Name: tools.Tools[0].Name, Arguments: map[string]any{}})
	if err != nil {
		t.Fatalf("authenticated tools/call: %v", err)
	}
	if result.IsError || len(result.Content) != 1 {
		t.Fatalf("tools/call = %#v", result)
	}
	text, ok := result.Content[0].(*mcp.TextContent)
	if !ok || text.Text != "protected result" {
		t.Fatalf("tools/call content = %#v", result.Content)
	}
	if injectedAuthorization != "Bearer upstream-access-rotated-canary" {
		t.Fatal("protected backend did not receive the rotated credential")
	}
	if refreshCalls != 1 {
		t.Fatalf("refresh calls = %d, want 1 (rotation must persist)", refreshCalls)
	}
	tsid, err := tokenSessionID(tokenResponse.AccessToken)
	if err != nil {
		t.Fatal("ToolHive token did not contain a usable session id")
	}
	rotated, err := scopeStore.GetUpstreamTokens(ctx, tsid, "upstream")
	if err != nil {
		t.Fatal("rotated upstream credential was not persisted")
	}
	rotated.ExpiresAt = time.Now().Add(-time.Second)
	if err := scopeStore.StoreUpstreamTokens(ctx, tsid, "upstream", rotated); err != nil {
		t.Fatal("could not expire rotated credential")
	}
	if _, err := clientSession.CallTool(ctx, &mcp.CallToolParams{Name: tools.Tools[0].Name, Arguments: map[string]any{}}); err != nil {
		t.Fatal("second authenticated tools/call failed")
	}
	if refreshCalls != 2 || injectedAuthorization != "Bearer upstream-access-final-canary" {
		t.Fatal("rotated refresh token was not persisted and used")
	}
	for _, canary := range []string{"upstream-access-canary", "upstream-refresh-canary", "upstream-access-rotated-canary", "upstream-refresh-rotated-canary", "client-secret-canary", "upstream-code", "stage0a-verifier-0123456789012345678901234567890123456789", scopeStore.key(tsid)} {
		if strings.Contains(string(body), canary) || strings.Contains(text.Text, canary) {
			t.Fatalf("canary leaked into client-visible token or MCP result")
		}
	}
	badPKCE, err := upstream.Client().PostForm(upstream.URL+"/token", url.Values{"grant_type": {"authorization_code"}, "code": {upstreamCode}, "code_verifier": {"wrong"}})
	if err != nil {
		t.Fatal("fake upstream PKCE rejection request failed")
	}
	defer badPKCE.Body.Close()
	if badPKCE.StatusCode != http.StatusBadRequest {
		t.Fatal("fake upstream accepted an invalid PKCE verifier")
	}
}

type bearerTransport struct {
	token  string
	origin string
}

// scopedStorage binds ToolHive's opaque tsid lookup to fixture-owned trusted
// scope. Neither browser fields nor upstream identity values contribute.
type scopedStorage struct {
	storage.Storage
	scope string
}

func (s scopedStorage) key(tsid string) string { return "stage0a/v1/" + s.scope + "/" + tsid }

func (s scopedStorage) GetDCRCredentials(ctx context.Context, key storage.DCRKey) (*storage.DCRCredentials, error) {
	return s.Storage.(storage.DCRCredentialStore).GetDCRCredentials(ctx, key)
}

func (s scopedStorage) StoreDCRCredentials(ctx context.Context, creds *storage.DCRCredentials) error {
	return s.Storage.(storage.DCRCredentialStore).StoreDCRCredentials(ctx, creds)
}

func (s scopedStorage) StoreUpstreamTokens(ctx context.Context, tsid, provider string, tokens *storage.UpstreamTokens) error {
	tokenCopy := *tokens
	tokenCopy.UserID = s.scope + "/" + tokens.UserID
	return s.Storage.StoreUpstreamTokens(ctx, s.key(tsid), provider, &tokenCopy)
}
func (s scopedStorage) GetUpstreamTokens(ctx context.Context, tsid, provider string) (*storage.UpstreamTokens, error) {
	return s.Storage.GetUpstreamTokens(ctx, s.key(tsid), provider)
}
func (s scopedStorage) GetAllUpstreamTokens(ctx context.Context, tsid string) (map[string]*storage.UpstreamTokens, error) {
	return s.Storage.GetAllUpstreamTokens(ctx, s.key(tsid))
}
func (s scopedStorage) DeleteUpstreamTokens(ctx context.Context, tsid string) error {
	return s.Storage.DeleteUpstreamTokens(ctx, s.key(tsid))
}
func (s scopedStorage) DeleteUpstreamTokensForProvider(ctx context.Context, tsid, provider string) error {
	return s.Storage.DeleteUpstreamTokensForProvider(ctx, s.key(tsid), provider)
}
func (s scopedStorage) GetLatestUpstreamTokensForUser(ctx context.Context, user, provider string) (*storage.UpstreamTokens, error) {
	return s.Storage.GetLatestUpstreamTokensForUser(ctx, s.scope+"/"+user, provider)
}

func TestScopedStorageIsolation(t *testing.T) {
	ctx := context.Background()
	base := storage.NewMemoryStorage()
	defer base.Close()
	a := scopedStorage{Storage: base, scope: "owner=issuer/sub;session=a;profile=same;provider=upstream"}
	b := scopedStorage{Storage: base, scope: "owner=issuer/sub;session=b;profile=same;provider=upstream"}
	if err := a.StoreUpstreamTokens(ctx, "same-tsid", "upstream", &storage.UpstreamTokens{AccessToken: "a", RefreshToken: "ar", ProviderID: "upstream", UserID: "same-subject"}); err != nil {
		t.Fatal(err)
	}
	if err := b.StoreUpstreamTokens(ctx, "same-tsid", "upstream", &storage.UpstreamTokens{AccessToken: "b", RefreshToken: "br", ProviderID: "upstream", UserID: "same-subject"}); err != nil {
		t.Fatal(err)
	}
	got, err := a.GetUpstreamTokens(ctx, "same-tsid", "upstream")
	if err != nil || got.AccessToken != "a" {
		t.Fatalf("scope a = %#v, %v", got, err)
	}
	got, err = b.GetUpstreamTokens(ctx, "same-tsid", "upstream")
	if err != nil || got.AccessToken != "b" {
		t.Fatalf("scope b = %#v, %v", got, err)
	}
	got, err = b.GetLatestUpstreamTokensForUser(ctx, "same-subject", "upstream")
	if err != nil || got.AccessToken != "b" {
		t.Fatalf("latest scope b = %#v, %v", got, err)
	}
	if err := a.DeleteUpstreamTokens(ctx, "same-tsid"); err != nil {
		t.Fatal(err)
	}
	got, err = b.GetUpstreamTokens(ctx, "same-tsid", "upstream")
	if err != nil || got.AccessToken != "b" {
		t.Fatalf("delete crossed scope: %#v, %v", got, err)
	}
}

func TestScopedStorageIsolationRejectsCrossScopeInjection(t *testing.T) {
	ctx := context.Background()
	base := storage.NewMemoryStorage()
	defer base.Close()
	a := scopedStorage{Storage: base, scope: "owner=issuer/sub;session=a;profile=profile-a;provider=upstream"}
	b := scopedStorage{Storage: base, scope: "owner=issuer/sub;session=b;profile=profile-b;provider=upstream"}
	if err := a.StoreUpstreamTokens(ctx, "same-tsid", "upstream", &storage.UpstreamTokens{AccessToken: "scope-a-access", RefreshToken: "scope-a-refresh", ProviderID: "upstream", UserID: "same-subject", ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	readerB := upstreamtoken.NewInProcessService(b, nil)
	credentials, failed, err := readerB.GetAllUpstreamCredentials(ctx, "same-tsid")
	if err != nil || len(failed) != 0 || len(credentials) != 0 {
		t.Fatal("scope B loaded scope A credentials")
	}
	req := httptest.NewRequest(http.MethodPost, "http://backend.invalid/mcp", nil)
	identityCtx := thauth.WithIdentity(ctx, &thauth.Identity{UpstreamTokens: map[string]string{}})
	err = strategies.NewUpstreamInjectStrategy().Authenticate(identityCtx, req, &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: "upstream"}})
	if err == nil || req.Header.Get("Authorization") != "" {
		t.Fatal("scope B injected a scope A credential")
	}
}

func TestBearerTransportRejectsCrossOriginRedirect(t *testing.T) {
	var receivedAuthorization string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuthorization = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer target.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, http.StatusFound) }))
	defer origin.Close()
	httpClient := &http.Client{Timeout: time.Second, Transport: bearerTransport{token: "test-token", origin: origin.URL}}
	if _, err := httpClient.Get(origin.URL); err == nil {
		t.Fatal("cross-origin redirect unexpectedly succeeded")
	}
	if receivedAuthorization != "" {
		t.Fatal("bearer token reached a cross-origin redirect target")
	}
}

func tokenSessionID(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("not a JWT")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	var claims struct {
		SessionID string `json:"tsid"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil || claims.SessionID == "" {
		return "", fmt.Errorf("missing tsid")
	}
	return claims.SessionID, nil
}

func (t bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Scheme+"://"+req.URL.Host != t.origin {
		return nil, fmt.Errorf("refusing bearer token outside the configured origin")
	}
	clone := req.Clone(req.Context())
	clone.Header.Set("Authorization", "Bearer "+t.token)
	return http.DefaultTransport.RoundTrip(clone)
}
