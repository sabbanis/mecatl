// Package vmcpbroker owns the root-internal boundary for session-scoped vMCP
// tools. It deliberately projects only neutral ToolSpecs into the engine; the
// route used to execute a wrapper remains in this adapter.
package vmcpbroker

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ory/fosite"
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
	vmcpclient "github.com/stacklok/toolhive/pkg/vmcp/client"
	vmcpconfig "github.com/stacklok/toolhive/pkg/vmcp/config"
	"github.com/stacklok/toolhive/pkg/vmcp/router"
	vmcpserver "github.com/stacklok/toolhive/pkg/vmcp/server"
	vmcpsession "github.com/stacklok/toolhive/pkg/vmcp/session"
	"golang.org/x/oauth2"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

// ErrClosed reports an operation on a closed runtime or session tool set.
var ErrClosed = errors.New("vmcpbroker: closed")

// ErrUnsupportedCapability reports a configured operation that this broker cannot
// safely perform with the embedded ToolHive runtime.
var ErrUnsupportedCapability = errors.New("vmcpbroker: unsupported capability")

// ErrInvalidRoute reports invalid static broker catalogue input.
var ErrInvalidRoute = errors.New("vmcpbroker: invalid route")

// BindingIndex records which persisted parent sessions require broker
// reattachment. It is root-internal state keyed by the canonical session ID and
// immutable broker configuration generation; it is deliberately not session data.
type BindingIndex struct {
	mu      sync.RWMutex
	entries map[session.SessionID]string
}

// NewBindingIndex constructs an empty root-owned binding index.
func NewBindingIndex() *BindingIndex {
	return &BindingIndex{entries: make(map[session.SessionID]string)}
}

// Bind records the broker configuration generation for id.
func (i *BindingIndex) Bind(id session.SessionID, generation string) error {
	if i == nil || id == "" || generation == "" {
		return fmt.Errorf("%w: broker binding id and generation are required", ErrInvalidRoute)
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	if prior, ok := i.entries[id]; ok && prior != generation {
		return fmt.Errorf("%w: broker binding generation conflicts for session %q", ErrInvalidRoute, id)
	}
	i.entries[id] = generation
	return nil
}

// Generation returns the configured broker generation for id.
func (i *BindingIndex) Generation(id session.SessionID) (string, bool) {
	if i == nil {
		return "", false
	}
	i.mu.RLock()
	defer i.mu.RUnlock()
	generation, ok := i.entries[id]
	return generation, ok
}

// Unbind removes the record created for a final session close or failed create.
func (i *BindingIndex) Unbind(id session.SessionID) {
	if i == nil {
		return
	}
	i.mu.Lock()
	delete(i.entries, id)
	i.mu.Unlock()
}

// ErrInvalidControlTarget reports an unknown, closed, tombstoned, or unconfigured
// composition-private control target. It deliberately does not identify which part
// of the target was invalid.
var ErrInvalidControlTarget = errors.New("vmcpbroker: invalid control target")

var errDownstreamRefreshRejected = errors.New("vmcpbroker: downstream refresh rejected")

const profileAuthOAuth = "oauth"

// Route joins a neutral, model-facing tool specification to its private broker
// backend route. BackendID is consumed only by the injected broker caller; it
// is never copied into ToolSpec, a ToolCall, or a ToolResult.
type Route struct {
	// BackendID is composition-private and is never projected outside this adapter.
	BackendID string
	// AuthorizationLabel is the configured, client-safe label for authorization
	// status. It must not be inferred from BackendID.
	AuthorizationLabel string
	Tool               tool.ToolSpec
	ReadOnly           bool
	// Protected routes require a prior composition-private connection. A protected
	// wrapper stays visible before authorization so the model-facing catalog is stable.
	Protected bool
}

// ToolDefinition is the neutral result of ToolHive's static tool discovery.
// ToolHive-specific values must be reduced to this form before they reach the
// Runtime catalogue.
type ToolDefinition struct {
	BackendID   string
	Name        string
	Description string
	Schema      json.RawMessage
	ReadOnly    bool
}

// CompileProfiles builds a deterministic immutable broker catalogue from the
// configured operator profiles and ToolHive's discovered tool definitions.
// It rejects a discovery result for a backend that the operator did not
// configure, preventing a backend route from being invented at execution time.
func CompileProfiles(profiles []permconfig.MCPServerProfile, discovered []ToolDefinition) ([]Route, error) {
	configured := make(map[string]string, len(profiles))
	protectedProfiles := 0
	for _, profile := range profiles {
		name := strings.ToLower(profile.Name)
		if name == "" {
			return nil, fmt.Errorf("%w: profile name is required", ErrInvalidRoute)
		}
		if _, ok := configured[name]; ok {
			return nil, fmt.Errorf("%w: duplicate profile %q", ErrInvalidRoute, profile.Name)
		}
		switch profile.Auth.Mode {
		case "none":
			configured[name] = profile.Name
		case profileAuthOAuth:
			configured[name] = profile.Name
			protectedProfiles++
			if protectedProfiles > 1 {
				return nil, fmt.Errorf("%w: only one protected backend is supported", ErrInvalidRoute)
			}
		default:
			return nil, fmt.Errorf("%w: unsupported auth mode %q for backend %q", ErrInvalidRoute, profile.Auth.Mode, profile.Name)
		}
	}
	routes := make([]Route, 0, len(discovered))
	seen := make(map[string]struct{}, len(discovered))
	for _, definition := range discovered {
		label, ok := configured[strings.ToLower(definition.BackendID)]
		if !ok {
			return nil, fmt.Errorf("%w: unconfigured backend %q", ErrInvalidRoute, definition.BackendID)
		}
		protected := false
		for _, profile := range profiles {
			if strings.EqualFold(profile.Name, definition.BackendID) {
				protected = profile.Auth.Mode == profileAuthOAuth
				break
			}
		}
		if definition.Name == "" {
			return nil, fmt.Errorf("%w: tool name is required", ErrInvalidRoute)
		}
		if _, ok := seen[definition.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, definition.Name)
		}
		seen[definition.Name] = struct{}{}
		routes = append(routes, Route{
			BackendID:          definition.BackendID,
			AuthorizationLabel: label,
			Tool: tool.ToolSpec{
				Name:        definition.Name,
				Description: definition.Description,
				Schema:      append(json.RawMessage(nil), definition.Schema...),
			},
			ReadOnly:  definition.ReadOnly,
			Protected: protected,
		})
	}
	sort.Slice(routes, func(i, j int) bool { return routes[i].Tool.Name < routes[j].Tool.Name })
	return routes, nil
}

// Caller is the broker-private execution seam. A production caller uses the
// embedded ToolHive streaming-HTTP client; it receives the route separately
// from the model-controlled arguments.
type Caller func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error)

// HandlerBundle contains root-internal HTTP handlers owned by a broker process.
// It is intentionally not mounted here; command roots choose their own listeners.
type HandlerBundle struct {
	Authorization     http.Handler
	Token             http.Handler
	UpstreamCallback  http.Handler
	Discovery         http.Handler
	JWKS              http.Handler
	ProtectedResource http.Handler
	VMCP              http.Handler
	Callback          http.Handler
}

// ValidateCallbackPath rejects callback registrations that can shadow a command
// root's fallback or reserved routes. A reserved path ending in / reserves its
// whole subtree.
func ValidateCallbackPath(callbackPath string, reservedPaths ...string) error {
	if callbackPath == "/" || strings.HasSuffix(callbackPath, "/") {
		return fmt.Errorf("vmcpbroker: callback path %q must be an exact non-root path", callbackPath)
	}
	for _, reserved := range reservedPaths {
		if callbackPath == reserved || strings.HasSuffix(reserved, "/") && strings.HasPrefix(callbackPath, reserved) {
			return fmt.Errorf("vmcpbroker: callback path %q conflicts with reserved route %q", callbackPath, reserved)
		}
	}
	return nil
}

