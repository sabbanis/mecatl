package client

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	tea "charm.land/bubbletea/v2"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
)

// The durable watch surface (ADR 0250, ADR 0321 Scenario 3): the
// replay-then-follow stream a reconnecting mecatui consumes to reattach to a
// server-owned detached run. It is the WatchSessionEvents analogue of the
// LiveStreamCmd/ReconnectLiveCmd pair: WatchCmd opens the stream synchronously
// and runs its ReadLoop on a goroutine; ReconnectWatchCmd is the bounded-backoff
// reconnect loop that threads the LAST RECEIVED CURSOR so a re-attach resumes
// from exactly the next record (at-least-once across a reconnect). As with the
// rest of this package, NO proto type leaks past this file — the ui drains
// proto-free tea.Msgs (WatchEnvelopeMsg + the SAME event projections
// EventToMsg yields) from the returned channel.

// WatchRecver is the minimal receive side of a WatchSessionEvents server
// stream: it yields *WatchSessionEventsResponse envelopes (Event + Cursor +
// Phase). The generated grpc.ServerStreamingClient[WatchSessionEventsResponse]
// satisfies it; tests supply a scripted fake. It is the watch analogue of
// EventRecver (which yields *Event directly for StreamSessionEvents/StreamSessionLive).
type WatchRecver interface {
	Recv() (*mecatlv1.WatchSessionEventsResponse, error)
}

// WatchStream wraps one open WatchSessionEvents stream: a receive side ONLY
// (read-only, no Send side — the watch is a server-streaming RPC, unlike the
// bidi Converse Stream). It is the watch analogue of EventStream, but the
// envelope carries a Cursor + Phase alongside the Event so a reconnect can
// resume from the last-received position and the ui can render the
// replay→live boundary.
type WatchStream struct {
	recv WatchRecver
	// bearerBacked is transport provenance, not credential material. The watch
	// is a read-only follow; a bearer-backed transport still classifies auth
	// failures so the ui can open auth recovery, symmetric with the live feed.
	bearerBacked bool
}

// NewWatchStream wraps a WatchRecver in a WatchStream. Pass the generated
// grpc.ServerStreamingClient[WatchSessionEventsResponse] from WatchSessionEvents
// in production; pass a fake WatchRecver in tests.
func NewWatchStream(recv WatchRecver) *WatchStream {
	return &WatchStream{recv: recv}
}

func newAuthenticatedWatchStream(recv WatchRecver, bearerBacked bool) *WatchStream {
	return &WatchStream{recv: recv, bearerBacked: bearerBacked}
}

// BearerBackedStream reports the transport provenance the auth classifier reads.
// It satisfies the liveAuthProvenance interface so AuthFailure on a watch
// receive error classifies the same way a live-stream error does.
func (s *WatchStream) BearerBackedStream() bool {
	return s != nil && s.bearerBacked
}

// WatchSessionEvents opens the durable replay-then-follow watch (ADR 0250) for
// session id, resuming after the opaque cursor. An EMPTY cursor means the
// beginning of the log (the common first-attach case). The watch replays
// everything already durable, emits a single phase-only `live` boundary frame,
// then follows the tail. The returned *WatchStream wraps the server stream;
// its ReadLoop translates envelopes into tea.Msgs the ui drains. A server with
// no durable EventLog returns gRPC UNIMPLEMENTED → an error here.
func (c *Client) WatchSessionEvents(ctx context.Context, id, cursor string) (*WatchStream, error) {
	stream, err := c.svc.WatchSessionEvents(ctx, &mecatlv1.WatchSessionEventsRequest{SessionId: id, Cursor: cursor})
	if err != nil {
		return nil, fmt.Errorf("watch session events: %w", err)
	}
	return newAuthenticatedWatchStream(stream, c.bearerBacked), nil
}

// WatchEnvelope is the proto-free projection of ONE WatchSessionEventsResponse:
// what happened (the Event, nil on a phase-only frame), where the client now is
// (the opaque Cursor to hand back on a reconnect), and which phase of the watch
// it arrived in (`replay`/`live`/`gap`, an open string). It is the watch
// analogue of the server-side server.WatchEnvelope, stripped of proto so the ui
// never imports contracts/gen. The Cursor is threaded through ReconnectWatchCmd
// so a re-attach resumes from exactly the next record (at-least-once).
type WatchEnvelope struct {
	// Event is the recorded event's tea.Msg projection (via EventToMsg), or nil
	// on a phase-only frame (the single replay→live boundary marker, and every
	// gap frame). The ui reduces it through the SAME updateStreamEvent path a
	// live/replay event takes so a watch event projects identically.
	Event tea.Msg
	// Cursor is the opaque resume token positioned AFTER this envelope. Hand
	// it back verbatim on a reconnect; never parse, build, or edit one.
	Cursor string
	// Phase is one of the WatchPhase* values (an open string): `replay`
	// (already durable when the watch attached), `live` (appended while
	// following), or `gap` (a position whose append is known to have failed).
	// Tolerate an unknown value rather than treating it as an error.
	Phase string
}

