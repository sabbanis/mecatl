package agent_test

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/authorityconformance"
	"github.com/stacklok/mecatl/engine/adapter/localauthority"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/noopauthority"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

type recordingAuthorityEvaluator struct {
	mu       sync.Mutex
	requests []port.AuthorityRequest
	decision port.AuthorityDecision
	err      error
}

func (e *recordingAuthorityEvaluator) AuthorizeTool(_ context.Context, request port.AuthorityRequest) (port.AuthorityDecision, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.requests = append(e.requests, request)
	return e.decision, e.err
}

func (e *recordingAuthorityEvaluator) calls() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return len(e.requests)
}

type recordingDiagnostics struct {
	mu   sync.Mutex
	msgs []string
}

func (d *recordingDiagnostics) Log(_ context.Context, _ port.Level, msg string, _ ...any) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.msgs = append(d.msgs, msg)
}
func (d *recordingDiagnostics) With(...any) port.Diagnostics { return d }
func (d *recordingDiagnostics) contains(want string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	for _, msg := range d.msgs {
		if msg == want {
			return true
		}
	}
	return false
}

type authorityTool struct {
	name string
	ran  atomic.Int32
}

func (t *authorityTool) Spec() tool.ToolSpec {
	return tool.ToolSpec{Name: t.name, Schema: json.RawMessage(`{"type":"object"}`)}
}
func (*authorityTool) ReadOnly() bool { return false }
func (t *authorityTool) Execute(_ context.Context, in session.ToolCall, _ tool.Environment) (session.ToolResult, error) {
	t.ran.Add(1)
	return session.NewToolResult(in.ID, "ran"), nil
}

func authoritySession(t *testing.T, names ...string) *session.Session {
	t.Helper()
	sess := newSession(t, session.Limits{})
	if err := sess.RestoreLabels(&session.Principal{Issuer: "issuer", Subject: "owner", GrantType: session.GrantTypeUser}, session.Authority{
		CapabilitySet: governance.CapabilitySet{Tools: names, RemainingDelegationDepth: 1},
		Provenance:    "test",
	}); err != nil {
		t.Fatalf("RestoreLabels: %v", err)
	}
	return sess
}

func TestADR_0228_AuthorityEvaluator_Scenario3_EveryDispatchPathConsultsTheEvaluatorOnce(t *testing.T) {
	t.Run("sequential", func(t *testing.T) {
		first := &authorityTool{name: "First"}
		second := &authorityTool{name: "Second"}
		evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Allowed: true}}
		eng := newEngine(agent.Deps{
			LLM: mockllm.New(mockllm.ToolCallTurn(
				toolCall("one", "First", `{}`), toolCall("two", "Second", `{}`))),
			Catalog: catalogWith(t, first, second), AuthorityEvaluator: evaluator,
		})
		drain(eng.Run(context.Background(), authoritySession(t, "First", "Second"), agent.MemEnv("/ws"), agent.RunRequest{Text: "run"}))
		if got := evaluator.calls(); got != 2 {
			t.Fatalf("evaluator calls = %d, want one per execution (2)", got)
		}
		if first.ran.Load() != 1 || second.ran.Load() != 1 {
			t.Fatalf("tool executions = %d, %d; want 1, 1", first.ran.Load(), second.ran.Load())
		}
	})
}

func TestADR_0228_AuthorityEvaluator_Scenario3_UnavailableEvaluatorIsDistinctFromDenial(t *testing.T) {
	readTool := &authorityTool{name: "Read"}
	unavailable := &recordingAuthorityEvaluator{err: context.DeadlineExceeded}
	diagnostics := &recordingDiagnostics{}
	eng := newEngine(agent.Deps{
		LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("unavailable", "Read", `{"path":"README.md"}`))),
		Catalog:            catalogWith(t, readTool),
		AuthorityEvaluator: unavailable,
		Diagnostics:        diagnostics,
	})
	events := drain(eng.Run(context.Background(), authoritySession(t, "Read"), agent.MemEnv("/ws"), agent.RunRequest{Text: "read"}))
	if readTool.ran.Load() != 0 {
		t.Fatal("tool ran while evaluator was unavailable")
	}
	if !diagnostics.contains("authority evaluator unavailable") {
		t.Fatal("unavailable evaluator did not produce an operator diagnostic")
	}
	for _, event := range events {
		if event.ToolResult != nil && event.ToolResult.CallID == "unavailable" {
			if !strings.Contains(event.ToolResult.Content, "authority evaluator unavailable") || strings.Contains(event.ToolResult.Content, "denied by authority") {
				t.Fatalf("unavailable evaluator result = %q, want a distinct fail-closed message", event.ToolResult.Content)
			}
			return
		}
	}
	t.Fatal("missing unavailable evaluator result")
}

