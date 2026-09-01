package vmcpbroker

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"go.uber.org/goleak"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestBundledWorkspaceEnrollment_Scenario11_MultiUpstreamConstruction(t *testing.T) {
	profiles := []permconfig.MCPServerProfile{
		protectedConstructionProfile("GitHub_Cloud"),
		{Name: "public", URL: "https://public.example/mcp", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		protectedConstructionProfile("Calendar_API"),
	}

	construction, err := newProtectedToolHiveConstruction(profiles, "https://broker.example/v1/mcp/broker", processOptions{})
	if err != nil {
		t.Fatalf("newProtectedToolHiveConstruction: %v", err)
	}
	if len(construction.upstreams) != 2 {
		t.Fatalf("upstreams = %d, want one per protected profile", len(construction.upstreams))
	}
	// ToolHive treats the first upstream as the bundle identity anchor, so this
	// order must remain the operator's configured protected-profile order.
	if got := construction.upstreams[0].Name + "," + construction.upstreams[1].Name; got != "github-cloud,calendar-api" {
		t.Fatalf("upstream order = %q, want configured protected order", got)
	}
	if got := strings.Join(construction.protectedBackends, ","); got != "GitHub_Cloud,Calendar_API" {
		t.Fatalf("protected backend order = %q, want configured protected order", got)
	}

	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{profiles[0], profiles[2]}, "https://broker.example/callback", nil)
	if err != nil {
		t.Fatalf("NewToolHiveProcess with bundled upstreams: %v", err)
	}
	if got := strings.Join(process.Runtime.protectedBackends, ","); got != "GitHub_Cloud,Calendar_API" {
		t.Fatalf("running protected backend order = %q, want configured protected order", got)
	}
	if !process.Runtime.WorkspaceEnrollmentRequired() {
		t.Fatal("bundled protected process did not require workspace enrollment")
	}
	if len(process.Runtime.routes) != 0 {
		t.Fatalf("protected profiles produced startup routes: executable=%#v", process.Runtime.routes)
	}
	if process.discovery == nil || process.discovery.capabilities == nil || process.discovery.tokens == nil || process.discovery.backends.Count() != 2 {
		t.Fatal("constructed process discarded ToolHive discovery authority")
	}
	if process.discovery.providerNames["GitHub_Cloud"] != "github-cloud" || process.discovery.providerNames["Calendar_API"] != "calendar-api" {
		t.Fatalf("retained provider mapping = %#v", process.discovery.providerNames)
	}
	if err := process.Close(); err != nil {
		t.Fatalf("Process.Close: %v", err)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_ProviderNameMapping(t *testing.T) {
	profiles := []permconfig.MCPServerProfile{protectedConstructionProfile("GitHub_API"), protectedConstructionProfile("Calendar")}
	construction, err := newProtectedToolHiveConstruction(profiles, "https://broker.example/v1/mcp/broker", processOptions{})
	if err != nil {
		t.Fatalf("newProtectedToolHiveConstruction: %v", err)
	}
	providerPattern := regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
	wantProviders := map[string]string{"GitHub_API": "github-api", "Calendar": "calendar"}
	upstreamClient := make(map[string]string, len(construction.upstreams))
	for _, upstream := range construction.upstreams {
		upstreamClient[upstream.Name] = upstream.OAuth2Config.ClientID
	}
	for _, backend := range construction.backends {
		want, protected := wantProviders[backend.ID]
		if !protected {
			continue
		}
		if backend.Name != backend.ID {
			t.Fatalf("backend %q model-visible name changed to %q", backend.ID, backend.Name)
		}
		got := backend.AuthConfig.UpstreamInject.ProviderName
		if got != want || !providerPattern.MatchString(got) {
			t.Fatalf("backend %q provider = %q, want DNS label %q", backend.ID, got, want)
		}
		if clientID := upstreamClient[got]; clientID != backend.ID+"-client" {
			t.Fatalf("backend %q injects provider %q for client %q", backend.ID, got, clientID)
		}
	}
	if construction.backends[0].AuthConfig.UpstreamInject.ProviderName == construction.backends[1].AuthConfig.UpstreamInject.ProviderName {
		t.Fatal("protected backends share a provider token injection key")
	}

	_, err = newProtectedToolHiveConstruction([]permconfig.MCPServerProfile{protectedConstructionProfile("Name"), protectedConstructionProfile("Name_")}, "https://broker.example/v1/mcp/broker", processOptions{})
	if !errors.Is(err, ErrInvalidRoute) {
		t.Fatalf("provider-name collision error = %v, want ErrInvalidRoute", err)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_ProtectedStartupSkipsAnonymousDiscovery(t *testing.T) {
	var publicRequests, protectedRequests atomic.Int32
	public := discoveryTestServer(t, "public", &publicRequests)
	protected := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		protectedRequests.Add(1)
		http.Error(w, "authorization required", http.StatusUnauthorized)
	}))
	t.Cleanup(protected.Close)
	profile := protectedConstructionProfileWithURL("GitHub_API", protected.URL)

	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{
		{Name: "public", URL: public.URL, Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		profile,
	}, "https://broker.example/callback", nil)
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if publicRequests.Load() == 0 {
		t.Fatal("anonymous profile was not eagerly discovered")
	}
	if protectedRequests.Load() != 0 {
		t.Fatalf("protected startup requests = %d, want exactly zero", protectedRequests.Load())
	}
	if len(process.Runtime.routes) != 1 || process.Runtime.routes[0].BackendID != "public" {
		t.Fatalf("startup executable routes = %#v, want anonymous route only", process.Runtime.routes)
	}
	if got := strings.Join(process.Runtime.protectedBackends, ","); got != "GitHub_API" {
		t.Fatalf("stable enrollment-provider order = %q, want GitHub_API", got)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_StaticCandidatesStayConfigurationOnly(t *testing.T) {
	var publicRequests, protectedRequests atomic.Int32
	public := discoveryTestServer(t, "public", &publicRequests)
	protected := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		protectedRequests.Add(1)
		http.Error(w, "authorization required", http.StatusUnauthorized)
	}))
	t.Cleanup(protected.Close)
	profile := protectedConstructionProfileWithURL("GitHub_API", protected.URL)
	profile.Auth.OAuth.Tools = []permconfig.MCPStaticToolProfile{{Name: "reviewed", Description: "reviewed static candidate", InputSchema: []byte(`{"type":"object"}`), ReadOnly: true}}

	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{
		{Name: "public", URL: public.URL, Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		profile,
	}, "https://broker.example/callback", nil)
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if publicRequests.Load() == 0 || protectedRequests.Load() != 0 {
		t.Fatalf("anonymous/protected startup requests = %d/%d, want anonymous eager and protected zero", publicRequests.Load(), protectedRequests.Load())
	}
	if len(process.Runtime.routes) != 1 || process.Runtime.routes[0].BackendID != "public" {
		t.Fatalf("static candidate entered runtime catalogue: %#v", process.Runtime.routes)
	}
	if process.Runtime.authenticatedQuery == nil {
		t.Fatal("static candidate replaced authenticated discovery")
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_AuthContextStopsOnProcessClose(t *testing.T) {
	defer goleak.VerifyNone(t)

	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{protectedConstructionProfile("GitHub_API")}, "https://broker.example/callback", nil)
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	if process.Runtime.authContext == nil {
		t.Fatal("protected process did not retain its owned auth context")
	}
	processClosed := make(chan error, 1)
	go func() { processClosed <- process.Close() }()
	select {
	case err := <-processClosed:
		if err != nil {
			t.Fatalf("Process.Close: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Process.Close did not complete within lifecycle bound")
	}
	select {
	case <-process.Runtime.authContext.Done():
	case <-time.After(time.Second):
		t.Fatal("constructed process auth context remained live after close")
	}

	runtime := newLifecycleRuntime(t, nil)
	authCtx, cancelAuth := context.WithCancel(context.Background())
	var order []string
	installToolHiveProcessClosers(runtime,
		func() error { order = append(order, "vmcp"); return nil },
		func() error { order = append(order, "authserver"); return nil },
		func() { order = append(order, "auth-context"); cancelAuth() },
	)
	closed := make(chan error, 1)
	go func() { closed <- runtime.Close() }()
	select {
	case err := <-closed:
		if err != nil {
			t.Fatalf("Runtime.Close: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Runtime.Close did not complete within lifecycle bound")
	}
	select {
	case <-authCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("process auth context remained live after close")
	}
	if got := strings.Join(order, ","); got != "vmcp,authserver,auth-context" {
		t.Fatalf("close order = %q, want vmcp,authserver,auth-context", got)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_AnonymousCompatibility(t *testing.T) {
	var requests atomic.Int32
	server := discoveryTestServer(t, "status", &requests)
	routes, err := discoverAnonymousRoutes(t.Context(), []permconfig.MCPServerProfile{{Name: "Public_API", URL: server.URL, Auth: permconfig.MCPAuthProfile{Mode: "none"}}}, nil)
	if err != nil {
		t.Fatalf("discoverAnonymousRoutes: %v", err)
	}
	if requests.Load() == 0 || len(routes) != 1 || routes[0].Tool.Name != "mcp__Public_API__status" {
		t.Fatalf("anonymous discovery requests/routes = %d/%#v", requests.Load(), routes)
	}
}

func protectedConstructionProfile(name string) permconfig.MCPServerProfile {
	return protectedConstructionProfileWithURL(name, "https://"+strings.ToLower(strings.Trim(name, "_"))+".example/mcp")
}

func protectedConstructionProfileWithURL(name, rawURL string) permconfig.MCPServerProfile {
	return permconfig.MCPServerProfile{Name: name, URL: rawURL, Auth: permconfig.MCPAuthProfile{Mode: profileAuthOAuth, OAuth: &permconfig.MCPOAuthProfile{
		Upstream: &permconfig.MCPOAuthUpstreamProfile{Mode: "oauth2", OAuth2: &permconfig.MCPOAuth2UpstreamProfile{
			AuthorizationEndpoint: "https://issuer.example/authorize", TokenEndpoint: "https://issuer.example/token",
		}},
		Scopes: []string{"openid"},
		Client: permconfig.MCPOAuthClientProfile{Mode: "preregistered", Preregistered: &permconfig.MCPPreregisteredClientProfile{ID: name + "-client"}},
	}}}
}

func discoveryTestServer(t *testing.T, toolName string, requests *atomic.Int32) *httptest.Server {
	t.Helper()
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: toolName, Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: toolName}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{}, struct{}{}, nil
	})
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	return server
}