// WatchPhaseReplay marks a record that was already durable when the watch attached.
const WatchPhaseReplay = "replay"

// WatchPhaseLive marks a record appended while the watch was following, and the
// ONE phase-only frame that announces the replay→live boundary.
const WatchPhaseLive = "live"

// WatchPhaseGap marks a position where a durable append is known to have failed.
const WatchPhaseGap = "gap"

// WatchEnvelopeMsg carries ONE watch envelope to the Bubble Tea reducer. It is
// the unit the ui's updateWatchMsg drains: a phase-only frame (Event == nil)
// drives the replay→live boundary indicator; an event-bearing frame reduces
// through the SAME updateStreamEvent path a live/replay event takes. It carries
// the Cursor so the ui can thread it into a ReconnectWatchCmd on a stream drop.
type WatchEnvelopeMsg struct {
	Envelope WatchEnvelope
}

// WatchReconnectingMsg marks one attempt of the watch reconnect loop: the watch
// stream dropped (StreamClosedMsg/StreamErrMsg on the watch reader) and the
// client is recovering it with bounded exponential backoff, threading the last
// received cursor so the re-attach resumes from exactly the next record. It
// carries the 1-based Attempt index and the Err that closed the previous
// attempt (nil on the first). The ui renders a `⟳ reattaching to running
// session…` footer from it. Parallels LiveReconnectingMsg.
type WatchReconnectingMsg struct {
	Attempt int
	Err     error
}

// WatchReconnectedMsg marks a successful watch reopen: the reconnect loop
// re-opened WatchSessionEvents after the cursor-threaded resume. The ui clears
// the reattaching footer and re-arms the watch reader off a FRESH channel — the
// reconnect channel's job is done. Parallels LiveReconnectedMsg.
type WatchReconnectedMsg struct{}

// WatchStreamer opens the durable replay-then-follow watch for a session.
// Satisfied by *Client; split out so the ui is injectable with a fake for
// offline tests, parallel to LiveStreamer / SessionReplayer.
type WatchStreamer interface {
	WatchSessionEvents(ctx context.Context, id, cursor string) (*WatchStream, error)
}

var _ WatchStreamer = (*Client)(nil)

// ReadLoop runs the receive loop on its OWN goroutine over the watch stream: it
// drains Recv, translates each envelope via envelopeToMsg, pushes tea.Msgs onto
// out, then closes out when the stream ends. A clean EOF yields StreamClosedMsg;
// any other error yields StreamErrMsg (with auth classification when the
// transport is bearer-backed); both close the channel so WaitForMsg stops
// re-arming. It is the watch analogue of EventStream.ReadLoop (which yields
// *Event directly); here the envelope is unwrapped and the Event projected via
// EventToMsg so a watch event projects identically to a live/replay event for
// the SAME downstream reducer. A phase-only frame (no Event) yields a
// WatchEnvelopeMsg with a nil Event so the ui can render the replay→live
// boundary without waiting for an event that may never arrive on an idle session.
//
// Every send selects on ctx.Done() as well as out, so the goroutine can never
// wedge if the ui drops the channel (e.g. a session switch). Pass the run's
// context — cancelling it unblocks and exits the reader.
func (s *WatchStream) ReadLoop(ctx context.Context, out chan<- tea.Msg) {
	defer close(out)
	for {
		resp, err := s.recv.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				emit(ctx, out, StreamClosedMsg{})
				return
			}
			reason, classified := AuthFailure(err, s.bearerBacked)
			emit(ctx, out, StreamErrMsg{Err: err, AuthReason: reason, Transient: !classified && TransientStreamErr(err)})
			return
		}
		if m := envelopeToMsg(resp); m != nil {
			if !emit(ctx, out, m) {
				return // context cancelled — stop reading
			}
		}
	}
}

