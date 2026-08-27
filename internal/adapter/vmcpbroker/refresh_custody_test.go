package vmcpbroker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestSessionVMCPBroker_Scenario3_RefreshesTransportInternally(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const freshBearer = "downstream-access-fresh-canary"
	const refreshBearer = "downstream-refresh-canary"

	var refreshes atomic.Int32
	var staleRequests atomic.Int32
	var freshRequests atomic.Int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil || r.Form.Get("grant_type") != "refresh_token" || r.Form.Get("refresh_token") != refreshBearer {
			http.Error(w, "bad refresh request", http.StatusBadRequest)
			return
		}
		refreshes.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"`+freshBearer+`","refresh_token":"`+refreshBearer+`"}`)
	}))
	t.Cleanup(tokenServer.Close)

	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "github_list"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "refreshed protected result"}}}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	broker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read MCP request: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		if r.Header.Get("Authorization") == "Bearer "+freshBearer {
			freshRequests.Add(1)
			handler.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("Authorization") == "Bearer "+staleBearer {
			if staleRequests.Add(1) <= 2 {
				handler.ServeHTTP(w, r)
				return
			}
		}
		http.Error(w, "expired", http.StatusUnauthorized)
	}))
	t.Cleanup(broker.Close)

	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, broker.URL)
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	runtime.tokenEndpoint = tokenServer.URL
	runtime.httpClient = tokenServer.Client()
	tools, err := runtime.OpenSession("refresh-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })
	runtime.grants[controlTarget{sessionID: "refresh-session", backendID: "github"}] = downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}

	result, err := tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatal("protected Execute failed")
	}
	if result.IsError || !strings.Contains(result.Content, "refreshed protected result") {
		t.Fatal("protected transport did not refresh and retry")
	}
	if refreshes.Load() != 1 {
		t.Fatalf("refresh requests = %d, want 1", refreshes.Load())
	}
	if staleRequests.Load() < 3 || freshRequests.Load() == 0 {
		t.Fatal("protected transport was not reconnected after bearer expiry")
	}
}

func TestSessionVMCPBroker_Scenario3_EmbeddedToolHiveRefresh(t *testing.T) {
	runtime, client, upstreamCalls := newToolHiveStreamingRuntime(t)
	tools, err := runtime.OpenSession("refresh-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })

	pending, err := runtime.Connect(context.Background(), "refresh-session", "github")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	code, state := completeToolHiveAuthorization(t, client, pending.AuthorizationRequired.BrowserURL)
	if err := runtime.Callback(context.Background(), code, state); err != nil {
		t.Fatalf("Callback: %v", err)
	}

	caller := tools.Tools()[0]
	call := session.NewToolCall("call", caller.Spec().Name, json.RawMessage(`{}`))
	if result, err := caller.Execute(context.Background(), call, tool.Environment{}); err != nil || result.IsError {
		t.Fatal("initial embedded ToolHive protected call did not establish a transport")
	}
	target := controlTarget{sessionID: "refresh-session", backendID: "github"}
	runtime.mu.Lock()
	grant := runtime.grants[target]
	if grant.refreshToken == "" {
		runtime.mu.Unlock()
		t.Fatal("embedded ToolHive did not issue a downstream refresh grant")
	}
	grant.accessToken = "expired-downstream-bearer"
	runtime.grants[target] = grant
	runtime.mu.Unlock()

	result, err := caller.Execute(context.Background(), call, tool.Environment{})
	if err != nil || result.IsError || !strings.Contains(result.Content, "protected upstream result") {
		t.Fatal("embedded ToolHive transport did not refresh and retry the protected call")
	}
	if upstreamCalls.Load() < 2 {
		t.Fatalf("upstream calls = %d, want initial and retried calls", upstreamCalls.Load())
	}
}

func TestSessionVMCPBroker_RefreshFailureRemovesStaleGrant(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const refreshBearer = "downstream-refresh-canary"

	runtime, _, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if _, err := runtime.OpenSession("refresh-session"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	target := controlTarget{sessionID: "refresh-session", backendID: "github"}
	runtime.mu.Lock()
	runtime.grants[target] = downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}
	runtime.mu.Unlock()

	if _, err := runtime.refreshDownstreamGrant(context.Background(), target, downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}); err == nil {
		t.Fatal("refresh against embedded ToolHive token endpoint succeeded")
	}
	connected, err := runtime.Connect(context.Background(), "refresh-session", "github")
	if err != nil {
		t.Fatalf("Connect after terminal refresh failure: %v", err)
	}
	if connected.Status != ConnectionPending || connected.AuthorizationRequired == nil {
		t.Fatalf("Connect after terminal refresh failure = %+v, want AuthorizationRequired", connected)
	}
}

func TestSessionVMCPBroker_Scenario3_RefreshCannotResurrectState(t *testing.T) {
	const staleBearer = "downstream-access-expired-canary"
	const refreshBearer = "downstream-refresh-canary"

	var refreshes atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		refreshes.Add(1)
		close(started)
		<-release
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"replacement","refresh_token":"replacement-refresh"}`)
	}))
	t.Cleanup(tokenServer.Close)

	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, "http://127.0.0.1:1/mcp")
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	runtime.tokenEndpoint = tokenServer.URL
	runtime.httpClient = tokenServer.Client()
	tools, err := runtime.OpenSession("refresh-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	runtime.grants[controlTarget{sessionID: "refresh-session", backendID: "github"}] = downstreamGrant{accessToken: staleBearer, refreshToken: refreshBearer}

	caller := tools.Tools()[0]
	var wait sync.WaitGroup
	wait.Add(2)
	type callOutcome struct {
		result session.ToolResult
		err    error
	}
	results := make(chan callOutcome, 2)
	for range 2 {
		go func() {
			defer wait.Done()
			result, err := caller.Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
			results <- callOutcome{result: result, err: err}
		}()
	}
	<-started
	forgot := make(chan error, 1)
	go func() { forgot <- runtime.ForgetSession("refresh-session") }()
	select {
	case err := <-forgot:
		if err != nil {
			t.Fatalf("ForgetSession: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("ForgetSession did not finish after cancelling the refresh")
	}
	close(release)
	wait.Wait()
	close(results)
	for outcome := range results {
		if outcome.err == nil && !outcome.result.IsError {
			t.Fatal("call succeeded after forgotten session refresh")
		}
	}
	if refreshes.Load() != 1 {
		t.Fatalf("refresh requests = %d, want one shared refresh", refreshes.Load())
	}
	if _, ok := runtime.grant("refresh-session", "github"); ok {
		t.Fatal("late refresh restored forgotten session grant")
	}
}

func TestInvariant_vmcp_broker_secrets_do_not_escape(t *testing.T) {
	canaries := []string{
		"upstream-access-canary", "downstream-access-canary", "downstream-refresh-canary",
		"oauth-client-secret-canary", "authorization-code-canary", "pkce-verifier-canary",
		"callback-state-canary", "tsid-canary", "storage-key-canary", "signing-key-canary",
	}

	// Capture actual tool metadata, results, emitted events, and a durable session
	// snapshot through an ordinary engine run. The private route grant must not
	// cross any of these engine-facing boundaries.
	runtime, err := NewRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list", Description: "safe", Schema: json.RawMessage(`{"type":"object"}`)}}}, func(_ context.Context, _ session.SessionID, _ Route, _ json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("", "safe result"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	tools, err := runtime.OpenSession("parent")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })
	target := controlTarget{sessionID: "parent", backendID: "github"}
	runtime.mu.Lock()
	runtime.grants[target] = downstreamGrant{accessToken: canaries[1], refreshToken: canaries[2]}
	runtime.clientID = canaries[3]
	runtime.mu.Unlock()

	catalog := tool.NewCatalog()
	if err := catalog.Register(tools.Tools()[0]); err != nil {
		t.Fatalf("register broker tool: %v", err)
	}
	eng := agent.NewEngine(agent.Deps{
		LLM: mockllm.New(
			mockllm.ToolCallTurn(session.NewToolCall("call", "mcp__github__list", json.RawMessage(`{}`))),
			mockllm.TextTurn("done"),
		),
		Catalog: catalog,
		Model:   "test",
		Policy:  permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Allow}}, nil),
	})
	sess := session.New("parent", session.ModeDefault, "/workspace", session.Limits{}, time.Time{})
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/workspace"}, memfs.NewWorkspace("/workspace"), nil)
	var eventData []byte
	for event := range eng.Run(context.Background(), sess, env, agent.RunRequest{Text: "call the broker"}).Events() {
		encoded, marshalErr := json.Marshal(event)
		if marshalErr != nil {
			t.Fatalf("marshal event: %v", marshalErr)
		}
		eventData = append(eventData, encoded...)
	}
	metadata, err := json.Marshal(tools.Tools()[0].Spec())
	if err != nil {
		t.Fatalf("marshal tool metadata: %v", err)
	}
	snapshot, err := sessnap.Marshal(sess)
	if err != nil {
		t.Fatalf("marshal session snapshot: %v", err)
	}

	// Refresh against a test endpoint and retain only outbound metadata, never a
	// credential-bearing body or header value. The returned error and injected
	// diagnostic are captured exactly as an operator/client could observe them.
	var outboundMetadata string
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headerNames := make([]string, 0, len(r.Header))
		for name := range r.Header {
			headerNames = append(headerNames, name)
		}
		sort.Strings(headerNames)
		outboundMetadata = r.Method + " " + r.URL.Path + " " + strings.Join(headerNames, ",")
		http.Error(w, "rejected", http.StatusUnauthorized)
	}))
	t.Cleanup(tokenServer.Close)
	diagnostics := &capturingDiagnostics{}
	refreshRuntime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, "http://127.0.0.1:1/mcp")
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	refreshRuntime.tokenEndpoint = tokenServer.URL
	refreshRuntime.httpClient = tokenServer.Client()
	refreshRuntime.diagnostics = diagnostics
	if _, err := refreshRuntime.OpenSession("refresh"); err != nil {
		t.Fatalf("OpenSession(refresh): %v", err)
	}
	refreshTarget := controlTarget{sessionID: "refresh", backendID: "github"}
	refreshGrant := downstreamGrant{accessToken: canaries[1], refreshToken: canaries[2]}
	refreshRuntime.mu.Lock()
	refreshRuntime.grants[refreshTarget] = refreshGrant
	refreshRuntime.clientID = canaries[3]
	refreshRuntime.mu.Unlock()
	refreshErr := func() string {
		_, err := refreshRuntime.refreshDownstreamGrant(context.Background(), refreshTarget, refreshGrant)
		if err == nil {
			t.Fatal("terminal refresh unexpectedly succeeded")
		}
		return err.Error()
	}()

	// A real embedded ToolHive authorize response is browser-visible. Only its
	// opaque browser redirect is captured; no callback request body is retained.
	browserRuntime, browserClient, _ := newCallbackRuntime(t, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if _, err := browserRuntime.OpenSession("browser"); err != nil {
		t.Fatalf("OpenSession(browser): %v", err)
	}
	pending, err := browserRuntime.Connect(context.Background(), "browser", "github")
	if err != nil {
		t.Fatalf("Connect(browser): %v", err)
	}
	noRedirect := *browserClient
	noRedirect.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	browserResponse, err := noRedirect.Get(pending.AuthorizationRequired.BrowserURL)
	if err != nil {
		t.Fatalf("request embedded authorize endpoint: %v", err)
	}
	browserData := fmt.Sprintf("%d %s", browserResponse.StatusCode, browserResponse.Header.Get("Location"))
	_ = browserResponse.Body.Close()

	captures := map[string][]byte{
		"returned errors":   []byte(refreshErr),
		"diagnostics":       []byte(strings.Join(diagnostics.messages, "\n")),
		"tool metadata":     metadata,
		"tool results":      []byte(brokerToolResult(t, sess).Content),
		"session snapshot":  snapshot,
		"event data":        eventData,
		"browser response":  []byte(browserData),
		"outbound metadata": []byte(outboundMetadata),
	}
	for surface, captured := range captures {
		assertNoBrokerSecretCanary(t, surface, captured, canaries)
	}
}