// Mount registers the broker's complete fixed route table and the configured
// callback path. The callback path is supplied by the composition root from
// the canonical public callback URL; it must not overlap a broker route.
// Collisions are returned as errors rather than exposing ServeMux's panic.
func (b HandlerBundle) Mount(mux *http.ServeMux, callbackPath string) (err error) {
	if mux == nil {
		return errors.New("vmcpbroker: handler mux is required")
	}
	routes := make([]struct {
		path    string
		handler http.Handler
	}, 0, 8)
	for _, route := range []struct {
		path    string
		handler http.Handler
	}{
		{brokerAuthorizePath, b.Authorization},
		{brokerTokenPath, b.Token},
		{brokerUpstreamCallbackPath, b.UpstreamCallback},
		{brokerDiscoveryPath, b.Discovery},
		{brokerJWKSPath, b.JWKS},
		{brokerProtectedResourcePath, b.ProtectedResource},
		{brokerMCPPath, b.VMCP},
	} {
		if route.handler != nil {
			routes = append(routes, route)
		}
	}
	if callbackPath != "" || b.Callback != nil {
		if callbackPath == "" || b.Callback == nil {
			return errors.New("vmcpbroker: incomplete callback handler")
		}
		routes = append(routes, struct {
			path    string
			handler http.Handler
		}{callbackPath, b.Callback})
	}
	if len(routes) == 0 {
		return errors.New("vmcpbroker: incomplete handler bundle")
	}
	seen := make(map[string]struct{}, len(routes))
	for _, route := range routes {
		if route.path == "" || route.handler == nil {
			return errors.New("vmcpbroker: incomplete handler bundle")
		}
		if _, ok := seen[route.path]; ok {
			return fmt.Errorf("vmcpbroker: callback route conflicts with broker route %q", route.path)
		}
		seen[route.path] = struct{}{}
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("vmcpbroker: handler route conflict: %v", recovered)
		}
	}()
	for _, route := range routes {
		mux.Handle(route.path, route.handler)
	}
	return nil
}

// Process owns a broker Runtime and its root-internal handlers.
type Process struct {
	Runtime  *Runtime
	Handlers HandlerBundle
}

// NewProcess binds the fixed callback handler to an already-built Runtime.
func NewProcess(runtime *Runtime) (*Process, error) {
	if runtime == nil {
		return nil, errors.New("vmcpbroker: runtime is required")
	}
	return &Process{
		Runtime:  runtime,
		Handlers: HandlerBundle{Callback: CallbackHandler(runtime.Callback)},
	}, nil
}

const (
	brokerBasePath              = "/v1/mcp/broker"
	brokerAuthorizePath         = brokerBasePath + "/oauth/authorize"
	brokerTokenPath             = brokerBasePath + "/oauth/token"
	brokerUpstreamCallbackPath  = brokerBasePath + "/oauth/callback"
	brokerDiscoveryPath         = brokerBasePath + "/.well-known/openid-configuration"
	brokerJWKSPath              = brokerBasePath + "/.well-known/jwks.json"
	brokerProtectedResourcePath = brokerBasePath + "/.well-known/oauth-protected-resource"
	brokerMCPPath               = brokerBasePath + "/mcp"
)

// ProcessOption configures root-internal process construction.
type ProcessOption func(*processOptions)

type processOptions struct {
	httpClient                  *http.Client
	insecureAllowHTTPForTesting bool
}

// WithHTTPClient supplies the client for the broker's own downstream token exchange.
// It is useful when a local TLS listener uses a private test CA.
func WithHTTPClient(client *http.Client) ProcessOption {
	return func(options *processOptions) { options.httpClient = client }
}

// NewToolHiveProcess builds the process-owned embedded authorization server and
// Streamable HTTP vMCP handler. The callback origin is the sole public authority.
func NewToolHiveProcess(ctx context.Context, profiles []permconfig.MCPServerProfile, callbackURL string, diag port.Diagnostics, options ...ProcessOption) (*Process, error) {
	config := processOptions{}
	for _, option := range options {
		if option != nil {
			option(&config)
		}
	}
	if !hasProtectedProfile(profiles) {
		return newAnonymousToolHiveProcess(ctx, profiles, diag)
	}
	callback, err := canonicalCallbackURL(callbackURL)
	if err != nil {
		return nil, err
	}
	protected, err := protectedProfile(profiles)
	if err != nil {
		return nil, err
	}
	issuer := callback.Scheme + "://" + callback.Host + brokerBasePath
	upstreamConfig := newUpstreamRunConfig(protected, issuer, config)
	store := storage.NewMemoryStorage()
	auth, err := runner.NewEmbeddedAuthServerWithStorage(ctx, &authserver.RunConfig{SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer}, Upstreams: []authserver.UpstreamRunConfig{upstreamConfig}}, store)
	if err != nil {
		return nil, fmt.Errorf("vmcpbroker: create embedded auth server: %w", err)
	}
	fail := func(err error) (*Process, error) { _ = auth.Close(); return nil, err }
	reader := upstreamtoken.NewInProcessService(auth.IDPTokenStorage(), auth.UpstreamTokenRefresher())
	incoming, _, authInfo, err := factory.NewIncomingAuthMiddleware(ctx, &vmcpconfig.IncomingAuthConfig{Type: "oidc", OIDC: &vmcpconfig.OIDCConfig{Issuer: issuer, Audience: issuer, Resource: issuer, JWKSURL: issuer + "/.well-known/jwks.json"}}, "mecatl-broker", nil, reader, auth.KeyProvider())
	if err != nil {
		return fail(err)
	}
	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("upstream_inject", strategies.NewUpstreamInjectStrategy()); err != nil {
		return fail(err)
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		return fail(err)
	}
	resolver, err := aggregator.NewConflictResolver(&vmcpconfig.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		return fail(err)
	}
	backends := make([]vmcp.Backend, 0, len(profiles))
	for _, p := range profiles {
		b := vmcp.Backend{ID: p.Name, Name: p.Name, BaseURL: p.URL, TransportType: "streamable-http"}
		if p.Auth.Mode == profileAuthOAuth {
			b.AuthConfig = &authtypes.BackendAuthStrategy{Type: "upstream_inject", UpstreamInject: &authtypes.UpstreamInjectConfig{ProviderName: protected.Name}}
		}
		backends = append(backends, b)
	}
	server, err := vmcpserver.New(ctx, &vmcpserver.Config{Name: "mecatl-broker", Version: "v1", EndpointPath: brokerMCPPath, AuthMiddleware: incoming, AuthInfoHandler: authInfo, AuthServer: auth, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil), SessionFactory: vmcpsession.NewSessionFactory(outgoing)}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, vmcp.NewImmutableRegistry(backends), nil)
	if err != nil {
		return fail(err)
	}
	vmcpHandler, err := server.Handler(ctx)
	if err != nil {
		_ = server.Stop(context.Background())
		return fail(err)
	}
	routes, err := discoverRoutes(ctx, profiles, diag)
	if err != nil {
		_ = server.Stop(context.Background())
		return fail(err)
	}
	runtime, err := NewToolHiveStreamingHTTPRuntime(routes, issuer+"/mcp", ToolHiveRuntimeConfig{AuthServer: auth, Storage: store, Issuer: issuer, Resource: issuer, AuthorizationEndpoint: issuer + "/oauth/authorize", TokenEndpoint: issuer + "/oauth/token", CallbackURL: callback.String(), HTTPClient: config.httpClient, Diagnostics: diag}, 5*time.Minute)
	if err != nil {
		_ = server.Stop(context.Background())
		return fail(err)
	}
	runtime.sharedClosers = append(runtime.sharedClosers, namedCloser{name: "vmcp", close: func() error { return server.Stop(context.Background()) }}, namedCloser{name: "authserver", close: auth.Close})
	embedded := http.StripPrefix(brokerBasePath, auth.Handler())
	return &Process{Runtime: runtime, Handlers: HandlerBundle{Authorization: embedded, Token: embedded, UpstreamCallback: embedded, Discovery: embedded, JWKS: embedded, ProtectedResource: authInfo, VMCP: vmcpHandler, Callback: CallbackHandler(runtime.Callback)}}, nil
}

func hasProtectedProfile(profiles []permconfig.MCPServerProfile) bool {
	for _, profile := range profiles {
		if profile.Auth.Mode == profileAuthOAuth {
			return true
		}
	}
	return false
}

func newAnonymousToolHiveProcess(ctx context.Context, profiles []permconfig.MCPServerProfile, diag port.Diagnostics) (*Process, error) {
	routes, err := discoverRoutes(ctx, profiles, diag)
	if err != nil {
		return nil, err
	}
	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy(authtypes.StrategyTypeUnauthenticated, strategies.NewUnauthenticatedStrategy()); err != nil {
		return nil, err
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		return nil, err
	}
	resolver, err := aggregator.NewConflictResolver(&vmcpconfig.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		return nil, err
	}
	backends := make([]vmcp.Backend, 0, len(profiles))
	for _, profile := range profiles {
		backends = append(backends, vmcp.Backend{ID: profile.Name, Name: profile.Name, BaseURL: profile.URL, TransportType: "streamable-http"})
	}
	server, err := vmcpserver.New(ctx, &vmcpserver.Config{Name: "mecatl-broker", Version: "v1", EndpointPath: brokerMCPPath, Aggregator: aggregator.NewDefaultAggregator(backendClient, resolver, nil, nil), SessionFactory: vmcpsession.NewSessionFactory(outgoing)}, router.NewSessionRouter(&vmcp.RoutingTable{}), backendClient, vmcp.NewImmutableRegistry(backends), nil)
	if err != nil {
		return nil, err
	}
	vmcpHandler, err := server.Handler(ctx)
	if err != nil {
		_ = server.Stop(context.Background())
		return nil, err
	}
	runtime, err := newAnonymousRuntime(routes, profiles)
	if err != nil {
		_ = server.Stop(context.Background())
		return nil, err
	}
	runtime.sharedClosers = append(runtime.sharedClosers, namedCloser{name: "vmcp", close: func() error { return server.Stop(context.Background()) }})
	return &Process{Runtime: runtime, Handlers: HandlerBundle{VMCP: vmcpHandler}}, nil
}