// envelopeToMsg projects ONE WatchSessionEventsResponse onto a tea.Msg: a
// phase-only frame (no Event) yields a WatchEnvelopeMsg with a nil Event (the
// replay→live boundary, or a gap); an event-bearing frame yields a
// WatchEnvelopeMsg whose Event is the EventToMsg projection (so a watch event
// and a live/replay event for the same record project identically). Returns nil
// for a nil response (dropped, no msg) so a malformed/empty frame can never
// produce a nil-msg storm. The Cursor + Phase always ride on the envelope so
// the ui can thread the cursor into a reconnect and render the phase.
func envelopeToMsg(resp *mecatlv1.WatchSessionEventsResponse) tea.Msg {
	if resp == nil {
		return nil
	}
	env := WatchEnvelope{
		Cursor: resp.GetCursor(),
		Phase:  resp.GetPhase(),
	}
	if ev := resp.GetEvent(); ev != nil {
		env.Event = EventToMsg(ev)
	}
	return WatchEnvelopeMsg{Envelope: env}
}

// WatchCmd opens the durable watch for session id synchronously, then runs
// ReadLoop on a goroutine. It returns the message channel and an idempotent
// teardown function. It is the watch analogue of LiveStreamCmd: the SAME shape
// (synchronous open, goroutine ReadLoop, cancel-on-stop), but over
// WatchSessionEvents (replay-then-follow) rather than StreamSessionLive
// (live-only). A nil/empty cursor means the beginning of the log. Parallels
// LiveStreamCmd.
func WatchCmd(ctx context.Context, w WatchStreamer, id, cursor string) (ch chan tea.Msg, stop func()) {
	ctx, cancel := context.WithCancel(ctx)
	ch = make(chan tea.Msg, 64)
	var once sync.Once
	stop = func() { once.Do(cancel) }

	ws, err := w.WatchSessionEvents(ctx, id, cursor)
	if err != nil {
		reason, classified := AuthFailure(err, watchBearerBacked(w))
		go func() {
			defer close(ch)
			emit(ctx, ch, StreamErrMsg{Err: err, AuthReason: reason, Transient: !classified && TransientStreamErr(err)})
		}()
		return ch, stop
	}
	go ws.ReadLoop(ctx, ch)
	return ch, stop
}

// watchBearerBacked reports whether the watch streamer's transport is
// bearer-backed, so an open error classifies auth the same way a live-stream
// open does. It is the watch analogue of liveBearerBacked.
func watchBearerBacked(w WatchStreamer) bool {
	p, ok := w.(liveAuthProvenance)
	return ok && p.BearerBackedStream()
}

// ReconnectWatchCmd opens the watch reconnect loop for session id: a
// bounded-exponential-backoff loop that, per attempt, (a) re-opens
// WatchSessionEvents threading the LAST RECEIVED CURSOR so the re-attach
// resumes from exactly the next record (at-least-once across a reconnect), then
// (b) on a successful open drains the probe's envelopes onto out and emits
// WatchReconnectedMsg (the ui re-arms a FRESH watch channel). On failure it
// records the error and backs off. It emits WatchReconnectingMsg{Attempt, Err}
// at the top of each attempt. The loop stops when ctx is done (session switch /
// TUI exit). It is the watch analogue of ReconnectLiveCmd, differing in that it
// threads the cursor (the live feed has no cursor — it is process-local and
// non-durable) so a watch reconnect loses NOTHING the durable log recorded.
// The reconnect loop advances ITS OWN local cursor per envelope it drains, so a
// multi-attempt reconnect resumes from the furthest position this loop reached,
// never falling back to the stale initial cursor — no caller-supplied sink, so
// no model state can be mutated off the Update goroutine (the ui threads its
// own watchCursor into initialCursor and advances it only in its reducer).
// Parallels ReconnectLiveCmd.
func ReconnectWatchCmd(ctx context.Context, w WatchStreamer, id, initialCursor string) (ch chan tea.Msg, stop func()) {
	return reconnectWatchCmd(ctx, w, id, initialCursor, 0)
}

// ReconnectWatchCmdFromAttempt continues the watch reconnect sequence after a
// successful probe/re-arm. The first-ever failure remains immediate; a later
// reader failure keeps its attempt number and backoff. Parallels
// ReconnectLiveCmdFromAttempt.
func ReconnectWatchCmdFromAttempt(ctx context.Context, w WatchStreamer, id, initialCursor string, priorAttempt int) (ch chan tea.Msg, stop func()) {
	return reconnectWatchCmd(ctx, w, id, initialCursor, priorAttempt)
}

