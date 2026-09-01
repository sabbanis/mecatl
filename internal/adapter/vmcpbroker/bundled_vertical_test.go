package vmcpbroker

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync/atomic"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical(t *testing.T) {
	const sessionID = session.SessionID("two-backend")
	githubOAuth := bundledOAuthServer(t, "github-token")
	calendarOAuth := bundledOAuthServer(t, "calendar-token")
	githubMCP, githubCalls := bundledProtectedMCP(t, "github-token", "issues", "github-safe")
	calendarMCP, calendarCalls := bundledProtectedMCP(t, "calendar-token", "events", "calendar-safe")

	profiles := []permconfig.MCPServerProfile{
		bundledProtectedProfile("GitHub_API", githubMCP.URL, githubOAuth.URL),
		bundledProtectedProfile("Calendar_API", calendarMCP.URL, calendarOAuth.URL),
	}
	profiles[0].Auth.OAuth.Tools = []permconfig.MCPStaticToolProfile{{
		Name: "static_override", Description: "configured static description",
		InputSchema: []byte(`{"type":"object","properties":{"static":{"type":"boolean"}}}`), ReadOnly: false,
	}}
	gateway := httptest.NewUnstartedServer(nil)
	issuer := "https://" + gateway.Listener.Addr().String()
	mux := http.NewServeMux()
	gateway.Config.Handler = mux
	gateway.StartTLS()
	t.Cleanup(gateway.Close)
	caPath := filepath.Join(t.TempDir(), "gateway-ca.pem")
	certificate := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: gateway.Certificate().Raw})
	if err := os.WriteFile(caPath, certificate, 0o600); err != nil {
		t.Fatalf("write gateway CA: %v", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(certificate) {
		t.Fatal("append gateway CA")
	}
	httpClient := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}}
	process, err := NewToolHiveProcess(t.Context(), profiles, issuer+brokerBasePath+"/callback", nil, WithHTTPClient(httpClient), withInsecureHTTPForTesting(), withCABundleForTesting(caPath))
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if err := process.Handlers.Mount(mux, brokerBasePath+"/callback"); err != nil {
		t.Fatalf("HandlerBundle.Mount: %v", err)
	}

	if got := process.Runtime.WorkspaceEnrollmentBackends(); !reflect.DeepEqual(got, []string{"GitHub_API", "Calendar_API"}) {
		t.Fatalf("ToolHive protected order = %v", got)
	}
	for backend, provider := range map[string]string{"GitHub_API": "github-api", "Calendar_API": "calendar-api"} {
		configured := process.discovery.backends.Get(t.Context(), backend)
		if configured == nil || configured.AuthConfig.UpstreamInject.ProviderName != provider || process.discovery.providerNames[backend] != provider {
			t.Fatalf("UpstreamInject.ProviderName for %s = %#v / %q, want %q", backend, configured, process.discovery.providerNames[backend], provider)
		}
	}

	opened, err := process.Runtime.OpenSession(sessionID)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })
	pending, err := process.Runtime.ConnectWorkspaceServices(t.Context(), sessionID)
	if err != nil || pending.Status != ConnectionPending || pending.ID == "" {
		t.Fatalf("ConnectWorkspaceServices pending = %+v, %v", pending, err)
	}
	if len(opened.Tools()) != 0 {
		t.Fatal("protected tool escaped before complete bundled admission")
	}
	code, state := completeBundledToolHiveAuthorization(t, httpClient, pending.BrowserURL)
	if err := process.Runtime.Callback(t.Context(), code, state); err != nil {
		t.Fatalf("Runtime.Callback: %v", err)
	}
	connected, err := process.Runtime.ConnectWorkspaceServices(t.Context(), sessionID)
	if err != nil || connected.Status != ConnectionConnected || !process.Runtime.ProtectedCatalogueReady(sessionID) {
		t.Fatalf("complete enrollment = %+v, %v, ready=%t", connected, err, process.Runtime.ProtectedCatalogueReady(sessionID))
	}
	if githubCalls.Load() == 0 || calendarCalls.Load() == 0 {
		t.Fatalf("real Aggregator.QueryCapabilities calls github/calendar = %d/%d, want each backend", githubCalls.Load(), calendarCalls.Load())
	}

	tools := opened.Tools()
	for _, backend := range []string{"GitHub_API", "Calendar_API"} {
		if grant, ok := process.Runtime.grant(sessionID, backend); !ok || grant.bearer() == "" {
			t.Fatalf("missing admitted grant for %s: %#v, %t", backend, grant, ok)
		}
	}
	names := []string{tools[0].Spec().Name, tools[1].Spec().Name}
	sort.Strings(names)
	if !reflect.DeepEqual(names, []string{"mcp__Calendar_API__events", "mcp__GitHub_API__issues"}) {
		t.Fatalf("atomic frozen catalogue = %v", names)
	}
	for _, wrapped := range tools {
		spec := wrapped.Spec()
		if spec.Description != "safe" || strings.Contains(string(spec.Schema), `"static"`) || !wrapped.ReadOnly() {
			t.Fatalf("authenticated discovery metadata was overridden by static configuration: spec=%+v read_only=%t", spec, wrapped.ReadOnly())
		}
		result, err := wrapped.Execute(t.Context(), session.NewToolCall(session.ToolCallID("call-"+spec.Name), spec.Name, json.RawMessage(`{}`)), tool.Environment{})
		if err != nil || result.IsError || (!strings.Contains(result.Content, "github-safe") && !strings.Contains(result.Content, "calendar-safe")) {
			t.Fatalf("safe admitted tool %q = %+v, %v", wrapped.Spec().Name, result, err)
		}
	}
	if githubCalls.Load() == 0 || calendarCalls.Load() == 0 {
		t.Fatalf("backend calls github/calendar = %d/%d, want both", githubCalls.Load(), calendarCalls.Load())
	}
}