func newAnonymousRuntime(routes []Route, profiles []permconfig.MCPServerProfile) (*Runtime, error) {
	servers := make(map[string]mcp.ServerConfig, len(profiles))
	for _, profile := range profiles {
		servers[profile.Name] = mcp.ServerConfig{Name: profile.Name, URL: profile.URL}
	}
	return NewRuntime(routes, func(ctx context.Context, _ session.SessionID, route Route, args json.RawMessage) (session.ToolResult, error) {
		config, ok := servers[route.BackendID]
		if !ok {
			return session.ToolResult{}, ErrInvalidControlTarget
		}
		upstream, err := mcp.Connect(ctx, config, nil)
		if err != nil {
			return session.ToolResult{}, fmt.Errorf("vmcpbroker: connect anonymous upstream: %w", err)
		}
		defer func() { _ = upstream.Close() }()
		for _, wrapped := range upstream.Tools() {
			if wrapped.Spec().Name == route.Tool.Name {
				return wrapped.Execute(ctx, session.NewToolCall("", route.Tool.Name, args), tool.Environment{})
			}
		}
		return session.ToolResult{}, fmt.Errorf("vmcpbroker: anonymous upstream did not expose configured tool %q", route.Tool.Name)
	})
}

func newUpstreamRunConfig(protected permconfig.MCPServerProfile, issuer string, options processOptions) authserver.UpstreamRunConfig {
	oauth := protected.Auth.OAuth
	if oauth.Upstream != nil && oauth.Upstream.Mode == "oauth2" {
		return authserver.UpstreamRunConfig{Name: protected.Name, Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: oauth.Upstream.OAuth2.AuthorizationEndpoint,
			TokenEndpoint:         oauth.Upstream.OAuth2.TokenEndpoint,
			ClientID:              brokerClientID(protected),
			ClientSecretEnvVar:    brokerSecretEnv(protected),
			RedirectURI:           issuer + "/oauth/callback",
			Scopes:                append([]string(nil), oauth.Scopes...),
			InsecureAllowHTTP:     options.insecureAllowHTTPForTesting,
		}}
	}
	return authserver.UpstreamRunConfig{Name: protected.Name, Type: authserver.UpstreamProviderTypeOIDC, OIDCConfig: newOIDCUpstreamConfig(protected, issuer, options)}
}

func newOIDCUpstreamConfig(protected permconfig.MCPServerProfile, issuer string, options processOptions) *authserver.OIDCUpstreamRunConfig {
	return &authserver.OIDCUpstreamRunConfig{
		IssuerURL:          protected.Auth.OAuth.Issuer,
		ClientID:           brokerClientID(protected),
		ClientSecretEnvVar: brokerSecretEnv(protected),
		RedirectURI:        issuer + "/oauth/callback",
		Scopes:             append([]string(nil), protected.Auth.OAuth.Scopes...),
		InsecureAllowHTTP:  options.insecureAllowHTTPForTesting,
	}
}

func canonicalCallbackURL(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path == "" || u.String() != raw {
		return nil, fmt.Errorf("%w: callback URL must be canonical HTTPS with an exact path", ErrInvalidRoute)
	}
	return u, nil
}

func protectedProfile(profiles []permconfig.MCPServerProfile) (permconfig.MCPServerProfile, error) {
	var result *permconfig.MCPServerProfile
	for i := range profiles {
		if profiles[i].Auth.Mode == profileAuthOAuth {
			if result != nil {
				return permconfig.MCPServerProfile{}, fmt.Errorf("%w: only one protected backend is supported", ErrInvalidRoute)
			}
			result = &profiles[i]
		}
	}
	if result == nil || result.Auth.OAuth == nil {
		return permconfig.MCPServerProfile{}, fmt.Errorf("%w: one protected backend is required", ErrInvalidRoute)
	}
	return *result, nil
}
func brokerClientID(p permconfig.MCPServerProfile) string {
	if c := p.Auth.OAuth.Client.Preregistered; c != nil {
		return c.ID
	}
	if c := p.Auth.OAuth.Client.CIMD; c != nil {
		return c.DocumentURL
	}
	return ""
}
func brokerSecretEnv(p permconfig.MCPServerProfile) string {
	if c := p.Auth.OAuth.Client.Preregistered; c != nil {
		return c.SecretEnv
	}
	return ""
}
// discoverRoutes builds the model-facing route catalog. A profile that
// declares Auth.OAuth.Tools statically (permconfig.MCPOAuthProfile.Tools)
// skips live discovery entirely — some protected backends (e.g. GitHub's
// remote MCP server) reject an unauthenticated `initialize` outright, so no
// live connection can ever succeed before a user grant exists. Every other
// profile is discovered live exactly as before.
func discoverRoutes(ctx context.Context, profiles []permconfig.MCPServerProfile, diag port.Diagnostics) ([]Route, error) {
	live := make([]permconfig.MCPServerProfile, 0, len(profiles))
	defs := make([]ToolDefinition, 0)
	for _, p := range profiles {
		if p.Auth.Mode == profileAuthOAuth && p.Auth.OAuth != nil && len(p.Auth.OAuth.Tools) > 0 {
			for _, t := range p.Auth.OAuth.Tools {
				defs = append(defs, ToolDefinition{
					BackendID:   p.Name,
					Name:        "mcp__" + p.Name + "__" + t.Name,
					Description: t.Description,
					Schema:      append(json.RawMessage(nil), t.InputSchema...),
				})
			}
			continue
		}
		live = append(live, p)
	}
	if len(live) > 0 {
		configs := make([]mcp.ServerConfig, 0, len(live))
		for _, p := range live {
			configs = append(configs, mcp.ServerConfig{Name: p.Name, URL: p.URL})
		}
		manager, err := mcp.NewManager(ctx, configs, nil, diag)
		if err != nil {
			return nil, fmt.Errorf("vmcpbroker: discover configured tools: %w", err)
		}
		defer func() { _ = manager.Close() }()
		for _, wrapped := range manager.Tools() {
			spec := wrapped.Spec()
			for _, p := range live {
				if strings.HasPrefix(spec.Name, "mcp__"+p.Name+"__") {
					defs = append(defs, ToolDefinition{BackendID: p.Name, Name: spec.Name, Description: spec.Description, Schema: spec.Schema, ReadOnly: wrapped.ReadOnly()})
					break
				}
			}
		}
	}
	return CompileProfiles(profiles, defs)
}

// Close releases the Runtime and its owned resources.
func (p *Process) Close() error {
	if p == nil || p.Runtime == nil {
		return nil
	}
	return p.Runtime.Close()
}

// Runtime owns the stable catalogue and opens session-local executable wrappers.
type Runtime struct {
	mu                sync.RWMutex
	routes            []Route
	caller            Caller
	opener            sessionOpener
	sessions          map[session.SessionID]*SessionTools
	lifecycles        map[session.SessionID]*sessionLifecycle
	tombstones        map[session.SessionID]struct{}
	authorizeEndpoint string
	callbackURL       string
	transactionTTL    time.Duration
	transactions      map[controlTarget]authorizationTransaction
	authorizations    map[controlTarget]string
	grants            map[controlTarget]downstreamGrant
	disconnected      map[controlTarget]struct{}
	refreshes         map[controlTarget]*refreshOperation
	oauthBackend      string
	clientID          string
	httpClient        *http.Client
	tokenEndpoint     string
	resource          string
	diagnostics       port.Diagnostics
	now               func() time.Time
	lifecycleCtx      context.Context
	cancelLifecycle   context.CancelFunc
	sharedClosers     []namedCloser
	closeOnce         sync.Once
	closeErr          error
	closed            bool
}

// ToolHiveRuntimeConfig binds the broker to its already-composed embedded
// ToolHive authorization server. It is root-internal; the Runtime never treats
// an issuer string alone as evidence of a usable ToolHive server.
type ToolHiveRuntimeConfig struct {
	AuthServer *runner.EmbeddedAuthServer
	Storage    storage.ClientRegistry
	Issuer     string
	// Resource is the explicit trusted OAuth resource value sent to the embedded
	// authorization server. It is configuration, never inferred from an endpoint.
	Resource              string
	AuthorizationEndpoint string
	TokenEndpoint         string
	CallbackURL           string
	// HTTPClient is used only for the embedded ToolHive downstream token exchange.
	// It must be configured by composition when the embedded server uses a private CA.
	HTTPClient  *http.Client
	Diagnostics port.Diagnostics
}

