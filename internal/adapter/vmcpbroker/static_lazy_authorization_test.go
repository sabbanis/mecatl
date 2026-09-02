package vmcpbroker

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

// newStaticGateway builds the TLS embedded-broker issuer plus a trusting HTTP
// client, mirroring TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical's setup.
func newStaticGateway(t *testing.T) (*httptest.Server, *http.ServeMux, *http.Client) {
	t.Helper()
	gateway := httptest.NewUnstartedServer(nil)
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
	return gateway, mux, httpClient
}

func staticDeclaredTool(name string) permconfig.MCPStaticToolProfile {
	return permconfig.MCPStaticToolProfile{Name: name, Description: "static", InputSchema: []byte(`{"type":"object"}`), ReadOnly: true}
}

func findTool(tools []tool.Tool, name string) tool.Tool {
	for _, wrapped := range tools {
		if wrapped.Spec().Name == name {
			return wrapped
		}
	}
	return nil
}

// TestStaticProtectedBackend_RequestAuthorizationParksAndResumes proves a
// never-connected static-declared protected backend parks on the model's
// first real call to it -- the same per-call trigger a regressed eager grant
// uses today -- rather than requiring eager bundled enrollment up front.
func TestStaticProtectedBackend_RequestAuthorizationParksAndResumes(t *testing.T) {
	const sessionID = session.SessionID("static-single")
	oauth := bundledOAuthServer(t, "static-token")
	mcpServer, calls := bundledProtectedMCP(t, "static-token", "protected_call", "static-safe")
	profile := bundledProtectedProfile("Static_API", mcpServer.URL, oauth.URL)
	profile.Auth.OAuth.Tools = []permconfig.MCPStaticToolProfile{staticDeclaredTool("protected_call")}

	gateway, mux, httpClient := newStaticGateway(t)
	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{profile},
		"https://"+gateway.Listener.Addr().String()+brokerBasePath+"/callback", nil,
		WithHTTPClient(httpClient), withInsecureHTTPForTesting())
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if err := process.Handlers.Mount(mux, brokerBasePath+"/callback"); err != nil {
		t.Fatalf("HandlerBundle.Mount: %v", err)
	}
	if process.Runtime.WorkspaceEnrollmentRequired() {
		t.Fatal("an all-static protected backend must not require eager bundled enrollment")
	}

	opened, err := process.Runtime.OpenSession(sessionID)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })
	protectedTool := findTool(opened.Tools(), "mcp__Static_API__protected_call")
	if protectedTool == nil {
		t.Fatal("static tool did not enter the session catalogue")
	}
	requester, ok := protectedTool.(tool.AuthorizationRequester)
	if !ok {
		t.Fatal("static protected tool does not implement AuthorizationRequester")
	}

	// A never-granted static backend parks exactly like a regressed grant.
	request, required, err := requester.RequestAuthorization(t.Context())
	if err != nil || !required || request.ID == "" {
		t.Fatalf("RequestAuthorization = %+v, required=%t, err=%v", request, required, err)
	}
	status, err := process.Runtime.CheckAuthorization(t.Context(), sessionID, request.RouteID, request.ID)
	if err != nil || status.Status != ConnectionPending || status.BrowserURL == "" {
		t.Fatalf("CheckAuthorization pending = %+v, %v", status, err)
	}

	code, state := completeBundledToolHiveAuthorization(t, httpClient, status.BrowserURL)
	if err := process.Runtime.Callback(t.Context(), code, state); err != nil {
		t.Fatalf("Runtime.Callback: %v", err)
	}

	// The resumed call now completes as an ordinary safe protected call.
	requestAgain, requiredAgain, err := requester.RequestAuthorization(t.Context())
	if err != nil || requiredAgain || requestAgain.ID != "" {
		t.Fatalf("post-grant RequestAuthorization = %+v, required=%t, err=%v", requestAgain, requiredAgain, err)
	}
	result, err := protectedTool.Execute(t.Context(), session.NewToolCall("call-1", protectedTool.Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
	if err != nil || result.IsError || calls.Load() == 0 {
		t.Fatalf("resumed static call = %+v, %v, calls=%d", result, err, calls.Load())
	}
}

// TestStaticProtectedBackend_TwoBackendsLazyTriggerBundlesBoth proves the
// multi-backend fix: the model's first call to the SECOND declared static
// backend still triggers a connect that grants BOTH statically-declared
// backends together (bundle atomicity), and CancelAuthorization from that
// same non-anchor backend finds and cancels the shared transaction.
func TestStaticProtectedBackend_TwoBackendsLazyTriggerBundlesBoth(t *testing.T) {
	alphaOAuth := bundledOAuthServer(t, "alpha-token")
	betaOAuth := bundledOAuthServer(t, "beta-token")
	alphaMCP, alphaCalls := bundledProtectedMCP(t, "alpha-token", "alpha_call", "alpha-safe")
	betaMCP, betaCalls := bundledProtectedMCP(t, "beta-token", "beta_call", "beta-safe")

	alpha := bundledProtectedProfile("Alpha_API", alphaMCP.URL, alphaOAuth.URL)
	alpha.Auth.OAuth.Tools = []permconfig.MCPStaticToolProfile{staticDeclaredTool("alpha_call")}
	beta := bundledProtectedProfile("Beta_API", betaMCP.URL, betaOAuth.URL)
	beta.Auth.OAuth.Tools = []permconfig.MCPStaticToolProfile{staticDeclaredTool("beta_call")}

	gateway, mux, httpClient := newStaticGateway(t)
	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{alpha, beta},
		"https://"+gateway.Listener.Addr().String()+brokerBasePath+"/callback", nil,
		WithHTTPClient(httpClient), withInsecureHTTPForTesting())
	if err != nil {
		t.Fatalf("NewToolHiveProcess: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if err := process.Handlers.Mount(mux, brokerBasePath+"/callback"); err != nil {
		t.Fatalf("HandlerBundle.Mount: %v", err)
	}
	if process.Runtime.WorkspaceEnrollmentRequired() {
		t.Fatal("an all-static protected bundle must not require eager bundled enrollment")
	}

	// --- CancelAuthorization from the non-anchor (Beta) backend. ---
	const cancelSession = session.SessionID("static-two-cancel")
	openedForCancel, err := process.Runtime.OpenSession(cancelSession)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = openedForCancel.Close() })
	betaTool := findTool(openedForCancel.Tools(), "mcp__Beta_API__beta_call")
	if betaTool == nil {
		t.Fatal("beta static tool did not enter the session catalogue")
	}
	betaRequester := betaTool.(tool.AuthorizationRequester)
	request, required, err := betaRequester.RequestAuthorization(t.Context())
	if err != nil || !required || request.ID == "" {
		t.Fatalf("Beta RequestAuthorization = %+v, required=%t, err=%v", request, required, err)
	}
	if err := betaRequester.CancelAuthorization(t.Context(), request.ID); err != nil {
		t.Fatalf("CancelAuthorization from non-anchor backend: %v", err)
	}
	if status, err := process.Runtime.CheckAuthorization(t.Context(), cancelSession, request.RouteID, request.ID); err == nil {
		t.Fatalf("cancelled transaction still resolvable: %+v", status)
	}

	// --- The real lazy-trigger-bundles-both proof, on a fresh session. ---
	const sessionID = session.SessionID("static-two-bundle")
	opened, err := process.Runtime.OpenSession(sessionID)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })
	tools := opened.Tools()
	betaTool = findTool(tools, "mcp__Beta_API__beta_call")
	alphaTool := findTool(tools, "mcp__Alpha_API__alpha_call")
	if betaTool == nil || alphaTool == nil {
		t.Fatalf("static bundle did not enter the session catalogue: %#v", tools)
	}
	betaRequester = betaTool.(tool.AuthorizationRequester)
	request, required, err = betaRequester.RequestAuthorization(t.Context())
	if err != nil || !required || request.ID == "" {
		t.Fatalf("Beta RequestAuthorization = %+v, required=%t, err=%v", request, required, err)
	}
	status, err := process.Runtime.CheckAuthorization(t.Context(), sessionID, request.RouteID, request.ID)
	if err != nil || status.Status != ConnectionPending || status.BrowserURL == "" {
		t.Fatalf("CheckAuthorization pending = %+v, %v", status, err)
	}
	code, state := completeBundledToolHiveAuthorization(t, httpClient, status.BrowserURL)
	if err := process.Runtime.Callback(t.Context(), code, state); err != nil {
		t.Fatalf("Runtime.Callback: %v", err)
	}

	for _, backend := range []string{"Alpha_API", "Beta_API"} {
		if grant, ok := process.Runtime.grant(sessionID, backend); !ok || grant.bearer() == "" {
			t.Fatalf("lazy trigger on Beta did not bundle-grant %s: %#v, %t", backend, grant, ok)
		}
	}

	names := make([]string, 0, 2)
	for _, wrapped := range []tool.Tool{alphaTool, betaTool} {
		result, err := wrapped.Execute(t.Context(), session.NewToolCall(session.ToolCallID("call-"+wrapped.Spec().Name), wrapped.Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
		if err != nil || result.IsError {
			t.Fatalf("bundled static call %q = %+v, %v", wrapped.Spec().Name, result, err)
		}
		names = append(names, wrapped.Spec().Name)
	}
	sort.Strings(names)
	if !reflect.DeepEqual(names, []string{"mcp__Alpha_API__alpha_call", "mcp__Beta_API__beta_call"}) {
		t.Fatalf("executed tools = %v", names)
	}
	if alphaCalls.Load() == 0 || betaCalls.Load() == 0 {
		t.Fatalf("backend calls alpha/beta = %d/%d, want both", alphaCalls.Load(), betaCalls.Load())
	}
}
