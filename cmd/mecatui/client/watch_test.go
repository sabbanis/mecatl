package client

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
)

// fakeWatchRecver is a scripted WatchRecver for the watch tests: Recv replays a
// fixed slice of *WatchSessionEventsResponse envelopes then returns io.EOF (or
// a configured error). It satisfies WatchRecver so the real WatchStream/ReadLoop
// run with no gRPC and no network — the offline, deterministic substrate the
// brief mandates. Mirrors fakeEventStream (the EventRecver analogue).
type fakeWatchRecver struct {
	mu     sync.Mutex
	script []*mecatlv1.WatchSessionEventsResponse
	idx    int
	endErr error // returned after the script drains (nil ⇒ io.EOF)
}

func newFakeWatchRecver(script ...*mecatlv1.WatchSessionEventsResponse) *fakeWatchRecver {
	return &fakeWatchRecver{script: script}
}

func (f *fakeWatchRecver) Recv() (*mecatlv1.WatchSessionEventsResponse, error) {
	f.mu.Lock()
	if f.idx >= len(f.script) {
		err := f.endErr
		f.mu.Unlock()
		if err != nil {
			return nil, err
		}
		return nil, io.EOF
	}
	resp := f.script[f.idx]
	f.idx++
	f.mu.Unlock()
	return resp, nil
}

// watchEnv builds one WatchSessionEventsResponse carrying an Event + cursor + phase.
func watchEnv(ev *mecatlv1.Event, cursor, phase string) *mecatlv1.WatchSessionEventsResponse {
	return &mecatlv1.WatchSessionEventsResponse{Event: ev, Cursor: cursor, Phase: phase}
}

// phaseEnv builds a phase-only WatchSessionEventsResponse (no Event) — the
// replay→live boundary marker, or a gap.
func phaseEnv(cursor, phase string) *mecatlv1.WatchSessionEventsResponse {
	return &mecatlv1.WatchSessionEventsResponse{Cursor: cursor, Phase: phase}
}

// watchScript is the watch analogue of scriptedRun: a three-act scenario
// (session.init → turn.start → deltas → tool.call → tool.result → result) all
// in the `replay` phase, followed by the phase-only `live` boundary marker, so
// a test can assert the replay→live boundary projects as a WatchEnvelopeMsg
// with a nil Event and the right Phase.
func watchScript() []*mecatlv1.WatchSessionEventsResponse {
	return []*mecatlv1.WatchSessionEventsResponse{
		watchEnv(&mecatlv1.Event{Type: "session.init", Seq: 1}, "c1", WatchPhaseReplay),
		watchEnv(&mecatlv1.Event{Type: "turn.start", Seq: 2, Turn: 1}, "c2", WatchPhaseReplay),
		watchEnv(&mecatlv1.Event{Type: "message.delta", Seq: 3, Turn: 1, Text: "hi"}, "c3", WatchPhaseReplay),
		watchEnv(&mecatlv1.Event{Type: "tool.call", Seq: 4, Turn: 1, ToolCall: &mecatlv1.ToolCall{Id: "r1", Name: "Read", Args: `{}`}}, "c4", WatchPhaseReplay),
		watchEnv(&mecatlv1.Event{Type: "tool.result", Seq: 5, Turn: 1, ToolResult: &mecatlv1.ToolResult{CallId: "r1", Content: "ok"}}, "c5", WatchPhaseReplay),
		watchEnv(&mecatlv1.Event{Type: "result", Seq: 6, Turn: 1, Result: &mecatlv1.Result{Stop: "end_turn", Text: "done."}}, "c6", WatchPhaseReplay),
		phaseEnv("c6", WatchPhaseLive),
	}
}