func assertNoBrokerSecretCanary(t *testing.T, surface string, captured []byte, canaries []string) {
	t.Helper()
	for _, canary := range canaries {
		if bytes.Contains(captured, []byte(canary)) {
			t.Fatalf("%s contains a broker secret canary", surface)
		}
	}
}

func TestSessionVMCPBroker_Scenario3_UsesInjectedDiagnostics(t *testing.T) {
	const refreshCanary = "downstream-refresh-canary"
	diagnostics := &capturingDiagnostics{}
	runtime, err := NewStreamingHTTPRuntime([]Route{{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "github_list", Schema: json.RawMessage(`{"type":"object"}`)}}}, "http://127.0.0.1:1/mcp")
	if err != nil {
		t.Fatalf("NewStreamingHTTPRuntime: %v", err)
	}
	runtime.diagnostics = diagnostics
	tools, err := runtime.OpenSession("diagnostic-session")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	runtime.grants[controlTarget{sessionID: "diagnostic-session", backendID: "github"}] = downstreamGrant{accessToken: "downstream-access-canary", refreshToken: refreshCanary}
	_, _ = tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "github_list", json.RawMessage(`{}`)), tool.Environment{})
	if len(diagnostics.messages) != 1 || diagnostics.messages[0] != "broker transport bearer refresh failed" {
		t.Fatalf("diagnostics = %#v, want one bounded refresh failure", diagnostics.messages)
	}
	if strings.Contains(strings.Join(diagnostics.messages, "\n"), refreshCanary) {
		t.Fatal("refresh token escaped injected diagnostics")
	}
}

