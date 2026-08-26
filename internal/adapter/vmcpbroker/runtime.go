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
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"
)

// ErrClosed reports an operation on a closed runtime or session tool set.
var ErrClosed = errors.New("vmcpbroker: closed")

// ErrInvalidRoute reports invalid static broker catalogue input.
var ErrInvalidRoute = errors.New("vmcpbroker: invalid route")

// ErrInvalidControlTarget reports an unknown, closed, tombstoned, or unconfigured
// composition-private control target. It deliberately does not identify which part
// of the target was invalid.
var ErrInvalidControlTarget = errors.New("vmcpbroker: invalid control target")

// Route joins a neutral, model-facing tool specification to its private broker
// backend route. BackendID is consumed only by the injected broker caller; it
// is never copied into ToolSpec, a ToolCall, or a ToolResult.
type Route struct {
	BackendID string
	Tool      tool.ToolSpec
	ReadOnly  bool
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
	configured := make(map[string]bool, len(profiles))
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
			configured[name] = false
		case "oauth":
			configured[name] = true
		default:
			return nil, fmt.Errorf("%w: unsupported auth mode %q for backend %q", ErrInvalidRoute, profile.Auth.Mode, profile.Name)
		}
	}
	routes := make([]Route, 0, len(discovered))
	seen := make(map[string]struct{}, len(discovered))
	for _, definition := range discovered {
		protected, ok := configured[strings.ToLower(definition.BackendID)]
		if !ok {
			return nil, fmt.Errorf("%w: unconfigured backend %q", ErrInvalidRoute, definition.BackendID)
		}
		if definition.Name == "" {
			return nil, fmt.Errorf("%w: tool name is required", ErrInvalidRoute)
		}
		if _, ok := seen[definition.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, definition.Name)
		}
		seen[definition.Name] = struct{}{}
		routes = append(routes, Route{
			BackendID: definition.BackendID,
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

// Runtime owns the stable catalogue and opens session-local executable wrappers.
type Runtime struct {
	mu                sync.RWMutex
	routes            []Route
	caller            Caller
	opener            sessionOpener
	sessions          map[session.SessionID]*SessionTools
	tombstones        map[session.SessionID]struct{}
	authorizeEndpoint string
	callbackURL       string
	transactionTTL    time.Duration
	transactions      map[controlTarget]authorizationTransaction
	grants            map[controlTarget]downstreamGrant
	clientID          string
	httpClient        *http.Client
	tokenEndpoint     string
	closed            bool
}

// ToolHiveRuntimeConfig binds the broker to its already-composed embedded
// ToolHive authorization server. It is root-internal; the Runtime never treats
// an issuer string alone as evidence of a usable ToolHive server.
type ToolHiveRuntimeConfig struct {
	AuthServer  *runner.EmbeddedAuthServer
	Storage     storage.ClientRegistry
	Issuer      string
	CallbackURL string
	// HTTPClient is used only for the embedded ToolHive downstream token exchange.
	// It must be configured by composition when the embedded server uses a private CA.
	HTTPClient *http.Client
}

type ConnectionStatus string

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
}

type downstreamGrant struct {
	accessToken  string
	refreshToken string
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
	for i, route := range routes {
		if route.BackendID == "" || route.Tool.Name == "" {
			return nil, fmt.Errorf("%w: backend id and tool name are required", ErrInvalidRoute)
		}
		if _, ok := seen[route.Tool.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, route.Tool.Name)
		}
		seen[route.Tool.Name] = struct{}{}
		copied[i] = copyRoute(route)
	}
	sort.Slice(copied, func(i, j int) bool { return copied[i].Tool.Name < copied[j].Tool.Name })
	return &Runtime{
		routes:       copied,
		caller:       caller,
		sessions:     make(map[session.SessionID]*SessionTools),
		tombstones:   make(map[session.SessionID]struct{}),
		transactions: make(map[controlTarget]authorizationTransaction),
		grants:       make(map[controlTarget]downstreamGrant),
	}, nil
}