func TestADR_0228_AuthorityEvaluator_Scenario3_AdaptersSatisfyConformanceSuite(t *testing.T) {
	t.Run("noop", func(t *testing.T) {
		authorityconformance.Run(t, func(*testing.T) port.AuthorityEvaluator { return noopauthority.New() })
	})
	t.Run("local", func(t *testing.T) {
		authorityconformance.Run(t, func(*testing.T) port.AuthorityEvaluator { return localauthority.New() })
	})
	// Cedar is intentionally not linked into the engine module. Its opt-in adapter
	// joins this same suite in the later Cedar task.
	t.Run("cedar unavailable in this build", func(t *testing.T) { t.Skip("Cedar adapter is not part of this task") })
}

func TestADR_0228_AuthorityEvaluator_Scenario3_MetaToolIsAuthorizedAgainstItsTarget(t *testing.T) {
	meta := &authorityTool{name: "CallMcpWithQuery"}
	evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Reason: "target is absent"}}
	eng := newEngine(agent.Deps{
		LLM:     mockllm.New(mockllm.ToolCallTurn(toolCall("meta", "CallMcpWithQuery", `{"server":"github","tool":"create_issue"}`))),
		Catalog: catalogWith(t, meta), AuthorityEvaluator: evaluator,
	})
	events := drain(eng.Run(context.Background(), authoritySession(t, "CallMcpWithQuery"), agent.MemEnv("/ws"), agent.RunRequest{Text: "call"}))
	if meta.ran.Load() != 0 || evaluator.calls() != 1 {
		t.Fatalf("meta tool ran %d times with %d evaluator calls, want 0 and 1", meta.ran.Load(), evaluator.calls())
	}
	for _, event := range events {
		if event.ToolResult != nil && event.ToolResult.CallID == "meta" {
			if !strings.Contains(event.ToolResult.Content, `mcp__github__create_issue`) {
				t.Fatalf("target denial did not name reconstructed target: %q", event.ToolResult.Content)
			}
			return
		}
	}
	t.Fatal("missing meta tool result")
}

func TestADR_0228_AuthorityEvaluator_Scenario7_ResourceAttributeIsDerivedWithoutRawArguments(t *testing.T) {
	t.Run("normalized workspace target", func(t *testing.T) {
		write := &authorityTool{name: "Write"}
		evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Allowed: true}}
		eng := newEngine(agent.Deps{
			LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("write", "Write", `{"path":"./docs/../README.md","content":"credential=must-not-leak"}`))),
			Catalog:            catalogWith(t, write),
			AuthorityEvaluator: evaluator,
		})

		drain(eng.Run(context.Background(), authoritySession(t, "Write"), agent.MemEnv("/workspace"), agent.RunRequest{Text: "write"}))
		if got := write.ran.Load(); got != 1 {
			t.Fatalf("write executions = %d, want 1", got)
		}
		if got := evaluator.calls(); got != 1 {
			t.Fatalf("evaluator calls = %d, want 1", got)
		}
		evaluator.mu.Lock()
		defer evaluator.mu.Unlock()
		request := evaluator.requests[0]
		encoded, err := json.Marshal(request)
		if err != nil {
			t.Fatalf("marshal authority request: %v", err)
		}
		if strings.Contains(string(encoded), "must-not-leak") {
			t.Fatalf("authority request forwarded raw tool content: %s", encoded)
		}
		if request.ToolName != "Write" {
			t.Fatalf("tool name = %q, want exact tool name Write", request.ToolName)
		}
		if request.Resource == nil {
			t.Fatal("resource descriptor is missing")
		}
		if request.Resource.Kind != port.AuthorityResourceWorkspaceFile || request.Resource.Path != "/workspace/README.md" || request.Resource.Workspace != "/workspace" {
			t.Fatalf("resource = %+v, want normalized workspace file /workspace/README.md", request.Resource)
		}
	})

	for _, args := range []string{
		`{"path":42}`,
		`{"path":"one","path":"two"}`,
	} {
		t.Run("malformed or ambiguous path is fail closed", func(t *testing.T) {
			read := &authorityTool{name: "Read"}
			evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Allowed: true}}
			eng := newEngine(agent.Deps{
				LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("read", "Read", args))),
				Catalog:            catalogWith(t, read),
				AuthorityEvaluator: evaluator,
			})

			drain(eng.Run(context.Background(), authoritySession(t, "Read"), agent.MemEnv("/workspace"), agent.RunRequest{Text: "read"}))
			if got := read.ran.Load(); got != 0 {
				t.Fatalf("read executions = %d, want 0", got)
			}
			if got := evaluator.calls(); got != 0 {
				t.Fatalf("evaluator calls = %d, want 0", got)
			}
		})
	}
}