// ConnectionStatus describes the authorization state of a broker connection.
type ConnectionStatus string

// Broker connection states.
const (
	ConnectionPending   ConnectionStatus = "pending"
	ConnectionConnected ConnectionStatus = "connected"
)

type controlTarget struct {
	sessionID session.SessionID
	backendID string
}

type authorizationTransaction struct {
	handle     string
	verifier   string
	browserURL string
	expiresAt  time.Time
	// cancel stops the exact callback token exchange. Cancellation owns this
	// transaction, not the whole session lifecycle, so a loser cannot install a
	// grant after cancel, expiry, or close won.
	cancel     context.CancelFunc
	exchanging bool
}

type downstreamGrant struct {
	// token retains OAuth expiry, type, and refresh semantics. The two legacy
	// fields mirror it for the isolated custody tests while callers use token.
	token        *oauth2.Token
	accessToken  string
	refreshToken string
}

type refreshOperation struct {
	done   chan struct{}
	cancel context.CancelFunc
	err    error
}

type sessionLifecycle struct {
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type namedCloser struct {
	name  string
	close func() error
}

type clientRegistryRemover interface {
	RemoveClient(context.Context, string) error
}

// AuthorizationRequired is the safe, browser-facing rendezvous for a pending
// ToolHive authorization. Its handle is opaque and is meaningful only to this
// Runtime; it contains no upstream OAuth material.
type AuthorizationRequired struct {
	Handle     string
	BrowserURL string
	ExpiresAt  time.Time
}

// ConnectResult describes a broker connection without exposing OAuth material.
type ConnectResult struct {
	Status                ConnectionStatus
	AuthorizationRequired *AuthorizationRequired
}

type sessionOpener func(context.Context, session.SessionID) (Caller, func() error, error)

// NewRuntime constructs a Runtime with an immutable copy of routes.
func NewRuntime(routes []Route, caller Caller) (*Runtime, error) {
	if caller == nil {
		return nil, fmt.Errorf("%w: caller is required", ErrInvalidRoute)
	}
	copied := make([]Route, len(routes))
	seen := make(map[string]struct{}, len(routes))
	var oauthBackend string
	for i, route := range routes {
		if route.BackendID == "" || route.Tool.Name == "" {
			return nil, fmt.Errorf("%w: backend id and tool name are required", ErrInvalidRoute)
		}
		if _, ok := seen[route.Tool.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, route.Tool.Name)
		}
		if route.Protected && oauthBackend == "" {
			oauthBackend = route.BackendID
		}
		seen[route.Tool.Name] = struct{}{}
		copied[i] = copyRoute(route)
	}
	sort.Slice(copied, func(i, j int) bool { return copied[i].Tool.Name < copied[j].Tool.Name })
	lifecycleCtx, cancelLifecycle := context.WithCancel(context.Background())
	return &Runtime{
		routes:          copied,
		caller:          caller,
		sessions:        make(map[session.SessionID]*SessionTools),
		lifecycles:      make(map[session.SessionID]*sessionLifecycle),
		tombstones:      make(map[session.SessionID]struct{}),
		transactions:    make(map[controlTarget]authorizationTransaction),
		authorizations:  make(map[controlTarget]string),
		grants:          make(map[controlTarget]downstreamGrant),
		disconnected:    make(map[controlTarget]struct{}),
		refreshes:       make(map[controlTarget]*refreshOperation),
		oauthBackend:    oauthBackend,
		diagnostics:     port.NopDiagnostics{},
		now:             time.Now,
		lifecycleCtx:    lifecycleCtx,
		cancelLifecycle: cancelLifecycle,
	}, nil
}

// SetClock installs the process clock used for broker-transaction expiry. It is
// called once by the owning Service so durable and runtime expiry share one
// authority; a nil clock restores the production clock.
func (r *Runtime) SetClock(now func() time.Time) {
	if now == nil {
		now = time.Now
	}
	r.mu.Lock()
	r.now = now
	r.mu.Unlock()
}

// NewToolHiveRuntime enables composition-private connection rendezvous for one
// ToolHive embedded authorization server. The server owns all upstream OAuth
// protocol state; this Runtime retains only a random downstream handle bound to
// an opened canonical session and protected backend.
func NewToolHiveRuntime(routes []Route, caller Caller, config ToolHiveRuntimeConfig, transactionTTL time.Duration) (*Runtime, error) {
	endpoint, tokenEndpoint, resource, err := validatedToolHiveRuntimeConfig(config)
	if err != nil {
		return nil, err
	}
	callback, err := url.Parse(config.CallbackURL)
	if err != nil || callback.Scheme != "https" || callback.Host == "" {
		return nil, fmt.Errorf("%w: callback URL must be HTTPS", ErrInvalidRoute)
	}
	protected := make(map[string]struct{})
	for _, route := range routes {
		if route.Protected {
			protected[route.BackendID] = struct{}{}
		}
	}
	if len(protected) == 0 {
		return nil, fmt.Errorf("%w: one protected backend is required", ErrInvalidRoute)
	}
	runtime, err := NewRuntime(routes, caller)
	if err != nil {
		return nil, err
	}
	clientID, err := newOpaqueHandle()
	if err != nil {
		return nil, fmt.Errorf("vmcpbroker: create ToolHive client: %w", err)
	}
	if err := config.Storage.RegisterClient(context.Background(), &fosite.DefaultClient{
		ID:            clientID,
		RedirectURIs:  []string{config.CallbackURL},
		GrantTypes:    []string{"authorization_code", "refresh_token"},
		ResponseTypes: []string{"code"},
		Scopes:        []string{"openid", "offline_access"},
		Audience:      []string{config.Issuer},
		Public:        true,
	}); err != nil {
		return nil, fmt.Errorf("vmcpbroker: register ToolHive client: %w", err)
	}
	runtime.authorizeEndpoint = endpoint
	runtime.tokenEndpoint = tokenEndpoint
	runtime.resource = resource
	runtime.callbackURL = config.CallbackURL
	runtime.transactionTTL = transactionTTL
	runtime.clientID = clientID
	runtime.httpClient = config.HTTPClient
	if runtime.httpClient == nil {
		runtime.httpClient = http.DefaultClient
	}
	if config.Diagnostics != nil {
		runtime.diagnostics = config.Diagnostics
	}
	runtime.sharedClosers = toolHiveClosers(config.Storage, clientID)
	return runtime, nil
}

func toolHiveClosers(registry storage.ClientRegistry, clientID string) []namedCloser {
	closers := make([]namedCloser, 0, 1)
	// ToolHive v0.45.0's ClientRegistry intentionally has no removal method.
	// Keep this optional assertion so a future registry implementation can clean up
	// this runtime's generated public client without widening the ToolHive API here.
	if remover, ok := registry.(clientRegistryRemover); ok {
		closers = append(closers, namedCloser{name: "client", close: func() error {
			return remover.RemoveClient(context.Background(), clientID)
		}})
	}
	return closers
}
func validatedToolHiveRuntimeConfig(config ToolHiveRuntimeConfig) (authorize, token, resource string, err error) {
	if config.AuthServer == nil || config.Storage == nil || config.CallbackURL == "" || config.Issuer == "" || config.Resource == "" || config.AuthorizationEndpoint == "" || config.TokenEndpoint == "" {
		return "", "", "", fmt.Errorf("%w: embedded ToolHive authorization server, storage, trusted OAuth issuer/resource/endpoints, and callback URL are required", ErrInvalidRoute)
	}
	authorize, err = trustedToolHiveOAuthEndpoint(config.AuthorizationEndpoint)
	if err != nil {
		return "", "", "", err
	}
	token, err = trustedToolHiveOAuthEndpoint(config.TokenEndpoint)
	if err != nil {
		return "", "", "", err
	}
	resource, err = trustedToolHiveOAuthEndpoint(config.Resource)
	if err != nil {
		return "", "", "", fmt.Errorf("%w: trusted ToolHive OAuth resource: %w", ErrInvalidRoute, err)
	}
	return authorize, token, resource, nil
}

func trustedToolHiveOAuthEndpoint(endpoint string) (string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("%w: trusted ToolHive OAuth endpoint must be an HTTPS URL", ErrInvalidRoute)
	}
	return parsed.String(), nil
}

// NewStreamingHTTPRuntime opens each session's wrappers against endpoint, the
// embedded broker's standard Streamable HTTP /mcp endpoint. The MCP transport is
// lazy: a protected connection is not initialized until the private downstream
// bearer exists, so OpenSession can expose the stable catalogue before OAuth.
func NewStreamingHTTPRuntime(routes []Route, endpoint string) (*Runtime, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("%w: broker endpoint is required", ErrInvalidRoute)
	}
	runtime, err := NewRuntime(routes, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, errors.New("vmcpbroker: streaming caller was not initialized")
	})
	if err != nil {
		return nil, err
	}
	runtime.opener = streamingSessionOpener(runtime, endpoint)
	return runtime, nil
}

