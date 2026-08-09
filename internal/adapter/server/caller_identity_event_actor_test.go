package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"iter"
	"strings"
	"testing"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/eventsource"
	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// eventActorService builds a Service over the supplied EventLog whose engine runs
// ONE allowed read-only tool call and then answers — enough to produce a full
// lifecycle stream (session.init → turn.start → tool.call → tool.result →
// user_prompt → result) in the durable log without parking on an ask.
func eventActorService(t *testing.T, log port.EventLog) *server.Service {
	t.Helper()
	cat := tool.NewCatalog()
	cat.MustRegister(&scriptTool{name: "Read", readOnly: true, content: "file body"})
	llm := mockllm.New(
		mockllm.ToolCallTurn(call("c1", "Read", `{"path":"a.go"}`)),
		mockllm.TextTurn("done"),
	)
	engine := agent.NewEngine(agent.Deps{
		LLM:     llm,
		Catalog: cat,
		Policy:  permpolicy.NewPolicy(allowRules(), nil),
		Model:   "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine:              engine,
		Store:               memstore.New(),
		Workspaces:          func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:                 func() time.Time { return time.Unix(0, 0) },
		DefaultCapabilities: llm.Capabilities(),
		EventLog:            log,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	return svc
}

// driveConverse runs one prompt over the gRPC Converse relay to EOF, returning the
// proto events the CLIENT saw (the wire projection).
func driveConverse(t *testing.T, svc *server.Service, id session.SessionID) []*mecatlv1.Event {
	t.Helper()
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	stream, err := client.Converse(ctx)
	if err != nil {
		t.Fatalf("Converse: %v", err)
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{
		Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{SessionId: string(id), Text: "go"}},
	}); err != nil {
		t.Fatalf("Send prompt: %v", err)
	}
	_ = stream.CloseSend()
	var out []*mecatlv1.Event
	for {
		resp, rerr := stream.Recv()
		if errors.Is(rerr, io.EOF) {
			break
		}
		if rerr != nil {
			t.Fatalf("Recv: %v", rerr)
		}
		out = append(out, resp.GetEvent())
	}
	return out
}

// TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly pins AC4.1: an event
// appended for a session owned by Alice is recorded with Actor == Alice's
// principal, and the STAMP HAPPENS ONLY AT appendEvent — the loop-side emit leaves
// Actor nil.
//
// The two halves run over the SAME service:
//   - the relayed session (driven through gRPC Converse, which calls appendEvent
//     for every event) → every logged event names Alice;
//   - a second owned session driven through Service.StartRunContent and drained
//     DIRECTLY (bypassing the relay, so appendEvent never runs) → every event the
//     loop emitted carries a nil Actor.
//
// MUTATION-KILL: stamping in the loop (any e.emit site) makes the direct-drain half
// fail; dropping the appendEvent stamp makes the log half fail.
func TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly(t *testing.T) {
	ctx := session.WithPrincipal(context.Background(), alice)
	log := memstore.NewEventLog()
	svc := eventActorService(t, log)

	relayed, err := svc.CreateSession(ctx, "/ws", session.ModeDefault, session.Limits{MaxTurns: 4})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	driveConverse(t, svc, relayed.ID)

	logged := readEventLog(t, log, relayed.ID)
	if len(logged) == 0 {
		t.Fatalf("no events recorded in the durable log")
	}
	for i, ev := range logged {
		if ev.Actor == nil {
			t.Fatalf("logged[%d] (%s): Actor is nil, want Alice — appendEvent must stamp the loaded session's owner", i, ev.Type)
		}
		if *ev.Actor != *alice {
			t.Fatalf("logged[%d] (%s): Actor = %+v, want %+v", i, ev.Type, *ev.Actor, *alice)
		}
	}

	// The loop half: a second owned session, drained straight off Run.Events() so
	// no relay (and therefore no appendEvent) is involved.
	direct, err := svc.CreateSession(ctx, "/ws", session.ModeDefault, session.Limits{MaxTurns: 4})
	if err != nil {
		t.Fatalf("CreateSession (direct): %v", err)
	}
	if got := ownerOf(direct.Owner); got != *alice {
		t.Fatalf("direct session owner = %+v, want %+v (the fixture must be owned, or the nil-Actor half is vacuous)", got, *alice)
	}
	run, err := svc.StartRunContent(context.Background(), direct.ID, "go", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	emitted := 0
	for ev := range run.Events() {
		emitted++
		if ev.Actor != nil {
			t.Fatalf("loop-emitted %s carries Actor=%+v: the loop is storage-agnostic and must never stamp it (only appendEvent does)", ev.Type, *ev.Actor)
		}
	}
	svc.FinishRun(direct.ID, run)
	if emitted == 0 {
		t.Fatalf("the direct run emitted no events; the nil-Actor half is vacuous")
	}
}

// TestCallerIdentity_Scenario4_EventActorLogOnly pins AC4.2: the actor annotation
// is LOG-ONLY. It does not reach the client wire (the proto Event has no principal
// field, and no relayed event carries Alice's identity), and it does not perturb
// event-sourced rehydration (eventsource.Fold ignores Actor: a stream carrying
// Bob's actor folds to a session identical to the same stream without it, and the
// fold never derives an owner from it — the folded session keeps whatever owner its
// caller restored from the snapshot).
func TestCallerIdentity_Scenario4_EventActorLogOnly(t *testing.T) {
	// --- half 1: not on the client wire -------------------------------------
	ctx := session.WithPrincipal(context.Background(), alice)
	log := memstore.NewEventLog()
	svc := eventActorService(t, log)
	sess, err := svc.CreateSession(ctx, "/ws", session.ModeDefault, session.Limits{MaxTurns: 4})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	wire := driveConverse(t, svc, sess.ID)
	if len(wire) == 0 {
		t.Fatalf("no events on the client wire; the omission half is vacuous")
	}
	// The log DID stamp them (so this is an omission at the wire, not a missing stamp).
	if logged := readEventLog(t, log, sess.ID); len(logged) == 0 || logged[0].Actor == nil {
		t.Fatalf("durable log must carry the actor (otherwise the wire-omission assertion is vacuous)")
	}
	for i, ev := range wire {
		blob, merr := protojson.Marshal(ev)
		if merr != nil {
			t.Fatalf("marshal wire event: %v", merr)
		}
		if strings.Contains(string(blob), alice.Subject) || strings.Contains(string(blob), alice.Issuer) {
			t.Fatalf("wire[%d] (%s) leaks the actor identity: %s", i, ev.GetType(), blob)
		}
	}
	// Structural: the proto Event message carries NO principal-bearing field at all,
	// so toProto has nothing to map. This fails the moment someone adds one.
	assertNoPrincipalField(t, (&mecatlv1.Event{}).ProtoReflect().Descriptor())

	// --- half 2: the fold ignores it ----------------------------------------
	base := []session.Event{
		{Type: session.EvSessionInit},
		{Type: session.EvUserPrompt, Turn: 0, UserPrompt: &session.UserPromptPayload{Text: "go"}},
		{Type: session.EvTurnStart, Turn: 0},
		{Type: session.EvMessageDelta, Turn: 0, Text: "all done"},
		{Type: session.EvResult, Turn: 0, Result: &session.ResultPayload{Stop: session.StopEndTurn}},
	}
	stamped := make([]session.Event, len(base))
	copy(stamped, base)
	for i := range stamped {
		stamped[i].Actor = bob // a DIFFERENT principal than the snapshot owner
	}
	meta := eventsource.SessionMeta{
		ID: "s-fold", Mode: session.ModeDefault, Workspace: "/ws", CreatedAt: time.Unix(0, 0),
	}
	plain, err := eventsource.Fold(meta, evSeq(base))
	if err != nil {
		t.Fatalf("Fold (no actor): %v", err)
	}
	withActor, err := eventsource.Fold(meta, evSeq(stamped))
	if err != nil {
		t.Fatalf("Fold (actor-stamped): %v", err)
	}
	if withActor.Owner != nil {
		t.Fatalf("Fold derived an owner (%+v) from Event.Actor; the annotation is log-only and must never be a reconstruction input", *withActor.Owner)
	}
	if a, b := mustJSON(t, plain), mustJSON(t, withActor); a != b {
		t.Fatalf("Event.Actor perturbed the fold:\n without = %s\n with    = %s", a, b)
	}
	// The folded session keeps the owner its caller restores from the snapshot: the
	// fold neither requires nor overwrites it.
	if err := withActor.RestoreLabels(alice, ""); err != nil {
		t.Fatalf("RestoreLabels on a folded session: %v", err)
	}
	if got := ownerOf(withActor.Owner); got != *alice {
		t.Fatalf("folded session owner = %+v, want the snapshot-restored %+v", got, *alice)
	}
}

// TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent pins AC4.5: an event for a
// pre-ship (ownerless) session records a NIL actor — never a fabricated one.
func TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent(t *testing.T) {
	log := memstore.NewEventLog()
	svc := eventActorService(t, log)
	// No principal in the context: the pre-ship / no-auth path.
	sess, err := svc.CreateSession(context.Background(), "/ws", session.ModeDefault, session.Limits{MaxTurns: 4})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if sess.Owner != nil {
		t.Fatalf("fixture session must be ownerless, got owner %+v", *sess.Owner)
	}
	driveConverse(t, svc, sess.ID)

	logged := readEventLog(t, log, sess.ID)
	if len(logged) == 0 {
		t.Fatalf("no events recorded for the ownerless session")
	}
	for i, ev := range logged {
		if ev.Actor != nil {
			t.Fatalf("logged[%d] (%s): ownerless session got a FABRICATED actor %+v; absence must stay absent", i, ev.Type, *ev.Actor)
		}
	}
}

// assertNoPrincipalField fails if md carries any field named "actor"/"principal"
// or any field whose message type is mecatl.v1.Principal.
func assertNoPrincipalField(t *testing.T, md protoreflect.MessageDescriptor) {
	t.Helper()
	fields := md.Fields()
	for i := 0; i < fields.Len(); i++ {
		f := fields.Get(i)
		if f.Name() == "actor" || f.Name() == "principal" {
			t.Fatalf("%s.%s exists: the event actor is LOG-ONLY and must not reach the client wire", md.FullName(), f.Name())
		}
		if f.Kind() == protoreflect.MessageKind && f.Message().FullName() == "mecatl.v1.Principal" {
			t.Fatalf("%s.%s is a mecatl.v1.Principal: the event actor is LOG-ONLY and must not reach the client wire", md.FullName(), f.Name())
		}
	}
}

// evSeq adapts a slice of events to the iterator Fold consumes.
func evSeq(evs []session.Event) iter.Seq2[session.Event, error] {
	return func(yield func(session.Event, error) bool) {
		for _, ev := range evs {
			if !yield(ev, nil) {
				return
			}
		}
	}
}

// mustJSON serializes v for a structural equality comparison.
func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(b)
}
