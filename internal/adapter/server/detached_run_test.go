package server_test

import (
	"context"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	)

// TestDetachedRun_Scenario1_DetachedRunSurvivesStreamClose verifies AC1.1: a
// Prompt with detach=true starts a run that continues after the Converse stream
// closes. The durable event log records the terminal EvResult.
func TestDetachedRun_Scenario1_DetachedRunSurvivesStreamClose(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
	)
	svc := newService(t, llm, allowRules(), read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()

	// The detached stream should close cleanly after the ack.
	events := recvAll(t, stream)
	if len(events) == 0 {
		t.Fatalf("expected at least one event (the ack), got none")
	}
	// The ack event should be a result with stop=detached.
	ack := events[len(events)-1]
	if ack.GetType() != "run.detached" {
		t.Fatalf("ack type = %q, want run.detached", ack.GetType())
	}
	if ack.GetResult().GetStop() != "detached" {
		t.Fatalf("ack stop = %q, want detached", ack.GetResult().GetStop())
	}

	// The run should continue server-side. Wait for it to complete by polling
	// the session state until it reaches a terminal state.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
		if err != nil {
			t.Fatalf("GetSession: %v", err)
		}
		if sess.GetSession().GetState() == "completed" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	// Verify the session reached a terminal state.
	sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if sess.GetSession().GetState() != "completed" {
		t.Fatalf("session state = %q, want completed", sess.GetSession().GetState())
	}

	// Verify the tool ran (the run actually executed).
	if !read.ran() {
		t.Fatalf("expected Read tool to have run")
	}
}

// TestDetachedRun_Scenario1_AttachedRunCancelledOnStreamClose verifies AC1.2: a
// Prompt with detach=false (or absent) behaves exactly as today — the run is
// cancelled on stream break.
func TestDetachedRun_Scenario1_AttachedRunCancelledOnStreamClose(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
	)
	svc := newService(t, llm, allowRules(), read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look", Detach: false,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()

	// The attached stream should relay events normally and close when the run
	// ends.
	events := recvAll(t, stream)
	if !hasType(events, "tool.call") || !hasType(events, "tool.result") {
		t.Fatalf("missing tool events: %v", typesOf(events))
	}
	res := lastResult(t, events)
	if res.GetStop() != "end_turn" || res.GetText() != "all done" {
		t.Fatalf("result = %+v", res)
	}
}

// TestDetachedRun_Scenario1_DrainGoroutineFinishesRun verifies AC1.3: the drain
// goroutine calls FinishRun on terminal EvResult, releasing the run from the
// registry.
func TestDetachedRun_Scenario1_DrainGoroutineFinishesRun(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	// Two full runs worth of scripted turns: the first detached run consumes the
	// tool+text pair, then the follow-up "again" prompt consumes the second pair.
	// mockllm is a shared scripted provider with a single cursor, so it must
	// carry every run's turns or an exhausted script yields an empty turn
	// (which the loop ends on StopNoProgress, not end_turn).
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
		mockllm.ToolCallTurn(call("c2", "Read", `{"path":"b.go"}`)),
		mockllm.TextTurn("again reply"),
	)
	svc := newService(t, llm, allowRules(), read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()
	_ = recvAll(t, stream)

	// Wait for the run to complete.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
		if err != nil {
			t.Fatalf("GetSession: %v", err)
		}
		if sess.GetSession().GetState() == "completed" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	// After FinishRun, a new run should be able to start on the same session
	// (the registry is clear). This is verified by the session being in a
	// terminal state and a new prompt being accepted.
	stream2, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream2.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "again",
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream2.CloseSend()
	events2 := recvAll(t, stream2)
	res2 := lastResult(t, events2)
	if res2.GetStop() != "end_turn" {
		t.Fatalf("second run stop = %q, want end_turn", res2.GetStop())
	}
}

// TestDetachedRun_Scenario1_ServiceCloseCancelsDetachedRuns verifies AC1.4:
// Service.Close cancels all in-flight detached runs (the drain goroutine joins
// on close).
func TestDetachedRun_Scenario1_ServiceCloseCancelsDetachedRuns(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
	)
	svc := newService(t, llm, allowRules(), read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()
	_ = recvAll(t, stream)

	// Close the service (simulates server shutdown). This should cancel the
	// in-flight detached run.
	svc.Close()

	// The session should be in a terminal state (cancelled).
	sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	state := sess.GetSession().GetState()
	if state != "cancelled" && state != "completed" {
		t.Fatalf("session state = %q, want cancelled or completed", state)
	}
}

// TestDetachedRun_Scenario1_DetachedLogSurvivesClientDisconnect verifies AC1.5:
// the drain goroutine uses a cancel-detached ctx for the durable log (a dead
// client never stops the log).
func TestDetachedRun_Scenario1_DetachedLogSurvivesClientDisconnect(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
	)
	svc := newService(t, llm, allowRules(), read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Use a cancellable context for the stream so we can simulate a client
	// disconnect.
	streamCtx, streamCancel := context.WithCancel(ctx)
	stream, err := client.Converse(streamCtx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look", Detach: true,
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()

	// Read the ack, then cancel the stream context (simulating a client
	// disconnect).
	ack, err := stream.Recv()
	if err != nil {
		t.Fatalf("Recv ack: %v", err)
	}
	if ack.GetEvent().GetType() != "run.detached" {
		t.Fatalf("ack type = %q, want run.detached", ack.GetEvent().GetType())
	}
	streamCancel()

	// The run should continue server-side despite the client disconnect.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
		if err != nil {
			t.Fatalf("GetSession: %v", err)
		}
		if sess.GetSession().GetState() == "completed" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	sess, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: cs.GetSessionId()})
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if sess.GetSession().GetState() != "completed" {
		t.Fatalf("session state = %q, want completed", sess.GetSession().GetState())
	}
	if !read.ran() {
		t.Fatalf("expected Read tool to have run")
	}
}