func bundledOAuthServer(t *testing.T, token string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/authorize":
			http.Redirect(w, r, r.URL.Query().Get("redirect_uri")+"?code=code-"+token+"&state="+url.QueryEscape(r.URL.Query().Get("state")), http.StatusFound)
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"access_token":"`+token+`","token_type":"Bearer","sub":"subject"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func bundledProtectedMCP(t *testing.T, token, toolName, result string) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	calls := &atomic.Int32{}
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: toolName, Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: toolName, Description: "safe", Annotations: &mcpsdk.ToolAnnotations{ReadOnlyHint: true}}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: result}}}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		calls.Add(1)
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	return server, calls
}

func bundledProtectedProfile(name, mcpURL, oauthURL string) permconfig.MCPServerProfile {
	profile := protectedConstructionProfileWithURL(name, mcpURL)
	profile.Auth.OAuth.Upstream.OAuth2.AuthorizationEndpoint = oauthURL + "/authorize"
	profile.Auth.OAuth.Upstream.OAuth2.TokenEndpoint = oauthURL + "/token"
	return profile
}

func withCABundleForTesting(path string) ProcessOption {
	return func(options *processOptions) { options.caBundlePathForTesting = path }
}

func completeBundledToolHiveAuthorization(t *testing.T, client *http.Client, browserURL string) (string, string) {
	t.Helper()
	noRedirect := *client
	noRedirect.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	current := browserURL
	for range 16 {
		response, err := noRedirect.Get(current)
		if err != nil {
			t.Fatalf("ToolHive bundled authorization GET: %v", err)
		}
		_ = response.Body.Close()
		location := response.Header.Get("Location")
		if location == "" {
			t.Fatalf("ToolHive bundled authorization stopped at %s with status %d", current, response.StatusCode)
		}
		next, err := url.Parse(location)
		if err != nil {
			t.Fatalf("parse bundled redirect: %v", err)
		}
		if next.Path == brokerBasePath+"/callback" {
			if next.Query().Get("code") == "" || next.Query().Get("state") == "" {
				t.Fatal("final bundled callback omitted code/state")
			}
			return next.Query().Get("code"), next.Query().Get("state")
		}
		current = location
	}
	t.Fatal("ToolHive bundled authorization exceeded redirect bound")
	return "", ""
}
