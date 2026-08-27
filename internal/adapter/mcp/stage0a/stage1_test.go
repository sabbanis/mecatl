package stage0a_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stacklok/toolhive/pkg/vmcp"
	"github.com/stacklok/toolhive/pkg/vmcp/aggregator"
	vmcpauth "github.com/stacklok/toolhive/pkg/vmcp/auth"
	"github.com/stacklok/toolhive/pkg/vmcp/auth/strategies"
	vmcpclient "github.com/stacklok/toolhive/pkg/vmcp/client"
	vmcpconfig "github.com/stacklok/toolhive/pkg/vmcp/config"
	"github.com/stacklok/toolhive/pkg/vmcp/core"
	"github.com/stacklok/toolhive/pkg/vmcp/router"

	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestStaticMultiBackendCatalogue(t *testing.T) {
	ctx := context.Background()
	backends := []stage1Backend{
		{name: "calendar", tool: "list_events", description: "List calendar events.", delay: 30 * time.Millisecond},
		{name: "mail", tool: "search_mail", description: "Search mail.", delay: 10 * time.Millisecond},
		{name: "docs", tool: "search_docs", description: "Search documents.", delay: 20 * time.Millisecond},
	}
	for i := range backends {
		backends[i].start(t)
		defer backends[i].close()
	}

	first := catalogueFromSettings(ctx, t, []stage1Backend{backends[0], backends[1], backends[2]})
	backends[0].delay, backends[1].delay, backends[2].delay = 10*time.Millisecond, 30*time.Millisecond, 20*time.Millisecond
	second := catalogueFromSettings(ctx, t, []stage1Backend{backends[2], backends[1], backends[0]})
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("catalogue changed with source ordering: first=%#v second=%#v", first, second)
	}

	want := []tool.ToolSpec{
		stage1Spec(t, "calendar_list_events", "List calendar events."),
		stage1Spec(t, "docs_search_docs", "Search documents."),
		stage1Spec(t, "mail_search_mail", "Search mail."),
	}
	if !reflect.DeepEqual(first, want) {
		t.Fatalf("advertised specs = %#v, want %#v", first, want)
	}

	seen := make(map[string]int, len(first))
	for _, spec := range first {
		seen[spec.Name]++
	}
	for _, name := range []string{"calendar_list_events", "docs_search_docs", "mail_search_mail"} {
		if seen[name] != 1 {
			t.Fatalf("advertised tool %q appears %d times", name, seen[name])
		}
	}
}

func TestStage1SettingsRejectCaseCollidingServers(t *testing.T) {
	settings := []byte(`mcp:
  servers:
    - name: Calendar
      url: https://calendar.example.test/mcp
      auth: {mode: none}
    - name: calendar
      url: https://calendar-other.example.test/mcp
      auth: {mode: none}
`)
	if err := permconfig.ValidateYAML(settings); err == nil {
		t.Fatal("case-colliding mcp server names were accepted")
	}
}

type stage1Backend struct {
	name        string
	tool        string
	description string
	delay       time.Duration
	server      *httptest.Server
}

func (b *stage1Backend) start(t *testing.T) {
	t.Helper()
	remote := mcp.NewServer(&mcp.Implementation{Name: b.name, Version: "test"}, nil)
	mcp.AddTool(remote, &mcp.Tool{Name: b.tool, Description: b.description}, func(context.Context, *mcp.CallToolRequest, stage1ToolArgs) (*mcp.CallToolResult, struct{}, error) {
		return &mcp.CallToolResult{}, struct{}{}, nil
	})
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return remote }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	b.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(b.delay)
		handler.ServeHTTP(w, r)
	}))
}

func (b *stage1Backend) close() {
	b.server.CloseClientConnections()
	b.server.Close()
}

type stage1ToolArgs struct {
	Query string `json:"query" jsonschema:"The query to run"`
}