// NewToolHiveStreamingHTTPRuntime combines the embedded ToolHive authorization
// server with its session-local /mcp transport. The downstream bearer is read
// only by the transport at call time; it never becomes a tool argument or result.
func NewToolHiveStreamingHTTPRuntime(routes []Route, endpoint string, config ToolHiveRuntimeConfig, transactionTTL time.Duration) (*Runtime, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("%w: broker endpoint is required", ErrInvalidRoute)
	}
	runtime, err := NewToolHiveRuntime(routes, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, errors.New("vmcpbroker: streaming caller was not initialized")
	}, config, transactionTTL)
	if err != nil {
		return nil, err
	}
	runtime.opener = streamingSessionOpener(runtime, endpoint)
	return runtime, nil
}

func streamingSessionOpener(runtime *Runtime, endpoint string) sessionOpener {
	return func(_ context.Context, id session.SessionID) (Caller, func() error, error) {
		caller := &streamingCaller{runtime: runtime, sessionID: id, endpoint: endpoint}
		return caller.call, caller.close, nil
	}
}

type streamingCaller struct {
	mu        sync.Mutex
	runtime   *Runtime
	sessionID session.SessionID
	endpoint  string
	anonymous *mcp.Server
	protected *mcp.Server
}

func (c *streamingCaller) call(ctx context.Context, _ session.SessionID, route Route, args json.RawMessage) (session.ToolResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	server := c.anonymous
	if route.Protected {
		grant, ok := c.runtime.grant(c.sessionID, route.BackendID)
		if !ok {
			return session.NewToolError("", "authorization required for this broker tool"), nil
		}
		server = c.protected
		if server == nil {
			var err error
			server, err = c.connectProtected(ctx, route.BackendID, grant)
			if err != nil {
				return session.ToolResult{}, err
			}
			c.protected = server
		}
	} else if server == nil {
		var err error
		server, err = mcp.Connect(ctx, mcp.ServerConfig{Name: "broker", URL: c.endpoint}, nil)
		if err != nil {
			return session.ToolResult{}, fmt.Errorf("vmcpbroker: connect broker endpoint: %w", err)
		}
		c.anonymous = server
	}
	wrapped, ok := brokerTools(server)[route.Tool.Name]
	if !ok {
		name := strings.TrimPrefix(route.Tool.Name, "mcp__"+route.BackendID+"__")
		wrapped, ok = brokerTools(server)[route.BackendID+"_"+name]
	}
	if !ok {
		return session.ToolResult{}, fmt.Errorf("vmcpbroker: broker did not expose configured tool %q", route.Tool.Name)
	}
	result, err := wrapped.Execute(ctx, session.NewToolCall("", wrapped.Spec().Name, args), tool.Environment{})
	// A completed MCP call is never retried here: neither model-visible result
	// text nor an ambiguous transport error establishes that no side effect ran.
	return result, err
}

func (c *streamingCaller) connectProtected(ctx context.Context, backendID string, grant downstreamGrant) (*mcp.Server, error) {
	server, err := c.connectWithTokenSource(ctx, backendID)
	if err == nil {
		return server, nil
	}
	refreshed, refreshErr := c.runtime.refreshDownstreamGrant(ctx, controlTarget{sessionID: c.sessionID, backendID: backendID}, grant)
	if refreshErr != nil {
		return nil, fmt.Errorf("vmcpbroker: protected broker transport unavailable: %w", refreshErr)
	}
	if refreshed.bearer() == "" {
		return nil, errors.New("vmcpbroker: protected broker transport refresh returned an empty token")
	}
	server, err = c.connectWithTokenSource(ctx, backendID)
	if err != nil {
		return nil, fmt.Errorf("vmcpbroker: protected broker transport unavailable: %w", err)
	}
	return server, nil
}

func (c *streamingCaller) connectWithTokenSource(ctx context.Context, backendID string) (*mcp.Server, error) {
	return mcp.Connect(ctx, mcp.ServerConfig{
		Name: "broker", URL: c.endpoint, HTTPClient: c.runtime.httpClient,
		TokenSource: scopedGrantTokenSource{runtime: c.runtime, target: controlTarget{sessionID: c.sessionID, backendID: backendID}},
	}, nil)
}

func (c *streamingCaller) close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	var first error
	for _, server := range []*mcp.Server{c.anonymous, c.protected} {
		if server != nil {
			if err := server.Close(); err != nil && first == nil {
				first = err
			}
		}
	}
	return first
}

func brokerTools(server *mcp.Server) map[string]tool.Tool {
	tools := make(map[string]tool.Tool, len(server.Tools()))
	const brokerPrefix = "mcp__broker__"
	for _, wrapped := range server.Tools() {
		name := wrapped.Spec().Name
		if strings.HasPrefix(name, brokerPrefix) {
			tools[strings.TrimPrefix(name, brokerPrefix)] = wrapped
		}
	}
	return tools
}

// EnrollmentID returns an opaque non-secret fingerprint of the trusted broker
// authority configuration and complete compiled route inventory. It is durable
// session provenance only; none of the values it covers are exposed.
func (r *Runtime) EnrollmentID() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	type routeIdentity struct {
		Name        string          `json:"name"`
		Description string          `json:"description"`
		Schema      json.RawMessage `json:"schema"`
		BackendID   string          `json:"backend_id"`
		Protected   bool            `json:"protected"`
		ReadOnly    bool            `json:"read_only"`
	}
	routes := make([]routeIdentity, len(r.routes))
	for i, route := range r.routes {
		schema := append(json.RawMessage(nil), route.Tool.Schema...)
		var decoded any
		if json.Unmarshal(schema, &decoded) == nil {
			schema, _ = json.Marshal(decoded)
		}
		routes[i] = routeIdentity{
			Name: route.Tool.Name, Description: route.Tool.Description, Schema: schema,
			BackendID: route.BackendID, Protected: route.Protected, ReadOnly: route.ReadOnly,
		}
	}
	payload, _ := json.Marshal(struct {
		Routes            []routeIdentity `json:"routes"`
		AuthorizeEndpoint string          `json:"authorize_endpoint"`
		TokenEndpoint     string          `json:"token_endpoint"`
		CallbackURL       string          `json:"callback_url"`
		OAuthBackend      string          `json:"oauth_backend"`
	}{routes, r.authorizeEndpoint, r.tokenEndpoint, r.callbackURL, r.oauthBackend})
	digest := sha256.Sum256(payload)
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

// OpenSession returns new executable wrappers for one already-reserved canonical
// mecatl session ID. Reservation and persistence remain server responsibilities;
// this adapter never mints, rewrites, or exposes session IDs.
func (r *Runtime) OpenSession(id session.SessionID) (*SessionTools, error) {
	if id == "" {
		return nil, fmt.Errorf("%w: session id is required", ErrInvalidRoute)
	}
	r.mu.RLock()
	if r.closed {
		r.mu.RUnlock()
		return nil, ErrClosed
	}
	routes := append([]Route(nil), r.routes...)
	caller := r.caller
	opener := r.opener
	r.mu.RUnlock()

	var closeFunc func() error
	if opener != nil {
		var err error
		caller, closeFunc, err = opener(context.Background(), id)
		if err != nil {
			return nil, err
		}
	}
	opened := &SessionTools{sessionID: id, closeFunc: closeFunc, runtime: r}
	tools := make([]tool.Tool, len(routes))
	for i, route := range routes {
		base := &sessionTool{sessionID: id, route: route, caller: caller, owner: opened}
		if route.Protected {
			tools[i] = &protectedSessionTool{sessionTool: base}
		} else {
			tools[i] = base
		}
	}
	opened.tools = tools

	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		_ = opened.closeOwned()
		return nil, ErrClosed
	}
	if _, tombstoned := r.tombstones[id]; tombstoned {
		r.mu.Unlock()
		_ = opened.closeOwned()
		return nil, ErrInvalidControlTarget
	}
	if _, exists := r.sessions[id]; exists {
		r.mu.Unlock()
		_ = opened.closeOwned()
		return nil, fmt.Errorf("%w: session is already open", ErrInvalidRoute)
	}
	r.sessions[id] = opened
	lifecycleCtx, cancel := context.WithCancel(r.lifecycleCtx)
	r.lifecycles[id] = &sessionLifecycle{ctx: lifecycleCtx, cancel: cancel}
	r.mu.Unlock()
	return opened, nil
}