// NewToolHiveRuntime enables composition-private connection rendezvous for one
// ToolHive embedded authorization server. The server owns all upstream OAuth
// protocol state; this Runtime retains only a random downstream handle bound to
// an opened canonical session and protected backend.
func NewToolHiveRuntime(routes []Route, caller Caller, config ToolHiveRuntimeConfig, transactionTTL time.Duration) (*Runtime, error) {
	if config.AuthServer == nil || config.Storage == nil || config.CallbackURL == "" {
		return nil, fmt.Errorf("%w: embedded ToolHive authorization server, storage, and callback URL are required", ErrInvalidRoute)
	}
	endpoint, err := toolHiveAuthorizeEndpoint(config.Issuer)
	if err != nil {
		return nil, err
	}
	tokenEndpoint, err := toolHiveTokenEndpoint(config.Issuer)
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
	if len(protected) != 1 {
		return nil, fmt.Errorf("%w: exactly one protected backend is required", ErrInvalidRoute)
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
		GrantTypes:    []string{"authorization_code"},
		ResponseTypes: []string{"code"},
		Scopes:        []string{"openid"},
		Audience:      []string{config.Issuer},
		Public:        true,
	}); err != nil {
		return nil, fmt.Errorf("vmcpbroker: register ToolHive client: %w", err)
	}
	runtime.authorizeEndpoint = endpoint
	runtime.tokenEndpoint = tokenEndpoint
	runtime.callbackURL = config.CallbackURL
	runtime.transactionTTL = transactionTTL
	runtime.clientID = clientID
	runtime.httpClient = config.HTTPClient
	if runtime.httpClient == nil {
		runtime.httpClient = http.DefaultClient
	}
	return runtime, nil
}

func toolHiveAuthorizeEndpoint(issuer string) (string, error) {
	return toolHiveOAuthEndpoint(issuer, "/oauth/authorize")
}

func toolHiveTokenEndpoint(issuer string) (string, error) {
	return toolHiveOAuthEndpoint(issuer, "/oauth/token")
}

func toolHiveOAuthEndpoint(issuer, suffix string) (string, error) {
	parsed, err := url.Parse(issuer)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("%w: ToolHive issuer must be an HTTPS origin", ErrInvalidRoute)
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/") + suffix
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
			server, err = mcp.Connect(ctx, mcp.ServerConfig{Name: "broker", URL: c.endpoint, Headers: map[string]string{"Authorization": "Bearer " + grant.accessToken}}, nil)
			if err != nil {
				return session.ToolResult{}, fmt.Errorf("vmcpbroker: connect protected broker endpoint: %w", err)
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
		return session.ToolResult{}, fmt.Errorf("vmcpbroker: broker did not expose configured tool %q", route.Tool.Name)
	}
	return wrapped.Execute(ctx, session.NewToolCall("", wrapped.Spec().Name, args), tool.Environment{})
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
	opened := &SessionTools{closeFunc: closeFunc, runtime: r}
	tools := make([]tool.Tool, len(routes))
	for i, route := range routes {
		tools[i] = &sessionTool{sessionID: id, route: route, caller: caller, owner: opened}
	}
	opened.tools = tools

	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		_ = opened.Close()
		return nil, ErrClosed
	}
	if _, tombstoned := r.tombstones[id]; tombstoned {
		r.mu.Unlock()
		_ = opened.Close()
		return nil, ErrInvalidControlTarget
	}
	if _, exists := r.sessions[id]; exists {
		r.mu.Unlock()
		_ = opened.Close()
		return nil, fmt.Errorf("%w: session is already open", ErrInvalidRoute)
	}
	r.sessions[id] = opened
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
	r.collectExpiredLocked(time.Now())
	target := controlTarget{sessionID: sessionID, backendID: backendID}
	if !r.validControlTargetLocked(target) {
		return ConnectResult{}, ErrInvalidControlTarget
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
	query.Set("scope", "openid")
	query.Set("code_challenge", base64.RawURLEncoding.EncodeToString(challenge[:]))
	query.Set("code_challenge_method", "S256")
	query.Set("resource", strings.TrimSuffix(r.authorizeEndpoint, "/oauth/authorize"))
	query.Set("state", handle)
	browserURL.RawQuery = query.Encode()
	transaction := authorizationTransaction{
		handle:     handle,
		verifier:   verifier,
		browserURL: browserURL.String(),
		expiresAt:  time.Now().Add(r.transactionTTL),
	}
	r.transactions[target] = transaction
	return authorizationResult(transaction), nil
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
	r.collectExpiredLocked(time.Now())
	var (
		target      controlTarget
		transaction authorizationTransaction
		found       bool
	)
	for candidate, pending := range r.transactions {
		if pending.handle == state {
			target, transaction, found = candidate, pending, true
			delete(r.transactions, candidate)
			break
		}
	}
	r.mu.Unlock()
	if !found {
		return ErrInvalidControlTarget
	}

	grant, err := r.exchangeDownstreamCode(ctx, code, transaction.verifier)
	if err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return ErrClosed
	}
	if !r.validControlTargetLocked(target) {
		return ErrInvalidControlTarget
	}
	r.grants[target] = grant
	return nil
}

