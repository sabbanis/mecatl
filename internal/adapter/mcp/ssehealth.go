package mcp

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/stacklok/mecatl/engine/port"
)

// earlyCloseThreshold is how many CONSECUTIVE standalone-GET responses that
// deliver zero bytes and close within earlyCloseWindow it takes for
// sseHealthTracker to conclude the gateway is GET-hostile (ADR 0327). Three
// is enough to rule out a single transient blip (the false-positive risk a
// genuinely flaky network carries) while still tripping well inside the
// go-sdk's own first ~2 backoff rounds (streamable.go's 1s/1.5s/2.25s
// schedule), long before its 5-retry budget exhausts and calls c.fail().
const earlyCloseThreshold = 3

// earlyCloseWindow bounds how quickly a GET must close with zero bytes to
// count as a hostile signal rather than a normal long-lived (or keepalive-
// carrying) stream.
const earlyCloseWindow = 5 * time.Second

// sseHealthTracker observes the standalone SSE GET stream's behavior for one
// Server, independent of (and ahead of) the go-sdk's own internal retry
// accounting, and decides whether that server's gateway is GET-hostile.
//
// The verdict is STICKY for the tracker's lifetime (one per Server, created
// once in Connect and never replaced across reconnects): re-probing would
// mean deliberately re-paying a churn cycle to learn nothing, since a
// gateway's behavior does not change mid-process. See ADR 0327.
type sseHealthTracker struct {
	diag       port.Diagnostics
	serverName string

	mu                     sync.Mutex
	consecutiveEarlyCloses int

	hostile atomic.Bool
}

func newSSEHealthTracker(serverName string, diag port.Diagnostics) *sseHealthTracker {
	return &sseHealthTracker{serverName: serverName, diag: diag}
}

// Hostile reports whether this server's standalone GET has been judged
// hostile. dial reads it on every call (initial connect + every reconnect)
// to decide whether to suppress the stream.
func (t *sseHealthTracker) Hostile() bool {
	return t.hostile.Load()
}

// observe records one standalone-GET response's outcome: bytesRead is the
// number of bytes the body delivered before it closed, elapsed is how long
// the body stayed open. A zero-byte, fast close counts toward the
// consecutive-hostility streak; anything else (an event delivered, or the
// stream simply stayed open — e.g. an ordinary keepalive) resets the streak,
// so a single blip on an otherwise healthy gateway never trips the verdict.
//
// On the earlyCloseThreshold-th consecutive hostile observation it flips the
// verdict via a CompareAndSwap so the transition WARN logs exactly once, no
// matter how many further hostile GETs this (already-tripped) tracker sees
// before the next dial picks up the flag.
func (t *sseHealthTracker) observe(ctx context.Context, bytesRead int64, elapsed time.Duration) {
	hostile := bytesRead == 0 && elapsed < earlyCloseWindow

	t.mu.Lock()
	if hostile {
		t.consecutiveEarlyCloses++
	} else {
		t.consecutiveEarlyCloses = 0
	}
	tripped := hostile && t.consecutiveEarlyCloses >= earlyCloseThreshold
	streak := t.consecutiveEarlyCloses
	t.mu.Unlock()

	if !tripped {
		return
	}
	if !t.hostile.CompareAndSwap(false, true) {
		return // already tripped; a later dial has not yet picked it up
	}
	diag := t.diag
	if diag == nil {
		diag = port.NopDiagnostics{}
	}
	diag.Log(ctx, port.LevelWarn,
		"mcp: standalone SSE stream auto-disabled (GET-hostile server); list-changed notifications will no longer arrive",
		"server", t.serverName, "consecutive_early_closes", streak)
}

// sseMonitorRoundTripper wraps a server's http.Client transport so
// sseHealthTracker can observe the standalone SSE GET stream's behavior from
// outside the go-sdk, which exposes no hook distinguishing a GET failure
// from a POST failure. It never mutates the request (only inspects the
// response), so — unlike headerRoundTripper — it does not need to clone req.
type sseMonitorRoundTripper struct {
	base    http.RoundTripper
	tracker *sseHealthTracker
}

func (m *sseMonitorRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	isStandaloneGET := req.Method == http.MethodGet &&
		strings.Contains(req.Header.Get("Accept"), "text/event-stream")

	resp, err := m.base.RoundTrip(req)
	if err != nil || !isStandaloneGET || resp == nil {
		return resp, err
	}
	if resp.StatusCode != http.StatusOK ||
		!strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		return resp, err
	}
	resp.Body = &sseObservingBody{
		ReadCloser: resp.Body,
		tracker:    m.tracker,
		ctx:        req.Context(),
		start:      timeNow(),
	}
	return resp, err
}

// timeNow is time.Now, indirected only so it reads clearly at the call site
// above (no test seam intended — the tracker's timing is exercised through
// real elapsed time in tests, per the existing gethostile_test.go pattern).
func timeNow() time.Time { return time.Now() }

// sseObservingBody wraps a standalone-GET response body so its eventual
// Close (the go-sdk's processStream always closes it, per streamable.go's
// deferred io.Copy+Close, whether it read 0 events or many) reports the
// observation to the tracker exactly once.
type sseObservingBody struct {
	io.ReadCloser
	tracker *sseHealthTracker
	ctx     context.Context
	start   time.Time

	mu     sync.Mutex
	bytes  int64
	closed bool
}

func (b *sseObservingBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if n > 0 {
		b.mu.Lock()
		b.bytes += int64(n)
		b.mu.Unlock()
	}
	return n, err
}

func (b *sseObservingBody) Close() error {
	b.mu.Lock()
	already := b.closed
	b.closed = true
	bytes := b.bytes
	b.mu.Unlock()
	if !already {
		b.tracker.observe(b.ctx, bytes, time.Since(b.start))
	}
	return b.ReadCloser.Close()
}