type capturingDiagnostics struct{ messages []string }

func (c *capturingDiagnostics) Log(_ context.Context, _ port.Level, message string, _ ...any) {
	c.messages = append(c.messages, message)
}

func (c *capturingDiagnostics) With(...any) port.Diagnostics { return c }

func TestSessionVMCPBroker_Scenario3_SecondOAuthBackendUnsupported(t *testing.T) {
	routes := []Route{
		{BackendID: "github", Protected: true, Tool: tool.ToolSpec{Name: "mcp__github__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "gitlab", Protected: true, Tool: tool.ToolSpec{Name: "mcp__gitlab__list", Schema: json.RawMessage(`{"type":"object"}`)}},
		{BackendID: "calendar", Tool: tool.ToolSpec{Name: "mcp__calendar__list", Schema: json.RawMessage(`{"type":"object"}`)}},
	}
	runtime, err := NewRuntime(routes, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.NewToolResult("", "anonymous result"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	tools, err := runtime.OpenSession("parent")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()
	if _, err := runtime.Connect(context.Background(), "parent", "gitlab"); !errors.Is(err, ErrUnsupportedCapability) {
		t.Fatalf("Connect second protected backend error = %v, want ErrUnsupportedCapability", err)
	}
	anonymous, err := toolsBySpecName(tools.Tools())["mcp__calendar__list"].Execute(context.Background(), session.NewToolCall("anonymous", "mcp__calendar__list", json.RawMessage(`{}`)), tool.Environment{})
	if err != nil || anonymous.IsError || anonymous.Content != "anonymous result" {
		t.Fatalf("anonymous route after rejected OAuth backend = %+v, %v", anonymous, err)
	}
}