func catalogueFromSettings(ctx context.Context, t *testing.T, input []stage1Backend) []tool.ToolSpec {
	t.Helper()
	settingsPath := filepath.Join(t.TempDir(), "settings.yaml")
	settings := "mcp:\n  servers:\n"
	for _, backend := range input {
		settings += fmt.Sprintf("    - name: %s\n      url: %s\n      auth: {mode: none}\n", backend.name, backend.server.URL)
	}
	if err := permconfig.ValidateYAML([]byte(settings)); err != nil {
		t.Fatalf("ValidateYAML: %v", err)
	}
	if err := os.WriteFile(settingsPath, []byte(settings), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}
	section := permconfig.New(permconfig.Options{ExplicitFiles: []string{settingsPath}}).OperatorMCP()
	if section == nil || len(section.Servers) != len(input) {
		t.Fatalf("OperatorMCP = %#v", section)
	}

	static := make([]vmcpconfig.StaticBackendConfig, 0, len(section.Servers))
	for _, profile := range section.Servers {
		if profile.Auth.Mode != "none" {
			t.Fatalf("profile %q auth mode = %q, want none", profile.Name, profile.Auth.Mode)
		}
		static = append(static, vmcpconfig.StaticBackendConfig{Name: profile.Name, URL: profile.URL, Transport: "streamable-http", Type: "entry"})
	}
	discoverer := aggregator.NewUnifiedBackendDiscovererWithStaticBackends(static, nil, "stage1", nil)
	backends, err := discoverer.Discover(ctx, "stage1")
	if err != nil {
		t.Fatalf("discover static backends: %v", err)
	}
	if names := stage1BackendNames(backends); !reflect.DeepEqual(names, []string{"calendar", "docs", "mail"}) {
		t.Fatalf("discovered backend order = %v", names)
	}

	outgoing := vmcpauth.NewDefaultOutgoingAuthRegistry()
	if err := outgoing.RegisterStrategy("unauthenticated", strategies.NewUnauthenticatedStrategy()); err != nil {
		t.Fatalf("register unauthenticated strategy: %v", err)
	}
	backendClient, err := vmcpclient.NewHTTPBackendClient(outgoing)
	if err != nil {
		t.Fatalf("new backend client: %v", err)
	}
	conflicts, err := aggregator.NewConflictResolver(&vmcpconfig.AggregationConfig{ConflictResolution: vmcp.ConflictStrategyPrefix})
	if err != nil {
		t.Fatalf("new conflict resolver: %v", err)
	}
	catalogue, err := core.New(&core.Config{
		Aggregator:      aggregator.NewDefaultAggregator(backendClient, conflicts, nil, nil),
		Router:          router.NewSessionRouter(&vmcp.RoutingTable{}),
		BackendRegistry: vmcp.NewImmutableRegistry(backends),
		BackendClient:   backendClient,
	})
	if err != nil {
		t.Fatalf("new vMCP core: %v", err)
	}
	defer func() {
		if err := catalogue.Close(); err != nil {
			t.Errorf("close vMCP core: %v", err)
		}
	}()

	advertised, err := catalogue.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("vMCP core ListTools: %v", err)
	}
	return stage1NeutralSpecs(t, advertised)
}

func stage1BackendNames(backends []vmcp.Backend) []string {
	names := make([]string, 0, len(backends))
	for _, backend := range backends {
		names = append(names, backend.Name)
	}
	return names
}

func stage1NeutralSpecs(t *testing.T, advertised []vmcp.Tool) []tool.ToolSpec {
	t.Helper()
	specs := make([]tool.ToolSpec, 0, len(advertised))
	for _, remote := range advertised {
		schema, err := json.Marshal(remote.InputSchema)
		if err != nil {
			t.Fatalf("marshal %q input schema: %v", remote.Name, err)
		}
		specs = append(specs, tool.ToolSpec{Name: remote.Name, Description: remote.Description, Schema: schema})
	}
	return specs
}

func stage1Spec(t *testing.T, name, description string) tool.ToolSpec {
	t.Helper()
	schema, err := json.Marshal(map[string]any{
		"additionalProperties": false,
		"properties":           map[string]any{"query": map[string]any{"description": "The query to run", "type": "string"}},
		"required":             []string{"query"},
		"type":                 "object",
	})
	if err != nil {
		t.Fatal(err)
	}
	return tool.ToolSpec{Name: name, Description: description, Schema: schema}
}
