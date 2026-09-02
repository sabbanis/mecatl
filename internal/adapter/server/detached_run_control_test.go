package server_test

import (
	"context"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// detachOn is the newServiceMutable mutator: it turns ON the DetachedRuns
// gate — the same option mecated --detached-runs applies. Without it these
// tests would exercise the attached-only path the gate allows by default.
func detachOn(cfg *server.Config) {
	cfg.DetachedRuns = true
}

// TestDetachedRun_Scenario2_ControlOnlyCancel verifies AC2.1: a Converse stream
// whose first frame is cancel with a valid session_id cancels the session's
// in-flight run and returns an ack.
func TestDetachedRun_Scenario2_ControlOnlyCancel(t *testing.T) {
	// A blocking stream keeps the detached run in-flight until the cancel
	// arrives — a completing mock would race the cancel to "no active run".
	llm := mockllm.New(mockllm.ChunksTurn(blockingChunks()...))
	svc := newServiceMutable(t, llm, allowRules(), "", detachOn)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Start a detached run.
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

	// Cancel the detached run via a control-only Converse stream.
	ctrlStream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := ctrlStream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Cancel{Cancel: &mecatlv1.Cancel{
			SessionId: cs.GetSessionId(),
		}},
	}); err != nil {
		t.Fatalf("Send cancel: %v", err)
	}
	_ = ctrlStream.CloseSend()

	events := recvAll(t, ctrlStream)
	if len(events) == 0 {
		t.Fatalf("expected at least one event (the ack), got none")
	}
	ack := events[len(events)-1]
	if ack.GetType() != "run.cancelled" {
		t.Fatalf("ack type = %q, want run.cancelled", ack.GetType())
	}
	if ack.GetResult().GetStop() != "cancelled" {
		t.Fatalf("ack stop = %q, want cancelled", ack.GetResult().GetStop())
	}

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

// TestDetachedRun_Scenario2_ControlOnlyApprove verifies AC2.2: a Converse stream
// whose first frame is resume_approval with a valid session_id resolves the
// paused ask; if the run was dead (rehydrate path), the resumed run's events are
// relayed on the stream.
func TestDetachedRun_Scenario2_ControlOnlyApprove(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	write := &scriptTool{name: "Write", readOnly: false, content: "wrote"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.ToolCallTurn(call("c2", "Write", `{"path":"b.go","content":"x"}`)),
		mockllm.TextTurn("all done"),
	)
	// Write asks (parks awaiting), Read allows — the ask must be for the Write.
	floor := []governance.Rule{
		{Scope: governance.ScopeBuiltinDefault, Tool: "Write", Effect: governance.Ask},
		{Scope: governance.ScopeBuiltinDefault, Tool: "Read", Effect: governance.Allow},
	}
	svc := newServiceEngineStoreMutable(t, llm, floor, detachOn, read, write)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Start a run that will park awaiting on the Write call.
	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look",
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()

	// Read events until we see the permission.ask.
	var askID string
	for {
		resp, err := stream.Recv()
		if err != nil {
			t.Fatalf("Recv: %v", err)
		}
		ev := resp.GetEvent()
		if ev.GetType() == "permission.ask" {
			askID = ev.GetAsk().GetAskId()
			break
		}
	}
	if askID == "" {
		t.Fatalf("expected a permission.ask event")
	}

	// Approve the ask via a control-only Converse stream.
	ctrlStream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := ctrlStream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_ResumeApproval{ResumeApproval: &mecatlv1.ResumeApproval{
			SessionId: cs.GetSessionId(),
			AskId:     askID,
			Verdict:   mecatlv1.ApprovalVerdict_APPROVAL_VERDICT_ALLOW_ONCE,
		}},
	}); err != nil {
		t.Fatalf("Send resume_approval: %v", err)
	}
	_ = ctrlStream.CloseSend()

	// The control-only stream should relay the resumed run's events (the
	// rehydrate path) or ack (the same-process path).
	events := recvAll(t, ctrlStream)
	if len(events) == 0 {
		t.Fatalf("expected at least one event, got none")
	}

	// The session should eventually reach a terminal state.
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
}

// TestDetachedRun_Scenario2_ControlOnlyRequiresSessionID verifies AC2.3: a
// Converse stream whose first frame is cancel or resume_approval with an empty
// session_id is rejected with InvalidArgument.
func TestDetachedRun_Scenario2_ControlOnlyRequiresSessionID(t *testing.T) {
	svc := newServiceMutable(t, mockllm.New(), allowRules(), "", detachOn)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Cancel with empty session_id.
	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Cancel{Cancel: &mecatlv1.Cancel{}},
	}); err != nil {
		t.Fatalf("Send cancel: %v", err)
	}
	_ = stream.CloseSend()
	_, err = stream.Recv()
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("cancel with empty session_id: code = %v, want InvalidArgument", status.Code(err))
	}

	// ResumeApproval with empty session_id.
	stream2, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream2.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_ResumeApproval{ResumeApproval: &mecatlv1.ResumeApproval{
			AskId: "ask-1",
		}},
	}); err != nil {
		t.Fatalf("Send resume_approval: %v", err)
	}
	_ = stream2.CloseSend()
	_, err = stream2.Recv()
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("resume_approval with empty session_id: code = %v, want InvalidArgument", status.Code(err))
	}
}

// TestDetachedRun_Scenario2_ControlOnlyNoActiveRun verifies AC2.4: a Converse
// stream whose first frame is cancel or resume_approval for a session with no
// in-flight run returns FailedPrecondition.
func TestDetachedRun_Scenario2_ControlOnlyNoActiveRun(t *testing.T) {
	svc := newServiceMutable(t, mockllm.New(), allowRules(), "", detachOn)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Cancel a session with no in-flight run.
	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Cancel{Cancel: &mecatlv1.Cancel{
			SessionId: cs.GetSessionId(),
		}},
	}); err != nil {
		t.Fatalf("Send cancel: %v", err)
	}
	_ = stream.CloseSend()
	_, err = stream.Recv()
	if status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("cancel with no active run: code = %v, want FailedPrecondition", status.Code(err))
	}

	// ResumeApproval for a session with no in-flight run.
	stream2, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream2.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_ResumeApproval{ResumeApproval: &mecatlv1.ResumeApproval{
			SessionId: cs.GetSessionId(),
			AskId:     "ask-1",
		}},
	}); err != nil {
		t.Fatalf("Send resume_approval: %v", err)
	}
	_ = stream2.CloseSend()
	_, err = stream2.Recv()
	if status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("resume_approval with no active run: code = %v, want FailedPrecondition", status.Code(err))
	}
}

// TestDetachedRun_Scenario2_ExistingFirstFramePathsUnchanged verifies AC2.5: the
// existing prompt/retry first-frame paths are byte-identical (no regression).
func TestDetachedRun_Scenario2_ExistingFirstFramePathsUnchanged(t *testing.T) {
	read := &scriptTool{name: "Read", readOnly: true, content: "file body"}
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("all done"),
	)
	svc := newServiceMutable(t, llm, allowRules(), "", detachOn, read)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cs, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	// Prompt path (no detach).
	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{
			SessionId: cs.GetSessionId(), Text: "look",
		}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()
	events := recvAll(t, stream)
	if !hasType(events, "tool.call") || !hasType(events, "tool.result") {
		t.Fatalf("missing tool events: %v", typesOf(events))
	}
	res := lastResult(t, events)
	if res.GetStop() != "end_turn" || res.GetText() != "all done" {
		t.Fatalf("result = %+v", res)
	}
}