// Connect returns the one pending embedded-ToolHive authorization rendezvous
// for an opened canonical parent session and its configured protected backend.
// A caller's cancellation never cancels the shared browser transaction.
func (r *Runtime) Connect(_ context.Context, sessionID session.SessionID, backendID string) (ConnectResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return ConnectResult{}, ErrClosed
	}
	r.collectExpiredLocked(r.now())
	target := controlTarget{sessionID: sessionID, backendID: backendID}
	if !r.openSessionLocked(sessionID) || !r.protectedBackendLocked(backendID) {
		return ConnectResult{}, ErrInvalidControlTarget
	}
	if backendID != r.oauthBackend {
		return ConnectResult{}, ErrUnsupportedCapability
	}
	if r.authorizeEndpoint == "" {
		return ConnectResult{}, ErrInvalidControlTarget
	}
	if _, disconnected := r.disconnected[target]; disconnected {
		return ConnectResult{}, fmt.Errorf("%w: reconnect requires ToolHive ConnectUpstream", ErrUnsupportedCapability)
	}
	if _, connected := r.grants[target]; connected {
		return ConnectResult{Status: ConnectionConnected}, nil
	}
	if transaction, ok := r.transactions[target]; ok {
		return authorizationResult(transaction), nil
	}
	handle, err := newOpaqueHandle()
	if err != nil {
		return ConnectResult{}, fmt.Errorf("vmcpbroker: create authorization rendezvous: %w", err)
	}
	verifier, err := newOpaqueHandle()
	if err != nil {
		return ConnectResult{}, fmt.Errorf("vmcpbroker: create authorization rendezvous: %w", err)
	}
	browserURL, err := url.Parse(r.authorizeEndpoint)
	if err != nil {
		return ConnectResult{}, ErrInvalidControlTarget
	}
	query := browserURL.Query()
	challenge := sha256.Sum256([]byte(verifier))
	query.Set("response_type", "code")
	query.Set("client_id", r.clientID)
	query.Set("redirect_uri", r.callbackURL)
	query.Set("scope", "openid offline_access")
	query.Set("code_challenge", base64.RawURLEncoding.EncodeToString(challenge[:]))
	query.Set("code_challenge_method", "S256")
	query.Set("resource", r.resource)
	query.Set("state", handle)
	browserURL.RawQuery = query.Encode()
	transaction := authorizationTransaction{
		handle:     handle,
		verifier:   verifier,
		browserURL: browserURL.String(),
		expiresAt:  r.now().Add(r.transactionTTL),
	}
	r.transactions[target] = transaction
	r.authorizations[target] = handle
	return authorizationResult(transaction), nil
}

// cancelAuthorization deletes only the exact pending transaction. It deliberately
// does not disconnect the backend: a save failure must invalidate the unusable
// browser rendezvous without changing the session's future connection posture.
func (r *Runtime) cancelAuthorization(sessionID session.SessionID, backendID, handle string) error {
	target := controlTarget{sessionID: sessionID, backendID: backendID}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || !r.openSessionLocked(sessionID) {
		return ErrInvalidControlTarget
	}
	transaction, ok := r.transactions[target]
	if !ok || transaction.handle != handle {
		return ErrInvalidControlTarget
	}
	delete(r.transactions, target)
	delete(r.authorizations, target)
	if transaction.cancel != nil {
		transaction.cancel()
	}
	return nil
}

// AuthorizationStatus observes a precise, already-created authorization. It
// never creates a browser transaction; all invalid targets are one error class.
type AuthorizationStatus struct {
	Status     ConnectionStatus
	BrowserURL string
	ExpiresAt  time.Time
}

// CheckAuthorization validates the session-local route and opaque handle, then
// reports only its pending/connected state. It deliberately does not expire or
// remove the transaction: the Service owns the durable expiry decision. Backend
// ids stay inside Runtime.
func (r *Runtime) CheckAuthorization(_ context.Context, id session.SessionID, routeID, authorizationID string) (AuthorizationStatus, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	target, ok := r.targetForRouteLocked(id, routeID)
	if !ok || authorizationID == "" || r.authorizations[target] != authorizationID {
		return AuthorizationStatus{}, ErrInvalidControlTarget
	}
	if pending, ok := r.transactions[target]; ok && pending.handle == authorizationID {
		return AuthorizationStatus{Status: ConnectionPending, BrowserURL: pending.browserURL, ExpiresAt: pending.expiresAt}, nil
	}
	if _, ok := r.grants[target]; ok {
		return AuthorizationStatus{Status: ConnectionConnected}, nil
	}
	return AuthorizationStatus{}, ErrInvalidControlTarget
}

// CancelAuthorization cancels exactly one handle without Disconnect, allowing a
// later fresh authorization transaction for the same protected route.
func (r *Runtime) CancelAuthorization(ctx context.Context, id session.SessionID, routeID, authorizationID string) error {
	_, _ = ctx, authorizationID
	r.mu.Lock()
	defer r.mu.Unlock()
	target, ok := r.targetForRouteLocked(id, routeID)
	if !ok || authorizationID == "" || r.authorizations[target] != authorizationID {
		return ErrInvalidControlTarget
	}
	transaction := r.transactions[target]
	delete(r.transactions, target)
	delete(r.authorizations, target)
	delete(r.grants, target)
	if transaction.cancel != nil {
		transaction.cancel()
	}
	return nil
}

func (r *Runtime) targetForRouteLocked(id session.SessionID, routeID string) (controlTarget, bool) {
	if r.closed || !r.openSessionLocked(id) {
		return controlTarget{}, false
	}
	for _, route := range r.routes {
		if route.Protected && route.Tool.Name == routeID {
			return controlTarget{sessionID: id, backendID: route.BackendID}, true
		}
	}
	return controlTarget{}, false
}

// Disconnect removes one backend's broker state without affecting other backends
// in the same session. A disconnected OAuth backend cannot create a second
// ToolHive lineage, so reconnect reports the explicit ConnectUpstream limitation.
func (r *Runtime) Disconnect(sessionID session.SessionID, backendID string) error {
	target := controlTarget{sessionID: sessionID, backendID: backendID}
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return ErrClosed
	}
	if _, tombstoned := r.tombstones[sessionID]; tombstoned {
		r.mu.Unlock()
		return nil
	}
	if !r.openSessionLocked(sessionID) || !r.knownBackendLocked(backendID) {
		r.mu.Unlock()
		return ErrInvalidControlTarget
	}
	delete(r.transactions, target)
	delete(r.authorizations, target)
	delete(r.grants, target)
	if r.protectedBackendLocked(backendID) {
		r.disconnected[target] = struct{}{}
	}
	refresh := r.refreshes[target]
	if refresh != nil {
		refresh.cancel()
	}
	r.mu.Unlock()
	if refresh != nil {
		<-refresh.done
	}
	return nil
}

// Callback atomically consumes a broker-created state and exchanges the returned
// downstream authorization code exclusively with ToolHive's embedded /oauth/token
// endpoint. The code, verifier, and resulting grant never leave this adapter.
func (r *Runtime) Callback(ctx context.Context, code, state string) error {
	if code == "" || state == "" {
		return ErrInvalidControlTarget
	}
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return ErrClosed
	}
	r.collectExpiredLocked(r.now())
	var (
		target      controlTarget
		transaction authorizationTransaction
		found       bool
	)
	for candidate, pending := range r.transactions {
		if pending.handle == state && !pending.exchanging {
			target, transaction, found = candidate, pending, true
			exchangeCtx, cancel := context.WithCancel(ctx)
			pending.cancel = cancel
			pending.exchanging = true
			r.transactions[candidate] = pending
			ctx = exchangeCtx
			break
		}
	}
	r.mu.Unlock()
	if !found {
		return ErrInvalidControlTarget
	}

	opCtx, done, err := r.beginOperation(ctx, target.sessionID)
	if err != nil {
		return err
	}
	defer done()
	grant, err := r.exchangeDownstreamCode(opCtx, code, transaction.verifier)
	if err != nil {
		r.restoreTransaction(target, transaction)
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || !r.validControlTargetLocked(target) {
		return ErrInvalidControlTarget
	}
	pending, ok := r.transactions[target]
	if !ok || pending.handle != transaction.handle || !pending.exchanging || r.authorizations[target] != transaction.handle {
		// Cancellation won while the exchange was in flight. It is deliberately
		// terminal: do not resurrect an authority grant after cancellation.
		return ErrInvalidControlTarget
	}
	delete(r.transactions, target)
	r.grants[target] = grant
	return nil
}

func (r *Runtime) beginOperation(parent context.Context, id session.SessionID) (context.Context, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil, nil, ErrClosed
	}
	lifecycle := r.lifecycles[id]
	if lifecycle == nil || !r.openSessionLocked(id) {
		return nil, nil, ErrInvalidControlTarget
	}
	ctx, cancel := context.WithCancel(lifecycle.ctx)
	stop := context.AfterFunc(parent, cancel)
	lifecycle.wg.Add(1)
	return ctx, func() {
		stop()
		cancel()
		lifecycle.wg.Done()
	}, nil
}