func TestADR_0228_AuthorityEvaluator_Scenario3_DisclosureIsNotLoadBearing(t *testing.T) {
	denied := &authorityTool{name: "Write"}
	evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Reason: "tool is absent from the capability set"}}
	eng := newEngine(agent.Deps{
		LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", "Write", `{"path":"README.md","content":"x"}`))),
		Catalog:            catalogWith(t, denied),
		AuthorityEvaluator: evaluator,
	})

	events := drain(eng.Run(context.Background(), authoritySession(t, "Read"), agent.MemEnv("/ws"), agent.RunRequest{Text: "write"}))
	if got := denied.ran.Load(); got != 0 {
		t.Fatalf("disclosed tool executed %d times despite authority denial", got)
	}
	if got := evaluator.calls(); got != 1 {
		t.Fatalf("evaluator calls = %d, want 1", got)
	}
	for _, event := range events {
		if event.ToolResult != nil && event.ToolResult.CallID == "call-1" {
			if !event.ToolResult.IsError || !strings.Contains(event.ToolResult.Content, "denied by authority") {
				t.Fatalf("authority result = %+v, want distinct authority denial", event.ToolResult)
			}
			return
		}
	}
	t.Fatal("missing authority denial result")
}

func TestADR_0228_AuthorityEvaluator_Scenario3_ResourceReachDerivesFromToolNames(t *testing.T) {
	const server = "resource-only"
	capability := governance.MCPResourceCapability(server)

	t.Run("resource-only server is authorized by its derived capability", func(t *testing.T) {
		resourceTool := &authorityTool{name: "ReadMcpResource"}
		evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Allowed: true}}
		eng := newEngine(agent.Deps{
			LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("resource", "ReadMcpResource", `{"server":"resource-only","uri":"secret://must-not-forward"}`))),
			Catalog:            catalogWith(t, resourceTool),
			AuthorityEvaluator: evaluator,
		})

		drain(eng.Run(context.Background(), authoritySession(t, capability), agent.MemEnv("/ws"), agent.RunRequest{Text: "read resource"}))
		if got := resourceTool.ran.Load(); got != 1 {
			t.Fatalf("resource-only server execution = %d, want 1", got)
		}
		evaluator.mu.Lock()
		defer evaluator.mu.Unlock()
		if len(evaluator.requests) != 1 {
			t.Fatalf("evaluator requests = %d, want 1", len(evaluator.requests))
		}
		request := evaluator.requests[0]
		if request.ToolName != capability || request.Action != "ReadMcpResource" {
			t.Fatalf("request capability/action = %q/%q, want %q/ReadMcpResource", request.ToolName, request.Action, capability)
		}
		encoded, err := json.Marshal(request)
		if err != nil {
			t.Fatalf("marshal authority request: %v", err)
		}
		if strings.Contains(string(encoded), "secret://must-not-forward") {
			t.Fatalf("authority request forwarded resource URI: %s", encoded)
		}
	})

	t.Run("local evaluator checks the derived capability", func(t *testing.T) {
		resourceTool := &authorityTool{name: "ListMcpResources"}
		eng := newEngine(agent.Deps{
			LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("local", "ListMcpResources", `{"server":"resource-only"}`))),
			Catalog:            catalogWith(t, resourceTool),
			AuthorityEvaluator: localauthority.New(),
		})

		drain(eng.Run(context.Background(), authoritySession(t, capability), agent.MemEnv("/ws"), agent.RunRequest{Text: "list resource"}))
		if got := resourceTool.ran.Load(); got != 1 {
			t.Fatalf("local evaluator resource execution = %d, want 1", got)
		}
	})

	t.Run("aggregate resource operation fails closed before evaluation", func(t *testing.T) {
		resourceTool := &authorityTool{name: "ListMcpResources"}
		evaluator := &recordingAuthorityEvaluator{decision: port.AuthorityDecision{Allowed: true}}
		eng := newEngine(agent.Deps{
			LLM:                mockllm.New(mockllm.ToolCallTurn(toolCall("aggregate", "ListMcpResources", `{}`))),
			Catalog:            catalogWith(t, resourceTool),
			AuthorityEvaluator: evaluator,
		})

		events := drain(eng.Run(context.Background(), authoritySession(t, capability), agent.MemEnv("/ws"), agent.RunRequest{Text: "list resources"}))
		if resourceTool.ran.Load() != 0 || evaluator.calls() != 0 {
			t.Fatalf("aggregate resource call ran=%d evaluations=%d, want 0/0", resourceTool.ran.Load(), evaluator.calls())
		}
		for _, event := range events {
			if event.ToolResult != nil && event.ToolResult.CallID == "aggregate" {
				if !strings.Contains(event.ToolResult.Content, "target is invalid") {
					t.Fatalf("aggregate result = %q, want concrete-server failure", event.ToolResult.Content)
				}
				return
			}
		}
		t.Fatal("missing aggregate resource denial")
	})
}
