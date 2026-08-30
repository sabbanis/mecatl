package vmcpbroker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestSessionMCPAuthorization_Scenario2_AnonymousProfileServesVMCP(t *testing.T) {
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "anonymous", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "status", Description: "reports status"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "anonymous upstream result"}}}, struct{}{}, nil
	})
	upstreamServer := httptest.NewServer(mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true}))
	t.Cleanup(upstreamServer.Close)

	process, err := NewToolHiveProcess(t.Context(), []permconfig.MCPServerProfile{{Name: "public", URL: upstreamServer.URL, Auth: permconfig.MCPAuthProfile{Mode: "none"}}}, "", nil)
	if err != nil {
		t.Fatalf("NewToolHiveProcess anonymous: %v", err)
	}
	t.Cleanup(func() { _ = process.Close() })
	if process.Runtime == nil || process.Handlers.VMCP == nil {
		t.Fatal("anonymous profile constructed an inert broker process")
	}
	tools, err := process.Runtime.OpenSession("anonymous-runtime")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = tools.Close() })
	result, err := tools.Tools()[0].Execute(t.Context(), session.NewToolCall("anonymous-call", tools.Tools()[0].Spec().Name, json.RawMessage(`{}`)), tool.Environment{})
	if err != nil || result.IsError || !strings.Contains(result.Content, "anonymous upstream result") {
		t.Fatalf("anonymous wrapper result = %#v, %v", result, err)
	}

	mux := http.NewServeMux()
	if err := process.Handlers.Mount(mux, ""); err != nil {
		t.Fatalf("Mount anonymous handlers: %v", err)
	}
	broker := httptest.NewServer(mux)
	t.Cleanup(broker.Close)
	connected, err := mcp.Connect(t.Context(), mcp.ServerConfig{Name: "broker", URL: broker.URL + brokerMCPPath}, nil)
	if err != nil {
		t.Fatalf("connect anonymous vMCP: %v", err)
	}
	t.Cleanup(func() { _ = connected.Close() })
	if len(connected.Tools()) != 1 {
		t.Fatalf("anonymous vMCP tools = %d, want discovered upstream tool", len(connected.Tools()))
	}
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, brokerMCPPath, nil))
	if response.Code == http.StatusNotFound {
		t.Fatal("anonymous broker vMCP route was not registered")
	}
}

func withInsecureHTTPForTesting() ProcessOption {
	return func(options *processOptions) { options.insecureAllowHTTPForTesting = true }
}

func TestInvariant_loopback_issuer_keeps_http_disallowed_by_default(t *testing.T) {
	profile := permconfig.MCPServerProfile{Auth: permconfig.MCPAuthProfile{OAuth: &permconfig.MCPOAuthProfile{Issuer: "http://127.0.0.1:8080"}}}

	if got := newOIDCUpstreamConfig(profile, "https://broker.example/v1/mcp/broker", processOptions{}).InsecureAllowHTTP; got {
		t.Fatal("a loopback HTTP issuer enabled insecure HTTP without an explicit test-only opt-in")
	}

	options := processOptions{}
	withInsecureHTTPForTesting()(&options)
	if got := newOIDCUpstreamConfig(profile, "https://broker.example/v1/mcp/broker", options).InsecureAllowHTTP; !got {
		t.Fatal("explicit test-only plaintext issuer opt-in did not enable insecure HTTP")
	}
}