func (r *Runtime) restoreGrant(target controlTarget, grant downstreamGrant) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || !r.refreshableTargetLocked(target) {
		return ErrInvalidControlTarget
	}
	r.grants[target] = grant
	return nil
}

func (r *Runtime) restoreTransaction(target controlTarget, transaction authorizationTransaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || !transaction.expiresAt.After(r.now()) || !r.validControlTargetLocked(target) || r.authorizations[target] != transaction.handle {
		return
	}
	if _, connected := r.grants[target]; connected {
		return
	}
	if existing, ok := r.transactions[target]; ok {
		if existing.handle == transaction.handle && existing.exchanging {
			transaction.exchanging = false
			r.transactions[target] = transaction
		}
		return
	}
	r.transactions[target] = transaction
}

func (r *Runtime) exchangeDownstreamCode(ctx context.Context, code, verifier string) (downstreamGrant, error) {
	cfg := r.oauthConfig()
	ctx = context.WithValue(ctx, oauth2.HTTPClient, r.httpClient)
	token, err := cfg.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil || !validBearerToken(token) {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	return newDownstreamGrant(token), nil
}

// validBearerToken admits only an OAuth bearer credential. Empty TokenType is
// OAuth's bearer default; any explicit non-bearer type must never reach the
// transport, where oauth2 would otherwise emit a different authorization scheme.
func validBearerToken(token *oauth2.Token) bool {
	return token != nil && token.AccessToken != "" &&
		(token.TokenType == "" || strings.EqualFold(token.TokenType, "Bearer"))
}

func newDownstreamGrant(token *oauth2.Token) downstreamGrant {
	return downstreamGrant{token: token, accessToken: token.AccessToken, refreshToken: token.RefreshToken}
}

func (g downstreamGrant) bearer() string {
	if g.token != nil {
		return g.token.AccessToken
	}
	return g.accessToken
}

type scopedGrantTokenSource struct {
	runtime *Runtime
	target  controlTarget
}

func (s scopedGrantTokenSource) Token() (*oauth2.Token, error) {
	grant, err := s.runtime.grantForTarget(s.target)
	if err != nil {
		return nil, err
	}
	// oauth2.Transport asks its TokenSource for every request. Refresh here, at
	// the credential seam, so an expired grant is never emitted as a bearer
	// header merely because a protected MCP connection was already established.
	if grant.token != nil && !grant.token.Valid() {
		grant, err = s.runtime.refreshDownstreamGrant(context.Background(), s.target, grant)
		if err != nil {
			return nil, err
		}
	}
	if grant.token != nil {
		if !validBearerToken(grant.token) {
			return nil, ErrInvalidControlTarget
		}
		return grant.token, nil
	}
	if grant.accessToken == "" {
		return nil, ErrInvalidControlTarget
	}
	return &oauth2.Token{AccessToken: grant.accessToken, TokenType: "Bearer"}, nil
}

func (r *Runtime) oauthConfig() oauth2.Config {
	return oauth2.Config{
		ClientID:    r.clientID,
		RedirectURL: r.callbackURL,
		Endpoint:    oauth2.Endpoint{AuthURL: r.authorizeEndpoint, TokenURL: r.tokenEndpoint},
	}
}

func (r *Runtime) refreshDownstreamGrant(ctx context.Context, target controlTarget, expected downstreamGrant) (downstreamGrant, error) {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return downstreamGrant{}, ErrClosed
	}
	current, ok := r.grants[target]
	if !ok || current != expected || !r.refreshableTargetLocked(target) {
		r.mu.Unlock()
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	if pending := r.refreshes[target]; pending != nil {
		r.mu.Unlock()
		select {
		case <-pending.done:
			if pending.err != nil {
				return downstreamGrant{}, pending.err
			}
			return r.grantForTarget(target)
		case <-ctx.Done():
			return downstreamGrant{}, ctx.Err()
		}
	}
	lifecycle := r.lifecycles[target.sessionID]
	if lifecycle == nil {
		r.mu.Unlock()
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	refreshCtx, cancel := context.WithCancel(lifecycle.ctx)
	stop := context.AfterFunc(ctx, cancel)
	lifecycle.wg.Add(1)
	operation := &refreshOperation{done: make(chan struct{}), cancel: cancel}
	r.refreshes[target] = operation
	r.mu.Unlock()

	grant, err := r.exchangeDownstreamRefresh(refreshCtx, expected)
	stop()
	cancel()
	lifecycle.wg.Done()

	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.refreshes, target)
	if err == nil {
		current, ok := r.grants[target]
		if r.closed {
			err = ErrClosed
		} else if !ok || current != expected || !r.refreshableTargetLocked(target) {
			err = ErrInvalidControlTarget
		} else {
			r.grants[target] = grant
		}
	} else if errors.Is(err, errDownstreamRefreshRejected) {
		if current, ok := r.grants[target]; ok && current == expected {
			delete(r.grants, target)
		}
	}
	operation.err = err
	close(operation.done)
	if err != nil {
		r.diagnostics.Log(context.Background(), port.LevelWarn, "broker transport bearer refresh failed")
		return downstreamGrant{}, err
	}
	return grant, nil
}

func (r *Runtime) exchangeDownstreamRefresh(ctx context.Context, grant downstreamGrant) (downstreamGrant, error) {
	token := grant.token
	if token == nil {
		token = &oauth2.Token{AccessToken: grant.accessToken, RefreshToken: grant.refreshToken, Expiry: time.Now().Add(-time.Second)}
	}
	if token.RefreshToken == "" || r.tokenEndpoint == "" {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, r.httpClient)
	cfg := r.oauthConfig()
	refreshed, err := cfg.TokenSource(ctx, token).Token()
	if err != nil || !validBearerToken(refreshed) {
		return downstreamGrant{}, errDownstreamRefreshRejected
	}
	return newDownstreamGrant(refreshed), nil
}

// ForgetSession tombstones a canonical session, cancels its login and refresh
// work, then removes its state after its wrappers have drained. It is idempotent.
func (r *Runtime) ForgetSession(id session.SessionID) error {
	opened, lifecycle, err := r.tombstoneAndCancel(id, nil)
	if err != nil || opened == nil {
		if errors.Is(err, ErrInvalidControlTarget) {
			return nil
		}
		return err
	}
	closeErr := opened.closeOwned()
	lifecycle.wg.Wait()
	r.finishForget(id, opened)
	return closeErr
}

func (r *Runtime) tombstoneAndCancel(id session.SessionID, owner *SessionTools) (*SessionTools, *sessionLifecycle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil, nil, ErrClosed
	}
	if _, tombstoned := r.tombstones[id]; tombstoned {
		return nil, nil, nil
	}
	opened := r.sessions[id]
	lifecycle := r.lifecycles[id]
	if opened == nil || lifecycle == nil || owner != nil && opened != owner {
		return nil, nil, ErrInvalidControlTarget
	}
	r.tombstones[id] = struct{}{}
	lifecycle.cancel()
	for target, refresh := range r.refreshes {
		if target.sessionID == id {
			refresh.cancel()
		}
	}
	return opened, lifecycle, nil
}

func (r *Runtime) finishForget(id session.SessionID, owner *SessionTools) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sessions[id] != owner {
		return
	}
	delete(r.sessions, id)
	delete(r.lifecycles, id)
	delete(r.tombstones, id)
	for target := range r.transactions {
		if target.sessionID == id {
			delete(r.transactions, target)
		}
	}
	for target := range r.authorizations {
		if target.sessionID == id {
			delete(r.authorizations, target)
		}
	}
	for target := range r.grants {
		if target.sessionID == id {
			delete(r.grants, target)
		}
	}
	for target := range r.disconnected {
		if target.sessionID == id {
			delete(r.disconnected, target)
		}
	}
}

func (r *Runtime) refreshableTargetLocked(target controlTarget) bool {
	return r.openSessionLocked(target.sessionID) &&
		r.protectedBackendLocked(target.backendID) &&
		target.backendID == r.oauthBackend
}

func (r *Runtime) validControlTargetLocked(target controlTarget) bool {
	return r.refreshableTargetLocked(target) && r.authorizeEndpoint != ""
}

func (r *Runtime) openSessionLocked(id session.SessionID) bool {
	if id == "" || delegationChildSessionID(id) {
		return false
	}
	if _, opened := r.sessions[id]; !opened {
		return false
	}
	_, tombstoned := r.tombstones[id]
	return !tombstoned
}

func (r *Runtime) knownBackendLocked(backendID string) bool {
	for _, route := range r.routes {
		if route.BackendID == backendID {
			return true
		}
	}
	return false
}

func (r *Runtime) protectedBackendLocked(backendID string) bool {
	if backendID == "" {
		return false
	}
	for _, route := range r.routes {
		if route.BackendID == backendID && route.Protected {
			return true
		}
	}
	return false
}

