package app

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/session"
)

// TestADR_0228_AuthorityEvaluator_VerticalSlice exercises the ordinary Build →
// Service path with an explicit specialist. Unit tests pin the remaining
// dispatch permutations; this slice proves the composed labels reach a child.
func TestADR_0228_AuthorityEvaluator_VerticalSlice(t *testing.T) {
	ctx := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "test", Subject: "owner", GrantType: session.GrantTypeUser})
	workspace := t.TempDir()
	agentsDir := t.TempDir()
	definition := "---\nname: code-reviewer\ndescription: code reviewer\nmodel: inherit\ntools: [Read, Grep]\n---\nReview code carefully.\n"
	if err := os.WriteFile(filepath.Join(agentsDir, "code-reviewer.md"), []byte(definition), 0o600); err != nil {
		t.Fatalf("write agent definition: %v", err)
	}

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall("delegate", "Subagent", []byte(`{"prompt":"review","agent":"code-reviewer"}`))),
		mockllm.TextTurn("review complete"),
		mockllm.TextTurn("parent complete"),
	)
	built, err := Build(ctx, Config{
		Workspace:     workspace,
		StoreDir:      filepath.Join(t.TempDir(), "sessions"),
		AgentsDirs:    []string{agentsDir},
		MockProvider:  provider,
		NoSoul:        true,
		AllowAllTools: true,
	})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	defer built.Close()

	parent, err := built.Service.CreateSession(ctx, workspace, session.ModeDefault, defaultLimits())
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if root, bound := parent.BoundAuthority(); !bound || len(root.CapabilitySet.Tools) == 0 || root.CapabilitySet.RemainingDelegationDepth == 0 {
		t.Fatalf("minted root authority = %+v, bound=%t; want a usable authority", root, bound)
	}

	run, err := built.Service.StartRun(ctx, parent.ID, "delegate")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	if got := drainRun(run); got != "parent complete" {
		t.Fatalf("terminal text = %q, want parent complete", got)
	}

	childID := session.SessionID("subagent-" + string(parent.ID) + "-delegate")
	child, err := built.Service.GetSession(ctx, childID)
	if err != nil {
		t.Fatalf("GetSession(%q): %v", childID, err)
	}
	childAuthority, bound := child.BoundAuthority()
	if !bound {
		t.Fatal("managed specialist child has no derived authority")
	}
	sort.Strings(childAuthority.CapabilitySet.Tools)
	if got, want := childAuthority.CapabilitySet.Tools, []string{"Grep", "Read"}; !sameStrings(got, want) {
		t.Fatalf("child tools = %v, want %v", got, want)
	}
	if childAuthority.CapabilitySet.RemainingDelegationDepth != 0 {
		t.Fatalf("child depth = %d, want one hop spent", childAuthority.CapabilitySet.RemainingDelegationDepth)
	}
	if !child.Owner.SameIdentity(parent.Owner) {
		t.Fatalf("child owner = %+v, want parent owner %+v", child.Owner, parent.Owner)
	}
}

func TestADR_0228_AuthorityEvaluator_VerticalSlice_Cedar(t *testing.T) {
	ctx := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "test", Subject: "owner", GrantType: session.GrantTypeUser})
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "vendor"), 0o700); err != nil {
		t.Fatalf("create vendor directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "vendor", "blocked.go"), []byte("package vendor\n"), 0o600); err != nil {
		t.Fatalf("write vendor file: %v", err)
	}
	agentsDir := t.TempDir()
	definition := "---\nname: code-reviewer\ndescription: code reviewer\nmodel: inherit\ntools: [Read, Grep]\n---\nReview code carefully.\n"
	if err := os.WriteFile(filepath.Join(agentsDir, "code-reviewer.md"), []byte(definition), 0o600); err != nil {
		t.Fatalf("write agent definition: %v", err)
	}
	policyPath := filepath.Join(t.TempDir(), "authority.cedar")
	realWorkspace, err := filepath.EvalSymlinks(workspace)
	if err != nil {
		t.Fatalf("resolve workspace: %v", err)
	}
	policy := `permit(principal, action, resource);
forbid(principal, action, resource) when { resource.path like "` + filepath.ToSlash(filepath.Join(realWorkspace, "vendor")) + `/*" };`
	if err := os.WriteFile(policyPath, []byte(policy), 0o600); err != nil {
		t.Fatalf("write Cedar policy: %v", err)
	}

	provider := mockllm.New(
		mockllm.ToolCallTurn(session.NewToolCall("delegate", "Subagent", []byte(`{"prompt":"review","agent":"code-reviewer"}`))),
		mockllm.ToolCallTurn(session.NewToolCall("read", "Read", []byte(`{"path":"vendor/blocked.go"}`))),
		mockllm.TextTurn("review complete"),
		mockllm.TextTurn("parent complete"),
	)
	built, err := Build(ctx, Config{
		Workspace:            workspace,
		StoreDir:             filepath.Join(t.TempDir(), "sessions"),
		AgentsDirs:           []string{agentsDir},
		MockProvider:         provider,
		NoSoul:               true,
		AllowAllTools:        true,
		AuthorityEvaluator:   "cedar",
		CedarAuthorityPolicy: policyPath,
	})
	if err != nil {
		t.Fatalf("Build(Cedar): %v", err)
	}
	defer built.Close()

	parent, err := built.Service.CreateSession(ctx, workspace, session.ModeDefault, defaultLimits())
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	run, err := built.Service.StartRun(ctx, parent.ID, "delegate")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	if got := drainRun(run); got != "parent complete" {
		t.Fatalf("terminal text = %q, want parent complete", got)
	}

	child, err := built.Service.GetSession(ctx, session.SessionID("subagent-"+string(parent.ID)+"-delegate"))
	if err != nil {
		t.Fatalf("GetSession(child): %v", err)
	}
	for _, message := range child.Conversation.Messages {
		if message.Role != session.RoleTool || message.ToolResult == nil || message.ToolResult.CallID != "read" {
			continue
		}
		result := *message.ToolResult
		if !result.IsError || !strings.Contains(result.Content, "denied by authority") || !strings.Contains(result.Content, "Cedar") {
			t.Fatalf("Cedar vendor-path result = %+v, want a distinct authority denial", result)
		}
		return
	}
	t.Fatal("missing child Read result")
}

func sameStrings(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}
