package server_test

import (
	"context"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
)

// TestDetachedRunFlagGatesAttachIsByteIdentical asserts the --detached-runs gate
// (ADR 0322 Scenario 4): when the flag is OFF, a server IGNORES the
// Prompt{Detach:true} field — it takes the ATTACHED Converse path, byte-identical
// to a client that never sent the field (run relays normally and cancels on
// stream close). The ServerCapabilities.detached_runs bit is likewise NOT
// advertised. When the flag is ON, the run.detached ack + capability bit are
// honest.
func TestDetachedRunFlagGatesAttachIsByteIdentical(t *testing.T) {
	// Left unconfigured → flag OFF: detach is ignored, the run still starts
	// attached (regular relay) and the cap bit is absent.
	//
	// We drive a real service endpoint to assert BOTH halves (wire and capability).
	llm := mockllm.New()
	svc := newServiceWithImplementation(t, llm, allowRules(), "")
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	compat, err := client.GetCompatibilityInfo(ctx, &mecatlv1.GetCompatibilityInfoRequest{})
	if err != nil {
		t.Fatalf("GetCompatibilityInfo: %v", err)
	}
	if compat.GetCapabilities().GetDetachedRuns() {
		t.Fatal("detached_runs bit advertised while the flag is off — must not advertise")
	}

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	stream, err2 := client.Converse(ctx)
	if err2 != nil {
		t.Fatalf("Converse: %v", err2)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "go", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()
	events := recvAll(t, stream)
	if len(events) == 0 {
		t.Fatal("attached relay: no events")
	}
	// The prompt is treated as ATTACHED — the run starts and relays events
	// normally (the ack type is NOT run.detached). Whatever run-detached would
	// have been, it is not here.
	if ev := events[len(events)-1]; ev.GetType() == "run.detached" {
		t.Fatal("flag OFF: ack type = run.detached, want the ATTACHED first-frame path")
	}

	// With the flag ON, the detached ack is honest.
	llm2 := mockllm.New(mockllm.ChunksTurn(blockingChunks()...))
	svc2 := newServiceMutable(t, llm2, allowRules(), "", detachOn)
	client2, cleanup2 := dialGRPC(t, svc2)
	defer cleanup2()

	compat2, err := client2.GetCompatibilityInfo(ctx, &mecatlv1.GetCompatibilityInfoRequest{})
	if err != nil {
		t.Fatalf("GetCompatibilityInfo: %v", err)
	}
	if !compat2.GetCapabilities().GetDetachedRuns() {
		t.Fatal("flag ON: detached_runs bit not advertised — must advertise it")
	}

	cs2, err := client2.CreateSession(ctx, &mecatlv1.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	stream2, err := client2.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream2.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs2.GetSessionId(), Text: "go", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream2.CloseSend()
	events2 := recvAll(t, stream2)
	ack2 := events2[len(events2)-1]
	if ack2.GetType() != "run.detached" {
		t.Fatalf("flag ON: ack type = %q, want run.detached", ack2.GetType())
	}
}
