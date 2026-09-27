package openai

import (
	"strconv"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/port"
)

func TestADR_0353_ProviderUsageReference_Scenario1_CompletedResponseEmitsExactReference(t *testing.T) {
	sse := "event: response.created\n" +
		`data: {"type":"response.created","sequence_number":0,"response":{"id":"resp_AZ09._:-","status":"in_progress"}}` + "\n\n" +
		"event: response.completed\n" +
		`data: {"type":"response.completed","sequence_number":1,"response":{"id":"resp_AZ09._:-","status":"completed","usage":{"input_tokens":1,"output_tokens":1}}}` + "\n\n"

	got, err := decodeSSE(strings.NewReader(sse))
	if err != nil {
		t.Fatalf("decodeSSE: %v", err)
	}
	refs := chunksOfKind(got, chunkProviderUsageReference)
	if len(refs) != 1 || refs[0].Text != "resp_AZ09._:-" {
		t.Fatalf("usage-reference chunks = %+v, want one byte-exact reference", refs)
	}
}

func TestADR_0353_ProviderUsageReference_Scenario1_TerminalChunkOrder(t *testing.T) {
	sse := "event: response.created\n" +
		`data: {"type":"response.created","sequence_number":0,"response":{"id":"resp_order","status":"in_progress"}}` + "\n\n" +
		"event: response.output_item.done\n" +
		`data: {"type":"response.output_item.done","sequence_number":1,"output_index":0,"item":{"id":"rs_1","type":"reasoning","summary":[],"encrypted_content":"opaque"}}` + "\n\n" +
		"event: response.completed\n" +
		`data: {"type":"response.completed","sequence_number":2,"response":{"id":"resp_order","status":"completed","usage":{"input_tokens":1,"output_tokens":1},"openrouter_metadata":{"endpoints":{"available":[{"provider":"Anthropic","selected":true}]}}}}` + "\n\n"

	got, err := decodeSSE(strings.NewReader(sse))
	if err != nil {
		t.Fatalf("decodeSSE: %v", err)
	}
	want := []port.ChunkKind{
		port.ChunkProviderRoute,
		chunkProviderUsageReference,
		port.ChunkReasoningItem,
		port.ChunkUsage,
		port.ChunkDone,
	}
	if len(got) != len(want) {
		t.Fatalf("chunks = %+v, want terminal kinds %v", got, want)
	}
	for i, kind := range want {
		if got[i].Kind != kind {
			t.Fatalf("chunk[%d].Kind = %v, want %v (chunks=%+v)", i, got[i].Kind, kind, got)
		}
	}
}

func TestADR_0353_ProviderUsageReference_Scenario1_InvalidOrConflictingIdentityFailsClosed(t *testing.T) {
	tests := map[string]string{
		"invalid first byte":  " bad",
		"invalid punctuation": "resp/bad",
		"too long":            strings.Repeat("a", 129),
	}
	for name, id := range tests {
		t.Run(name, func(t *testing.T) {
			sse := "event: response.created\n" +
				`data: {"type":"response.created","sequence_number":0,"response":{"id":` + strconv.Quote(id) + `,"status":"in_progress"}}` + "\n\n" +
				"event: response.completed\n" +
				`data: {"type":"response.completed","sequence_number":1,"response":{"id":` + strconv.Quote(id) + `,"status":"completed","usage":{}}}` + "\n\n"
			got, err := decodeSSE(strings.NewReader(sse))
			if err == nil {
				t.Fatal("decodeSSE succeeded, want invalid response identity error")
			}
			assertNoSuccessfulReferenceTerminal(t, got)
		})
	}

	t.Run("conflicting lifecycle identities", func(t *testing.T) {
		sse := "event: response.created\n" +
			`data: {"type":"response.created","sequence_number":0,"response":{"id":"resp_one","status":"in_progress"}}` + "\n\n" +
			"event: response.completed\n" +
			`data: {"type":"response.completed","sequence_number":1,"response":{"id":"resp_two","status":"completed","usage":{}}}` + "\n\n"
		got, err := decodeSSE(strings.NewReader(sse))
		if err == nil {
			t.Fatal("decodeSSE succeeded, want conflicting response identity error")
		}
		assertNoSuccessfulReferenceTerminal(t, got)
	})
}

func TestADR_0353_ProviderUsageReference_Scenario1_AbsentOrUnsuccessfulResponseEmitsNone(t *testing.T) {
	tests := map[string]string{
		"identity absent": "event: response.completed\n" +
			`data: {"type":"response.completed","sequence_number":0,"response":{"status":"completed","usage":{}}}` + "\n\n",
		"incomplete": "event: response.incomplete\n" +
			`data: {"type":"response.incomplete","sequence_number":0,"response":{"id":"resp_incomplete","status":"incomplete","usage":{},"incomplete_details":{"reason":"max_output_tokens"}}}` + "\n\n",
		"failed": "event: response.failed\n" +
			`data: {"type":"response.failed","sequence_number":0,"response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"failed"}}}` + "\n\n",
	}
	for name, sse := range tests {
		t.Run(name, func(t *testing.T) {
			got, _ := decodeSSE(strings.NewReader(sse))
			if refs := chunksOfKind(got, chunkProviderUsageReference); len(refs) != 0 {
				t.Fatalf("usage-reference chunks = %+v, want none", refs)
			}
		})
	}
}

func TestADR_0353_ProviderUsageReference_Scenario3_ExistingAdapterAndProfileCompatibility(t *testing.T) {
	sse := "event: response.output_text.delta\n" +
		`data: {"type":"response.output_text.delta","sequence_number":0,"delta":"legacy"}` + "\n\n" +
		"event: response.completed\n" +
		`data: {"type":"response.completed","sequence_number":1,"response":{"status":"completed","usage":{"input_tokens":1,"output_tokens":1}}}` + "\n\n"
	got, err := decodeSSE(strings.NewReader(sse))
	if err != nil {
		t.Fatalf("decodeSSE: %v", err)
	}
	if refs := chunksOfKind(got, chunkProviderUsageReference); len(refs) != 0 {
		t.Fatalf("ID-free compatible response emitted usage reference: %+v", refs)
	}
	if len(got) != 3 || got[0].Kind != port.ChunkText || got[1].Kind != port.ChunkUsage || got[2].Kind != port.ChunkDone {
		t.Fatalf("legacy chunk sequence changed: %+v", got)
	}
}

func chunksOfKind(chunks []port.Chunk, kind port.ChunkKind) []port.Chunk {
	var out []port.Chunk
	for _, chunk := range chunks {
		if chunk.Kind == kind {
			out = append(out, chunk)
		}
	}
	return out
}

func assertNoSuccessfulReferenceTerminal(t *testing.T, chunks []port.Chunk) {
	t.Helper()
	for _, chunk := range chunks {
		if chunk.Kind == chunkProviderUsageReference || chunk.Kind == port.ChunkDone {
			t.Fatalf("failed-closed stream emitted successful terminal metadata: %+v", chunks)
		}
	}
}