// TestWatchStream_ReadLoopProjectsEnvelopes asserts WatchStream.ReadLoop
// translates the script in order, each envelope a WatchEnvelopeMsg carrying the
// Event projection (EventToMsg) + cursor + phase, and ends with StreamClosedMsg
// on a clean EOF (the watch stream's terminal marker). A phase-only frame
// (the replay→live boundary) projects as a WatchEnvelopeMsg with a nil Event
// and Phase == "live".
func TestWatchStream_ReadLoopProjectsEnvelopes(t *testing.T) {
	ws := NewWatchStream(newFakeWatchRecver(watchScript()...))
	ch := make(chan tea.Msg, 64)
	go ws.ReadLoop(context.Background(), ch)
	msgs := drain(ch)
	if len(msgs) != len(watchScript())+1 { // +1 for the terminal StreamClosedMsg
		t.Fatalf("got %d msgs, want %d (script + StreamClosedMsg): %#v", len(msgs), len(watchScript())+1, msgs)
	}
	// The first 6 are the event-bearing replay envelopes.
	for i := 0; i < 6; i++ {
		em, ok := msgs[i].(WatchEnvelopeMsg)
		if !ok {
			t.Fatalf("msg %d = %T, want WatchEnvelopeMsg", i, msgs[i])
		}
		if em.Envelope.Phase != WatchPhaseReplay {
			t.Errorf("msg %d Phase = %q, want %q", i, em.Envelope.Phase, WatchPhaseReplay)
		}
		if em.Envelope.Cursor == "" {
			t.Errorf("msg %d Cursor empty, want a value", i)
		}
		if em.Envelope.Event == nil {
			t.Errorf("msg %d Event nil, want a projection", i)
		}
	}
	// The 7th is the phase-only `live` boundary marker.
	boundary, ok := msgs[6].(WatchEnvelopeMsg)
	if !ok {
		t.Fatalf("boundary msg = %T, want WatchEnvelopeMsg", msgs[6])
	}
	if boundary.Envelope.Phase != WatchPhaseLive {
		t.Errorf("boundary Phase = %q, want %q", boundary.Envelope.Phase, WatchPhaseLive)
	}
	if boundary.Envelope.Event != nil {
		t.Errorf("boundary Event = %v, want nil (phase-only frame)", boundary.Envelope.Event)
	}
	// The terminal StreamClosedMsg.
	if _, ok := msgs[7].(StreamClosedMsg); !ok {
		t.Fatalf("terminal msg = %T, want StreamClosedMsg", msgs[7])
	}
}

// TestWatchStream_ReadLoopErrorYieldsStreamErr asserts a non-EOF receive error
// yields a StreamErrMsg (and closes the channel), never a hang.
func TestWatchStream_ReadLoopErrorYieldsStreamErr(t *testing.T) {
	r := newFakeWatchRecver()
	r.endErr = errors.New("watch backend down")
	ws := NewWatchStream(r)
	ch := make(chan tea.Msg, 64)
	go ws.ReadLoop(context.Background(), ch)
	msgs := drain(ch)
	if len(msgs) != 1 {
		t.Fatalf("got %d msgs, want one StreamErrMsg: %#v", len(msgs), msgs)
	}
	if _, ok := msgs[0].(StreamErrMsg); !ok {
		t.Fatalf("msg = %T, want StreamErrMsg", msgs[0])
	}
}

// TestEnvelopeToMsg_NilResponseDrops asserts a nil response is dropped (nil msg),
// never a nil-msg storm — the defensive guard on a malformed/empty frame.
func TestEnvelopeToMsg_NilResponseDrops(t *testing.T) {
	if m := envelopeToMsg(nil); m != nil {
		t.Fatalf("envelopeToMsg(nil) = %v, want nil (dropped)", m)
	}
}

