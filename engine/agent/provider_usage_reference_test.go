package agent_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

func TestADR_0353_ProviderUsageReference_Scenario2_LoopRelaysMetadataOnlyEvent(t *testing.T) {
	llm := mockllm.New(mockllm.Turn{Chunks: []port.Chunk{
		{Kind: port.ChunkText, Text: "answer"},
		{Kind: port.ChunkProviderUsageReference, Text: "resp_exact-1"},
		{Kind: port.ChunkUsage, Usage: &session.Usage{InputTokens: 2, OutputTokens: 1}},
		{Kind: port.ChunkDone, Stop: session.StopEndTurn},
	}})
	eng := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t)})
	sess := newSession(t, session.Limits{})

	events := drain(eng.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "hi"}))
	var refs []session.Event
	for _, event := range events {
		if event.Type == session.EvProviderUsageReference {
			refs = append(refs, event)
		}
	}
	if len(refs) != 1 {
		t.Fatalf("provider usage-reference events = %d, want 1 (events=%v)", len(refs), typesOf(events))
	}
	if refs[0].Turn != 0 || refs[0].Text != "resp_exact-1" {
		t.Fatalf("usage-reference event = %+v, want enclosing turn 0 and exact text", refs[0])
	}
	for _, message := range sess.Conversation.Messages {
		if strings.Contains(message.Text, "resp_exact-1") || strings.Contains(message.Reasoning, "resp_exact-1") {
			t.Fatalf("provider usage reference leaked into conversation: %+v", message)
		}
	}
}

func TestADR_0353_ProviderUsageReference_Scenario2_NonCommittingAndResourceCounted(t *testing.T) {
	baseline := drain(resourceEngine(mockllm.New(mockllm.TextTurn("answer")), func(*agent.Deps) {}).Run(
		context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"},
	))

	llm := mockllm.New(mockllm.Turn{Chunks: []port.Chunk{
		{Kind: port.ChunkText, Text: "answer"},
		{Kind: port.ChunkProviderUsageReference, Text: "resp_budget"},
		{Kind: port.ChunkUsage, Usage: &session.Usage{}},
		{Kind: port.ChunkDone, Stop: session.StopEndTurn},
	}})
	limited := resourceEngine(llm, func(deps *agent.Deps) {
		deps.MaxEvents = len(baseline)
		deps.MaxEventBytes = 4096
		deps.MaxBufferedEventBytes = 8192
	})
	events := drain(limited.Run(
		context.Background(), newSession(t, session.Limits{MaxTurns: 1}), agent.MemEnv("/ws"), agent.RunRequest{Text: "prompt"},
	))
	result := lastResult(t, events)
	if result.Stop != session.StopBudget || !strings.Contains(result.Error, agent.ErrRunEventCountLimit.Error()) {
		t.Fatalf("terminal result = %+v, want usage-reference event to consume the ordinary event budget", result)
	}
}
