package app_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

func TestSessionMCPAuthorization_Scenario2_ConfigDrivenAnonymousBrokerConstruction(t *testing.T) {
	upstream := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "anonymous", Version: "test"}, nil)
	mcpsdk.AddTool(upstream, &mcpsdk.Tool{Name: "status"}, func(context.Context, *mcpsdk.CallToolRequest, struct{}) (*mcpsdk.CallToolResult, struct{}, error) {
		return &mcpsdk.CallToolResult{}, struct{}{}, nil
	})
	server := httptest.NewServer(mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return upstream }, &mcpsdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true}))
	t.Cleanup(server.Close)
	settings := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(settings, []byte("mcp:\n  mode: broker\n  servers:\n    - name: public\n      url: "+server.URL+"\n      auth: {mode: none}\n"), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	built, err := app.Build(t.Context(), app.Config{
		Workspace: t.TempDir(), UseMock: true, PermissionConfigs: []string{settings},
		MCPAuthorityLoader:  cliconfig.NewMCPProfileResolver(nil, func(string) (string, bool) { return "", false }),
		MCPAuthorityDefault: string(cliconfig.MCPAuthorityGlobal), MCPBrokerSupported: true,
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(built.Close)
	if built.VMCPBroker == nil || built.VMCPBrokerHandlers.VMCP == nil {
		t.Fatal("config-driven anonymous broker was not constructed with a vMCP handler")
	}
}