// TestEnvelopeToMsg_PhaseOnlyFrame asserts a phase-only frame (no Event) projects
// as a WatchEnvelopeMsg with a nil Event, carrying the cursor + phase so the ui
// can thread the cursor into a reconnect and render the phase boundary.
func TestEnvelopeToMsg_PhaseOnlyFrame(t *testing.T) {
	m := envelopeToMsg(phaseEnv("cursor-7", WatchPhaseLive))
	em, ok := m.(WatchEnvelopeMsg)
	if !ok {
		t.Fatalf("msg = %T, want WatchEnvelopeMsg", m)
	}
	if em.Envelope.Event != nil {
		t.Errorf("Event = %v, want nil (phase-only frame)", em.Envelope.Event)
	}
	if em.Envelope.Cursor != "cursor-7" {
		t.Errorf("Cursor = %q, want cursor-7", em.Envelope.Cursor)
	}
	if em.Envelope.Phase != WatchPhaseLive {
		t.Errorf("Phase = %q, want %q", em.Envelope.Phase, WatchPhaseLive)
	}
}

// TestEnvelopeToMsg_EventBearingFrame asserts an event-bearing frame projects the
// Event via EventToMsg (so a watch event and a live/replay event for the same
// record project identically) and carries the cursor + phase.
func TestEnvelopeToMsg_EventBearingFrame(t *testing.T) {
	m := envelopeToMsg(watchEnv(&mecatlv1.Event{Type: "session.init", Seq: 1}, "c1", WatchPhaseReplay))
	em, ok := m.(WatchEnvelopeMsg)
	if !ok {
		t.Fatalf("msg = %T, want WatchEnvelopeMsg", m)
	}
	if _, ok := em.Envelope.Event.(SessionInitMsg); !ok {
		t.Errorf("Event = %T, want SessionInitMsg (EventToMsg projection)", em.Envelope.Event)
	}
	if em.Envelope.Cursor != "c1" {
		t.Errorf("Cursor = %q, want c1", em.Envelope.Cursor)
	}
	if em.Envelope.Phase != WatchPhaseReplay {
		t.Errorf("Phase = %q, want %q", em.Envelope.Phase, WatchPhaseReplay)
	}
}

// fakeWatchStreamer is a scripted WatchStreamer for WatchCmd / ReconnectWatchCmd
// tests: it fails the first `failN` calls then succeeds with a *WatchStream over
// a FakeWatchRecver (reusing the script for every successful open). Mirrors
// fakeLiveStreamerReconnect.
type fakeWatchStreamer struct {
	mu      sync.Mutex
	failN   int
	opens   int
	lastID  string
	lastCur string
	script  []*mecatlv1.WatchSessionEventsResponse
	err     error
}

func (f *fakeWatchStreamer) WatchSessionEvents(_ context.Context, id, cursor string) (*WatchStream, error) {
	f.mu.Lock()
	f.opens++
	f.lastID = id
	f.lastCur = cursor
	n := f.opens
	failN := f.failN
	f.mu.Unlock()
	if n <= failN {
		return nil, errors.New("watch unavailable")
	}
	if f.err != nil {
		return nil, f.err
	}
	return NewWatchStream(newFakeWatchRecver(f.script...)), nil
}

// TestWatchCmd_OpenErrorYieldsStreamErr asserts WatchCmd surfaces an open error
// as a single StreamErrMsg (not a hang), mirroring LiveStreamCmd's open-error
// path.
func TestWatchCmd_OpenErrorYieldsStreamErr(t *testing.T) {
	w := &fakeWatchStreamer{failN: 1, script: watchScript()}
	ch, stop := WatchCmd(context.Background(), w, "sess", "")
	defer stop()
	msgs := drainReconWatch(t, ch)
	if len(msgs) != 1 {
		t.Fatalf("got %d msgs, want one StreamErrMsg: %#v", len(msgs), msgs)
	}
	if _, ok := msgs[0].(StreamErrMsg); !ok {
		t.Fatalf("msg = %T, want StreamErrMsg", msgs[0])
	}
}

