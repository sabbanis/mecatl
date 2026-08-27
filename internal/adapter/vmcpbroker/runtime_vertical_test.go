package vmcpbroker

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

type runtimeVerticalCapture struct {
	spec       []byte
	calls      []byte
	results    []byte
	events     []byte
	secrets    []string
	toolName   string
	toolResult string
	upstreams  int32
}

func TestSessionVMCPBroker_RuntimeOwnsEmbeddedVMCPVertical(t *testing.T) {
	capture := runEmbeddedDocumentationTool(t)
	if capture.toolName != "github_read_documentation" {
		t.Fatal("runtime did not preserve the stable model-facing documentation tool identity")
	}
	if !strings.Contains(capture.toolResult, "documentation result") {
		t.Fatal("runtime-owned session transport did not return the fake documentation tool result")
	}
	if capture.upstreams == 0 {
		t.Fatal("documentation call did not reach the embedded authenticated vMCP backend")
	}
}

func TestInvariant_vmcp_broker_runtime_vertical_secrets_do_not_escape(t *testing.T) {
	capture := runEmbeddedDocumentationTool(t)
	for surface, content := range map[string][]byte{
		"tool spec":    capture.spec,
		"tool calls":   capture.calls,
		"tool results": capture.results,
		"events":       capture.events,
	} {
		for _, secret := range capture.secrets {
			if strings.Contains(string(content), secret) {
				t.Fatalf("%s exposed a broker secret", surface)
			}
		}
	}
}

func runEmbeddedDocumentationTool(t *testing.T) runtimeVerticalCapture {
	t.Helper()

	runtime, client, upstreamCalls := newToolHiveStreamingRuntimeWithTool(t, "read_documentation", "github_read_documentation", "documentation result")
	sessionTools, err := runtime.OpenSession("runtime-vertical")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = sessionTools.Close() })
	before := sessionTools.Tools()
	if len(before) != 1 || before[0].Spec().Name != "github_read_documentation" {
		t.Fatal("OpenSession did not mount one stable documentation tool")
	}
	spec, err := json.Marshal(before[0].Spec())
	if err != nil {
		t.Fatalf("marshal tool spec: %v", err)
	}

	pending, err := runtime.Connect(context.Background(), "runtime-vertical", "github")
	if err != nil || pending.Status != ConnectionPending || pending.AuthorizationRequired == nil {
		t.Fatal("Connect did not create an embedded authorization rendezvous")
	}
	runtime.mu.RLock()
	transaction := runtime.transactions[controlTarget{sessionID: "runtime-vertical", backendID: "github"}]
	runtime.mu.RUnlock()
	code, state := completeToolHiveAuthorization(t, client, pending.AuthorizationRequired.BrowserURL)
	if err := runtime.Callback(context.Background(), code, state); err != nil {
		t.Fatalf("Callback: %v", err)
	}
	connected, err := runtime.Connect(context.Background(), "runtime-vertical", "github")
	if err != nil || connected.Status != ConnectionConnected || connected.AuthorizationRequired != nil {
		t.Fatal("Connect did not complete the embedded authorization callback")
	}
	runtime.mu.RLock()
	grant := runtime.grants[controlTarget{sessionID: "runtime-vertical", backendID: "github"}]
	runtime.mu.RUnlock()

	after := sessionTools.Tools()
	if len(after) != len(before) || after[0].Spec().Name != before[0].Spec().Name || string(after[0].Spec().Schema) != string(before[0].Spec().Schema) {
		t.Fatal("authorization changed the model-facing broker tool catalogue")
	}
	catalog := tool.NewCatalog()
	if err := catalog.Register(before[0]); err != nil {
		t.Fatalf("register documentation tool: %v", err)
	}
	eng := agent.NewEngine(agent.Deps{
		LLM: mockllm.New(
			mockllm.ToolCallTurn(session.NewToolCall("documentation-call", before[0].Spec().Name, json.RawMessage(`{}`))),
			mockllm.TextTurn("done"),
		),
		Catalog: catalog,
		Model:   "test",
		Policy:  permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Allow}}, nil),
	})
	sess := session.New("runtime-vertical", session.ModeDefault, "/workspace", session.Limits{}, time.Time{})
	env := tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/workspace"}, memfs.NewWorkspace("/workspace"), nil)
	var events []byte
	for event := range eng.Run(context.Background(), sess, env, agent.RunRequest{Text: "read the documentation"}).Events() {
		encoded, err := json.Marshal(event)
		if err != nil {
			t.Fatalf("marshal event: %v", err)
		}
		events = append(events, encoded...)
	}
	calls, err := json.Marshal(sess.Conversation.Messages)
	if err != nil {
		t.Fatalf("marshal tool calls: %v", err)
	}
	result := brokerToolResult(t, sess)
	results, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshal tool result: %v", err)
	}
	return runtimeVerticalCapture{
		spec:       spec,
		calls:      calls,
		results:    results,
		events:     events,
		secrets:    []string{"upstream-credential-for-session-lineage", "upstream-code", pending.AuthorizationRequired.Handle, transaction.verifier, state, grant.accessToken, grant.refreshToken},
		toolName:   before[0].Spec().Name,
		toolResult: result.Content,
		upstreams:  upstreamCalls.Load(),
	}
}