func (r *Runtime) exchangeDownstreamCode(ctx context.Context, code, verifier string) (downstreamGrant, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {r.callbackURL},
		"client_id":     {r.clientID},
		"code_verifier": {verifier},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, r.tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := r.httpClient.Do(request)
	if err != nil {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	var token struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil || token.AccessToken == "" {
		return downstreamGrant{}, ErrInvalidControlTarget
	}
	return downstreamGrant{accessToken: token.AccessToken, refreshToken: token.RefreshToken}, nil
}

// ForgetSession tombstones a canonical session and removes all its pending
// control state. It is intentionally idempotent so close paths can retry.
func (r *Runtime) ForgetSession(id session.SessionID) error {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return ErrClosed
	}
	opened, exists := r.sessions[id]
	if !exists {
		if _, tombstoned := r.tombstones[id]; tombstoned {
			r.mu.Unlock()
			return nil
		}
		r.mu.Unlock()
		return ErrInvalidControlTarget
	}
	delete(r.sessions, id)
	r.tombstones[id] = struct{}{}
	for target := range r.transactions {
		if target.sessionID == id {
			delete(r.transactions, target)
		}
	}
	for target := range r.grants {
		if target.sessionID == id {
			delete(r.grants, target)
		}
	}
	r.mu.Unlock()
	return opened.Close()
}

func (r *Runtime) validControlTargetLocked(target controlTarget) bool {
	if target.sessionID == "" || target.backendID == "" || delegationChildSessionID(target.sessionID) {
		return false
	}
	if _, opened := r.sessions[target.sessionID]; !opened {
		return false
	}
	if _, tombstoned := r.tombstones[target.sessionID]; tombstoned {
		return false
	}
	for _, route := range r.routes {
		if route.BackendID == target.backendID && route.Protected {
			return r.authorizeEndpoint != ""
		}
	}
	return false
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

// Close prevents new session wrappers. Existing wrappers are intentionally not
// closed here; their owning session closes them before Runtime shutdown.
func (r *Runtime) Close() error {
	r.mu.Lock()
	r.closed = true
	r.mu.Unlock()
	return nil
}

// SessionTools owns the wrappers for one session.
type SessionTools struct {
	mu        sync.RWMutex
	tools     []tool.Tool
	closed    bool
	closeFunc func() error
	runtime   *Runtime
}

// Tools returns a copy of the stable model-facing wrapper list.
func (s *SessionTools) Tools() []tool.Tool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]tool.Tool(nil), s.tools...)
}

// Close makes the session's wrappers unavailable. It is idempotent.
func (s *SessionTools) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	closeFunc := s.closeFunc
	s.mu.Unlock()
	if closeFunc != nil {
		return closeFunc()
	}
	return nil
}

type sessionTool struct {
	sessionID session.SessionID
	route     Route
	caller    Caller
	owner     *SessionTools
}

func (t *sessionTool) Spec() tool.ToolSpec { return copyRoute(t.route).Tool }
func (t *sessionTool) ReadOnly() bool      { return t.route.ReadOnly }

func (t *sessionTool) Execute(ctx context.Context, call session.ToolCall, _ tool.Environment) (session.ToolResult, error) {
	t.owner.mu.RLock()
	closed := t.owner.closed
	t.owner.mu.RUnlock()
	if closed {
		return session.ToolResult{}, ErrClosed
	}
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