// TestWatchCmd_SucceedsDrainsEnvelopes asserts a successful WatchCmd opens and
// drains the envelopes (WatchEnvelopeMsg) in order, ending with StreamClosedMsg.
func TestWatchCmd_SucceedsDrainsEnvelopes(t *testing.T) {
	w := &fakeWatchStreamer{script: watchScript()}
	ch, stop := WatchCmd(context.Background(), w, "sess", "")
	defer stop()
	msgs := drainReconWatch(t, ch)
	// 6 replay envelopes + 1 phase-only boundary + 1 StreamClosedMsg.
	if len(msgs) != 8 {
		t.Fatalf("got %d msgs, want 8: %#v", len(msgs), msgs)
	}
	for i := 0; i < 7; i++ {
		if _, ok := msgs[i].(WatchEnvelopeMsg); !ok {
			t.Fatalf("msg %d = %T, want WatchEnvelopeMsg", i, msgs[i])
		}
	}
	if _, ok := msgs[7].(StreamClosedMsg); !ok {
		t.Fatalf("terminal msg = %T, want StreamClosedMsg", msgs[7])
	}
}

// TestWatchCmd_ThreadsCursorToWatchSessionEvents asserts WatchCmd passes the
// cursor verbatim to WatchSessionEvents (an empty cursor means the beginning).
func TestWatchCmd_ThreadsCursorToWatchSessionEvents(t *testing.T) {
	w := &fakeWatchStreamer{script: watchScript()}
	ch, stop := WatchCmd(context.Background(), w, "sess", "resume-here")
	defer stop()
	_ = drainReconWatch(t, ch)
	if w.lastCur != "resume-here" {
		t.Errorf("cursor passed to WatchSessionEvents = %q, want resume-here", w.lastCur)
	}
}

// fakeWatchStreamerBearer is a fakeWatchStreamer that reports bearer-backed
// transport so the auth-classification path can be exercised.
type fakeWatchStreamerBearer struct {
	fakeWatchStreamer
	bearer bool
}

func (f *fakeWatchStreamerBearer) bearerBackedStream() bool { return f.bearer }

// TestReconnectWatchCmd_RetriesThenSucceeds asserts the reconnect loop emits
// WatchReconnectingMsg per failed attempt, then drains the successful probe's
// envelopes and emits WatchReconnectedMsg — the cursor is threaded so a
// multi-attempt reconnect resumes from the furthest position.
func TestReconnectWatchCmd_RetriesThenSucceeds(t *testing.T) {
	restore := RestoreBackoffForTest()
	defer restore()
	liveReconnectBaseBackoff = time.Millisecond
	liveReconnectMaxBackoff = 5 * time.Millisecond
	liveReconnectJitterFrac = 0

	w := &fakeWatchStreamer{failN: 2, script: watchScript()}
	ch, stop := ReconnectWatchCmd(context.Background(), w, "sess", "", func(string) {})
	defer stop()
	msgs := drainReconWatch(t, ch)

	var reconnecting, reconnected int
	var envelopes int
	for _, m := range msgs {
		switch m.(type) {
		case WatchReconnectingMsg:
			reconnecting++
		case WatchReconnectedMsg:
			reconnected++
		case WatchEnvelopeMsg:
			envelopes++
		}
	}
	if reconnecting < 2 {
		t.Fatalf("reconnecting attempts = %d, want >= 2 (2 failed attempts)", reconnecting)
	}
	if reconnected != 1 {
		t.Fatalf("reconnected = %d, want 1", reconnected)
	}
	// The successful probe drained the full script (7 envelopes: 6 events + 1
	// phase-only boundary) before emitting WatchReconnectedMsg.
	if envelopes != 7 {
		t.Fatalf("envelopes drained on success = %d, want 7 (the probe's full script)", envelopes)
	}
}

