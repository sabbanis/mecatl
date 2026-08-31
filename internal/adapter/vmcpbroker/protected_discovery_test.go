package vmcpbroker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestSessionMCPAuthorization_Scenario2_ProtectedDiscoveryWaitsForEnrollment(t *testing.T) {
	var upstreamRequests atomic.Int32
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "protected", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "list"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{}, struct{}{}, nil
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Fatal("route discovery unexpectedly began an upstream authorization journey")
		}
		upstreamRequests.Add(1)
		mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true}).ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	profile := permconfig.MCPServerProfile{Name: "protected", URL: server.URL, Auth: permconfig.MCPAuthProfile{Mode: "oauth", OAuth: &permconfig.MCPOAuthProfile{
		Issuer: "https://issuer.invalid", Scopes: []string{"openid"}, Tools: []permconfig.MCPStaticToolProfile{{Name: "declared", InputSchema: []byte(`{"type":"object"}`)}},
		Client: permconfig.MCPOAuthClientProfile{Mode: "preregistered", Preregistered: &permconfig.MCPPreregisteredClientProfile{ID: "client"}},
	}}}
	routes, err := discoverRoutes(t.Context(), []permconfig.MCPServerProfile{profile}, nil)
	if err != nil {
		t.Fatalf("discoverRoutes: %v", err)
	}
	if upstreamRequests.Load() != 0 || len(routes) != 0 {
		t.Fatalf("pre-enrollment discovery/routes = %d/%#v, want none", upstreamRequests.Load(), routes)
	}
}
