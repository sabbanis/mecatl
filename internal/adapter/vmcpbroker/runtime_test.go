package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestCompileProfiles_DerivesProtectedRoutesFromSupportedAuthModes(t *testing.T) {
	t.Parallel()

	routes, err := CompileProfiles([]permconfig.MCPServerProfile{
		{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
		{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}},
	}, []ToolDefinition{
		{BackendID: "github", Name: "mcp__github__list_issues", Schema: json.RawMessage(`{"type":"object"}`)},
		{BackendID: "calendar", Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
	})
	if err != nil {
		t.Fatalf("CompileProfiles: %v", err)
	}
	if len(routes) != 2 {
		t.Fatalf("routes = %d, want 2", len(routes))
	}
	if routes[0].Tool.Name != "mcp__calendar__list_events" || routes[0].Protected {
		t.Fatalf("calendar route = %+v, want unprotected auth:none route", routes[0])
	}
	if routes[1].Tool.Name != "mcp__github__list_issues" || !routes[1].Protected {
		t.Fatalf("github route = %+v, want protected auth:oauth route", routes[1])
	}
}

func TestCompileProfiles_RejectsUnsupportedOrAmbiguousProfiles(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		profiles   []permconfig.MCPServerProfile
		discovered []ToolDefinition
	}{
		{
			name:     "static bearer",
			profiles: []permconfig.MCPServerProfile{{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "static_bearer"}}},
		},
		{
			name:     "unknown auth mode",
			profiles: []permconfig.MCPServerProfile{{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "custom"}}},
		},
		{
			name: "duplicate profile names ignore case",
			profiles: []permconfig.MCPServerProfile{
				{Name: "github", Auth: permconfig.MCPAuthProfile{Mode: "none"}},
				{Name: "GitHub", Auth: permconfig.MCPAuthProfile{Mode: "oauth"}},
			},
		},
		{
			name:     "empty profile name",
			profiles: []permconfig.MCPServerProfile{{Auth: permconfig.MCPAuthProfile{Mode: "none"}}},
		},
		{
			name:       "discovered unconfigured backend",
			profiles:   []permconfig.MCPServerProfile{{Name: "calendar", Auth: permconfig.MCPAuthProfile{Mode: "none"}}},
			discovered: []ToolDefinition{{BackendID: "github", Name: "mcp__github__list_issues"}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := CompileProfiles(test.profiles, test.discovered); !errors.Is(err, ErrInvalidRoute) {
				t.Fatalf("CompileProfiles error = %v, want ErrInvalidRoute", err)
			}
		})
	}
}

func TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession(t *testing.T) {
	t.Parallel()

	var opened session.SessionID
	runtime, err := NewRuntime([]Route{{
		BackendID: "calendar-private-route",
		Tool:      tool.ToolSpec{Name: "mcp__calendar__list_events", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(_ context.Context, id session.SessionID, _ Route, _ json.RawMessage) (session.ToolResult, error) {
		opened = id
		return session.NewToolResult("call", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer func() { _ = runtime.Close() }()

	const reservedID = session.SessionID("canonical-session-id")
	tools, err := runtime.OpenSession(reservedID)
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()

	_, err = tools.Tools()[0].Execute(context.Background(), session.NewToolCall("call", "mcp__calendar__list_events", []byte(`{}`)), tool.Environment{})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if opened != reservedID {
		t.Fatalf("broker opened session %q, want reserved canonical id %q", opened, reservedID)
	}
}

func TestInvariant_vmcp_broker_route_is_not_model_input(t *testing.T) {
	t.Parallel()

	const (
		backendID = "github-private-backend-id"
		bearer    = "Bearer broker-secret"
		locator   = "toolhive://private-locator"
		oauth     = "oauth-state-private"
	)
	var receivedArgs json.RawMessage
	runtime, err := NewRuntime([]Route{{
		BackendID: backendID,
		Tool: tool.ToolSpec{
			Name:        "mcp__github__list_issues",
			Description: "List repository issues.",
			Schema:      json.RawMessage(`{"type":"object","properties":{"repo":{"type":"string"}}}`),
		},
	}}, func(_ context.Context, _ session.SessionID, _ Route, args json.RawMessage) (session.ToolResult, error) {
		receivedArgs = append(receivedArgs[:0], args...)
		return session.NewToolResult("call", "ordinary result"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer func() { _ = runtime.Close() }()

	tools, err := runtime.OpenSession("session-1")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	defer func() { _ = tools.Close() }()

	wrapped := tools.Tools()[0]
	call := session.NewToolCall("call", wrapped.Spec().Name, []byte(`{"repo":"stacklok/mecatl"}`))
	result, err := wrapped.Execute(context.Background(), call, tool.Environment{})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if string(receivedArgs) != string(call.Args) {
		t.Fatalf("backend arguments = %s, want only declared call arguments %s", receivedArgs, call.Args)
	}

	modelFacing := string(wrapped.Spec().Schema) + wrapped.Spec().Description + result.Content
	for _, forbidden := range []string{backendID, bearer, locator, oauth} {
		if strings.Contains(modelFacing, forbidden) {
			t.Errorf("model-facing wrapper data exposes %q: %q", forbidden, modelFacing)
		}
	}
}