func (r *Runtime) grantForTarget(target controlTarget) (downstreamGrant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	grant, ok := r.grants[target]
	if !ok || r.closed || !r.refreshableTargetLocked(target) {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	return grant, nil
}

func (r *Runtime) grant(sessionID session.SessionID, backendID string) (downstreamGrant, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	grant, ok := r.grants[controlTarget{sessionID: sessionID, backendID: backendID}]
	return grant, ok && !r.closed
}

func (s *SessionTools) connected(sessionID session.SessionID, backendID string) bool {
	_, ok := s.runtime.grant(sessionID, backendID)
	return ok
}

func delegationChildSessionID(id session.SessionID) bool {
	return strings.HasPrefix(string(id), "subagent-") ||
		strings.HasPrefix(string(id), "parallel-") ||
		strings.HasPrefix(string(id), "team-")
}

func (r *Runtime) collectExpiredLocked(now time.Time) {
	for target, transaction := range r.transactions {
		if !transaction.expiresAt.After(now) {
			delete(r.transactions, target)
			delete(r.authorizations, target)
			if transaction.cancel != nil {
				transaction.cancel()
			}
		}
	}
}

func authorizationResult(transaction authorizationTransaction) ConnectResult {
	return ConnectResult{Status: ConnectionPending, AuthorizationRequired: &AuthorizationRequired{
		Handle:     transaction.handle,
		BrowserURL: transaction.browserURL,
		ExpiresAt:  transaction.expiresAt,
	}}
}

func newOpaqueHandle() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// Close rejects all new work, cancels and joins per-session operations, drains
// session transports, then releases Runtime-owned resources. The process bundle
// owns the borrowed embedded ToolHive authorization server and its storage.
func (r *Runtime) Close() error {
	r.closeOnce.Do(func() {
		r.mu.Lock()
		r.closed = true
		r.cancelLifecycle()
		sessions := make([]*SessionTools, 0, len(r.sessions))
		lifecycles := make([]*sessionLifecycle, 0, len(r.lifecycles))
		for id, opened := range r.sessions {
			r.tombstones[id] = struct{}{}
			sessions = append(sessions, opened)
		}
		for _, lifecycle := range r.lifecycles {
			lifecycle.cancel()
			lifecycles = append(lifecycles, lifecycle)
		}
		for _, transaction := range r.transactions {
			if transaction.cancel != nil {
				transaction.cancel()
			}
		}
		for _, refresh := range r.refreshes {
			refresh.cancel()
		}
		r.mu.Unlock()

		for _, opened := range sessions {
			r.closeErr = errors.Join(r.closeErr, opened.closeOwned())
		}
		for _, lifecycle := range lifecycles {
			lifecycle.wg.Wait()
		}
		r.mu.Lock()
		r.sessions = make(map[session.SessionID]*SessionTools)
		r.lifecycles = make(map[session.SessionID]*sessionLifecycle)
		r.transactions = make(map[controlTarget]authorizationTransaction)
		r.authorizations = make(map[controlTarget]string)
		r.grants = make(map[controlTarget]downstreamGrant)
		r.disconnected = make(map[controlTarget]struct{})
		r.refreshes = make(map[controlTarget]*refreshOperation)
		closers := append([]namedCloser(nil), r.sharedClosers...)
		r.mu.Unlock()
		for _, closer := range closers {
			r.closeErr = errors.Join(r.closeErr, closer.close())
		}
	})
	return r.closeErr
}

// SessionTools owns the wrappers for one session.
type SessionTools struct {
	mu             sync.RWMutex
	tools          []tool.Tool
	closed         bool
	calls          sync.WaitGroup
	closeOnce      sync.Once
	ownedCloseOnce sync.Once
	closeErr       error
	sessionID      session.SessionID
	closeFunc      func() error
	runtime        *Runtime
}

// Tools returns a copy of the stable model-facing wrapper list.
func (s *SessionTools) Tools() []tool.Tool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]tool.Tool(nil), s.tools...)
}

// Close rejects new calls, drains its own in-flight calls and transport, then
// irrevocably forgets only this session from the shared Runtime.
func (s *SessionTools) Close() error {
	s.closeOnce.Do(func() {
		opened, lifecycle, err := s.runtime.tombstoneAndCancel(s.sessionID, s)
		if err != nil && !errors.Is(err, ErrClosed) {
			s.closeErr = err
			return
		}
		s.closeErr = s.closeOwned()
		if errors.Is(err, ErrClosed) || opened == nil || lifecycle == nil {
			return
		}
		lifecycle.wg.Wait()
		s.runtime.finishForget(s.sessionID, s)
	})
	return s.closeErr
}

func (s *SessionTools) beginCall() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return false
	}
	s.calls.Add(1)
	return true
}

func (r *Runtime) callAllowed(id session.SessionID, owner *SessionTools) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return !r.closed && r.sessions[id] == owner && r.openSessionLocked(id)
}

func (s *SessionTools) closeOwned() error {
	s.ownedCloseOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		closeFunc := s.closeFunc
		s.mu.Unlock()
		s.calls.Wait()
		if closeFunc != nil {
			s.closeErr = closeFunc()
		}
	})
	return s.closeErr
}

type sessionTool struct {
	sessionID session.SessionID
	route     Route
	caller    Caller
	owner     *SessionTools
}

func (t *sessionTool) Spec() tool.ToolSpec { return copyRoute(t.route).Tool }
func (t *sessionTool) ReadOnly() bool      { return t.route.ReadOnly }
func (*sessionTool) DispatchSerial() bool  { return true }

type protectedSessionTool struct{ *sessionTool }

// RequestAuthorization starts or observes the protected route's broker-private connection
// transaction without exposing its browser URL or credentials to the engine.
func (t *protectedSessionTool) RequestAuthorization(ctx context.Context) (tool.AuthorizationRequest, bool, error) {
	if !t.owner.beginCall() || !t.owner.runtime.callAllowed(t.sessionID, t.owner) {
		return tool.AuthorizationRequest{}, false, ErrClosed
	}
	defer t.owner.calls.Done()
	connected, err := t.owner.runtime.Connect(ctx, t.sessionID, t.route.BackendID)
	if err != nil {
		return tool.AuthorizationRequest{}, false, err
	}
	if connected.Status == ConnectionConnected {
		return tool.AuthorizationRequest{}, false, nil
	}
	if connected.Status != ConnectionPending || connected.AuthorizationRequired == nil {
		return tool.AuthorizationRequest{}, false, ErrInvalidControlTarget
	}
	label := t.route.AuthorizationLabel
	if label == "" {
		// Direct Runtime construction is used by embedders and tests; the public
		// tool name is safe, whereas BackendID is never a fallback label.
		label = t.route.Tool.Name
	}
	return tool.AuthorizationRequest{
		ID:        connected.AuthorizationRequired.Handle,
		Backend:   label,
		RouteID:   t.route.Tool.Name,
		ConfigID:  t.owner.runtime.EnrollmentID(),
		ExpiresAt: connected.AuthorizationRequired.ExpiresAt,
	}, true, nil
}

// CancelAuthorization invalidates precisely the pending broker transaction.
func (t *protectedSessionTool) CancelAuthorization(_ context.Context, authorizationID string) error {
	return t.owner.runtime.cancelAuthorization(t.sessionID, t.route.BackendID, authorizationID)
}

// InvalidateAuthorization makes this retained wrapper unusable. It is the
// authoritative fallback when precise transaction cancellation cannot confirm
// removal; Close tombstones the session before any fallible cleanup, so even an
// error leaves this requester unable to create or execute a transaction.
func (t *protectedSessionTool) InvalidateAuthorization(_ context.Context, _ string) error {
	return t.owner.Close()
}

func (t *sessionTool) Execute(ctx context.Context, call session.ToolCall, _ tool.Environment) (session.ToolResult, error) {
	if !t.owner.beginCall() || !t.owner.runtime.callAllowed(t.sessionID, t.owner) {
		return session.ToolResult{}, ErrClosed
	}
	defer t.owner.calls.Done()
	if call.Name != t.route.Tool.Name {
		return session.NewToolError(call.ID, "broker tool call does not match wrapper"), nil
	}
	if t.route.Protected && !t.owner.connected(t.sessionID, t.route.BackendID) {
		return session.NewToolError(call.ID, "authorization required for this broker tool"), nil
	}
	if err := ctx.Err(); err != nil {
		return session.ToolResult{}, err
	}
	result, err := t.caller(ctx, t.sessionID, copyRoute(t.route), append(json.RawMessage(nil), call.Args...))
	result.CallID = call.ID
	return result, err
}

func copyRoute(in Route) Route {
	in.Tool.Schema = append(json.RawMessage(nil), in.Tool.Schema...)
	return in
}