func reconnectWatchCmd(ctx context.Context, w WatchStreamer, id, initialCursor string, priorAttempt int) (ch chan tea.Msg, stop func()) {
	ctx, cancel := context.WithCancel(ctx)
	ch = make(chan tea.Msg, 64)
	done := make(chan struct{})
	var once sync.Once
	stop = func() {
		once.Do(func() {
			cancel()
			<-done // join the loop goroutine so its final backoff read can't race a test restore
		})
	}
	go func() {
		defer close(done)
		reconnectWatchLoop(ctx, w, id, initialCursor, ch, priorAttempt)
	}()
	return ch, stop
}

// reconnectWatchLoop is the body of ReconnectWatchCmd: the bounded-backoff
// reconnect loop for the watch stream. It mirrors reconnectLiveLoop's shape
// (emit WatchReconnectingMsg, backoff, probe, emit WatchReconnectedMsg on
// success) but threads the CURSOR so a re-attach resumes from exactly the next
// record. The cursor it re-opens with is the FURTHEST THIS LOOP has delivered
// (its goroutine-local `cursor` is advanced per envelope in drainWatchProbe; a
// multi-attempt reconnect that delivered envelopes on an earlier attempt
// resumes from past them, not from the stale initial cursor). A phase-only
// frame (the replay→live boundary) carries a cursor too, so the local cursor
// advances past it. The cursor is loop-local by design: nothing may mutate
// caller/model state from this goroutine (the ui's watchCursor is advanced only
// by the Update goroutine and threaded in as initialCursor).
func reconnectWatchLoop(ctx context.Context, w WatchStreamer, id string, initialCursor string, out chan<- tea.Msg, priorAttempt int) {
	defer close(out)
	attempt := priorAttempt
	var lastErr error
	cursor := initialCursor
	for {
		attempt++
		if attempt > 1 {
			d := liveReconnectDelay(attempt)
			if d <= 0 {
				return
			}
			timer := time.NewTimer(d)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C:
			}
		}
		if !emit(ctx, out, WatchReconnectingMsg{Attempt: attempt, Err: lastErr}) {
			return
		}
		// Re-open the watch threading the furthest cursor this loop has reached.
		ws, err := w.WatchSessionEvents(ctx, id, cursor)
		if err == nil {
			// Success. Drain the probe stream's envelopes onto out so the
			// reconnect delivers the resumed events (at-least-once) BEFORE the
			// ui re-arms a fresh channel. The probe stream's ctx is the loop's
			// ctx, so the ui's stop (cancel) cleans it up once it has re-armed.
			if !drainWatchProbe(ctx, ws, out, &cursor) {
				return
			}
			if !emit(ctx, out, WatchReconnectedMsg{}) {
				return
			}
			return
		}
		if reason, classified := AuthFailure(err, watchBearerBacked(w)); classified {
			emit(ctx, out, StreamErrMsg{Err: err, AuthReason: reason})
			return
		}
		lastErr = err
	}
}

// drainWatchProbe drains the probe stream's envelopes onto out, forwarding each
// to the ui via the SAME WatchEnvelopeMsg path a fresh watch uses, and advancing
// *cursor past each delivered envelope so a subsequent re-open resumes from the
// furthest position THIS LOOP reached. It returns false if ctx was cancelled
// (the loop stops). A clean EOF (StreamClosedMsg) or an error (StreamErrMsg)
// ends the drain — the loop then emits WatchReconnectedMsg (a clean re-attach)
// and returns, so the ui re-arms a fresh channel; the probe's terminal marker
// is SWALLOWED here (the reconnect owns its lifecycle markers, mirroring
// catchUpReplay).
func drainWatchProbe(ctx context.Context, ws *WatchStream, out chan<- tea.Msg, cursor *string) bool {
	tmp := make(chan tea.Msg, 64)
	go ws.ReadLoop(ctx, tmp)
	for m := range tmp {
		switch msg := m.(type) {
		case StreamClosedMsg, StreamErrMsg:
			// Swallow the probe's terminal; the reconnect owns its markers.
			return true
		case WatchEnvelopeMsg:
			if msg.Envelope.Cursor != "" {
				*cursor = msg.Envelope.Cursor
			}
			if !emit(ctx, out, msg) {
				return false
			}
		default:
			// A non-envelope event the probe's ReadLoop projected (should not
			// happen — ReadLoop yields only WatchEnvelopeMsg / StreamClosed /
			// StreamErr — but forward it defensively so nothing is silently
			// dropped).
			if !emit(ctx, out, m) {
				return false
			}
		}
	}
	return true
}