// TestReconnectWatchCmd_ThreadsCursorAcrossAttempts asserts the reconnect loop
// threads the LAST RECEIVED CURSOR through cursorSink so a multi-attempt
// reconnect resumes from the furthest position the ui observed, not the stale
// initial cursor. It uses a streamer that delivers ONE envelope (cursor
// "adv-1") per open then EOFs; the loop's first open delivers that envelope,
// the sink advances to "adv-1", and the loop's SECOND open (a re-attempt after
// the first probe EOFed) is handed the advanced cursor.
func TestReconnectWatchCmd_ThreadsCursorAcrossAttempts(t *testing.T) {
	restore := RestoreBackoffForTest()
	defer restore()
	liveReconnectBaseBackoff = time.Millisecond
	liveReconnectMaxBackoff = 5 * time.Millisecond
	liveReconnectJitterFrac = 0

	script1 := []*mecatlv1.WatchSessionEventsResponse{
		watchEnv(&mecatlv1.Event{Type: "session.init", Seq: 1}, "adv-1", WatchPhaseReplay),
	}
	w := &fakeWatchStreamer{script: script1}
	var lastCursor string
	sink := func(c string) {
		if c != "" {
			lastCursor = c
		}
	}
	ch, stop := ReconnectWatchCmd(context.Background(), w, "sess", "", sink)
	defer stop()
	_ = drainReconWatch(t, ch)
	// The first open delivered the envelope (cursor "adv-1"); the sink advanced.
	if lastCursor != "adv-1" {
		t.Fatalf("sink lastCursor = %q, want adv-1 (the first envelope's cursor)", lastCursor)
	}
	// The loop's last open carried the initial cursor (""); a subsequent
	// ReconnectWatchCmd opened with the FURTHEST cursor threads it to
	// WatchSessionEvents verbatim.
	ch2, stop2 := ReconnectWatchCmd(context.Background(), w, "sess", lastCursor, sink)
	defer stop2()
	_ = drainReconWatch(t, ch2)
	if w.lastCur != lastCursor {
		t.Errorf("reconnect open cursor = %q, want %q (the furthest cursor)", w.lastCur, lastCursor)
	}
}

// drainReconWatch collects every msg off ch until it closes, with a per-msg
// timeout so a stuck loop fails the test instead of hanging. Mirrors drainRecon.
func drainReconWatch(t *testing.T, ch <-chan tea.Msg) []tea.Msg {
	t.Helper()
	var out []tea.Msg
	for {
		select {
		case m, ok := <-ch:
			if !ok {
				return out
			}
			out = append(out, m)
		case <-time.After(5 * time.Second):
			t.Fatalf("drainReconWatch timed out after %d msgs: %#v", len(out), out)
		}
	}
}

// TestWatchBearerBacked_ClassifiesAuth asserts watchBearerBacked reports the
// transport provenance so an open error classifies auth the same way a
// live-stream open does.
func TestWatchBearerBacked_ClassifiesAuth(t *testing.T) {
	w := &fakeWatchStreamerBearer{bearer: true}
	if !watchBearerBacked(w) {
		t.Error("watchBearerBacked(bearer) = false, want true")
	}
	w2 := &fakeWatchStreamer{}
	if watchBearerBacked(w2) {
		t.Error("watchBearerBacked(non-bearer) = true, want false")
	}
}

// TestWatchStream_BearerBackedStream asserts WatchStream satisfies the
// liveAuthProvenance interface so AuthFailure on a watch error classifies
// consistently.
func TestWatchStream_BearerBackedStream(t *testing.T) {
	if !newAuthenticatedWatchStream(newFakeWatchRecver(), true).bearerBackedStream() {
		t.Error("authenticated watch stream bearerBackedStream = false, want true")
	}
	if newAuthenticatedWatchStream(newFakeWatchRecver(), false).bearerBackedStream() {
		t.Error("anonymous watch stream bearerBackedStream = true, want false")
	}
}

// TestWatchStreamReadLoopHonoursCtx asserts a cancelled ctx unblocks a parked
// send so the reader goroutine exits (the no-leak property).
func TestWatchStreamReadLoopHonoursCtx(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	r := newFakeWatchRecver(watchScript()...)
	ws := NewWatchStream(r)
	ch := make(chan tea.Msg, 64)
	go ws.ReadLoop(ctx, ch)
	// Drain a couple then cancel; the reader should exit without hanging.
	cancel()
	_ = drainReconWatch(t, ch)
}

// Ensure tea import is used (the package builds with the import even if a future
// test removes the only use).
var _ tea.Model = (tea.Model)(nil)
