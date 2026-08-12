package agent_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// TestAuthorityAttenuation_RootCatalogAndDispatchEnforceCeiling pins both sides
// of the root ceiling: excluded tools are absent from the provider schema and a
// stale call to one is rejected before an otherwise allowing policy can execute it.
func TestAuthorityAttenuation_RootCatalogAndDispatchEnforceCeiling(t *testing.T) {
	var requests []string
	read := &fakeTool{name: "Read", readOnly: true, exec: func(_ context.Context, in session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		return session.NewToolResult(in.ID, "read"), nil
	}}
	var bashCalls int
	bash := &fakeTool{name: "Bash", readOnly: false, exec: func(_ context.Context, in session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		bashCalls++
		return session.NewToolResult(in.ID, "executed"), nil
	}}
	authority, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools: []string{"Read"}, Profile: governance.AuthorityProfile{FileSystem: true},
	})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	llm := mockllm.NewWith([]mockllm.Option{mockllm.WithRequestObserver(func(req port.LLMRequest) {
		for _, spec := range req.Tools {
			requests = append(requests, spec.Name)
		}
	})},
		mockllm.ToolCallTurn(toolCall("stale", "Bash", `{"command":"echo stale"}`)),
		mockllm.TextTurn("done"),
	)
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, read, bash), Clock: &fakeClock{}, Authority: authority})
	evs := drain(e.Run(context.Background(), newSession(t, session.Limits{}), memfs.NewWorkspace("/ws"), agent.RunRequest{Text: "go"}))
	for _, name := range requests {
		if name != "Read" {
			t.Fatalf("advertised tools = %v, want only Read", requests)
		}
	}
	if bashCalls != 0 {
		t.Fatalf("excluded Bash executed %d times", bashCalls)
	}
	foundStale := false
	for _, event := range evs {
		if event.Type == session.EvToolResult && event.ToolResult != nil && event.ToolResult.CallID == "stale" {
			foundStale = true
			if !strings.Contains(event.ToolResult.Content, "authority") {
				t.Fatalf("stale result = %q, want authority denial", event.ToolResult.Content)
			}
		}
	}
	if !foundStale {
		t.Fatal("missing stale authority-denial result")
	}
}

func TestAuthorityAttenuation_RootSnapshotsExistingCapabilitySurface(t *testing.T) {
	read := &fakeTool{name: "Read", readOnly: true, exec: func(_ context.Context, in session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		return session.NewToolResult(in.ID, "ok"), nil
	}}
	grep := &fakeTool{name: "Grep", readOnly: true, exec: func(_ context.Context, in session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		return session.NewToolResult(in.ID, "ok"), nil
	}}
	e := newEngine(agent.Deps{Catalog: catalogWith(t, grep, read), Delegates: []string{"reviewer"}, MaxDelegationDepth: 2, Profile: governance.AuthorityProfile{FileSystem: true, Isolated: true}})
	bound, err := e.RootAuthority()
	if err != nil {
		t.Fatalf("RootAuthority: %v", err)
	}
	want := `{"v":1,"kind":"restricted","tools":["Grep","Read"],"delegates":["reviewer"],"depth":2,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	if bound != want {
		t.Fatalf("root authority = %s, want %s", bound, want)
	}
}

func TestAuthorityAttenuation_RootAuthorityRoundTripsWithoutSensitiveMaterial(t *testing.T) {
	read := &fakeTool{name: "Read", readOnly: true, exec: func(_ context.Context, in session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		return session.NewToolResult(in.ID, "ok"), nil
	}}
	e := newEngine(agent.Deps{Catalog: catalogWith(t, read), Delegates: []string{"reviewer"}, Profile: governance.AuthorityProfile{FileSystem: true}})
	bound, err := e.RootAuthority()
	if err != nil {
		t.Fatalf("RootAuthority: %v", err)
	}
	s := newSession(t, session.Limits{})
	if err := s.BindAuthority(bound, "root"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	snap, err := sessnap.Of(s)
	if err != nil {
		t.Fatalf("sessnap.Of: %v", err)
	}
	restored, err := snap.Restore()
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	got, identity, legacy := restored.AuthorityBound()
	if got != bound || identity != "root" || legacy {
		t.Fatalf("restored authority = (%q, %q, legacy=%t)", got, identity, legacy)
	}
	for _, forbidden := range []string{"token", "secret", "credential", "header", "/"} {
		if strings.Contains(strings.ToLower(got), forbidden) || strings.Contains(strings.ToLower(identity), forbidden) {
			t.Fatalf("safe projection contains %q: authority=%q identity=%q", forbidden, got, identity)
		}
	}
}
