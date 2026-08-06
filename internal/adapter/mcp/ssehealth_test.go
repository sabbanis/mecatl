package mcp

import (
	"context"
	"testing"
	"time"
)

// TestSSEHealthTrackerTripsAfterConsecutiveEarlyCloses exercises
// sseHealthTracker.observe directly (no HTTP round-trip needed — the
// tracker's decision is pure over its observed (bytes, elapsed) inputs): it
// must NOT trip before earlyCloseThreshold consecutive zero-byte, fast
// closes, must trip exactly at the threshold, log exactly one WARN on the
// false->true transition, and never log a second one on further hostile
// observations (ADR 0327).
func TestSSEHealthTrackerTripsAfterConsecutiveEarlyCloses(t *testing.T) {
	diag := &recordingDiag{}
	tr := newSSEHealthTracker("rs", diag)

	for i := 0; i < earlyCloseThreshold-1; i++ {
		tr.observe(context.Background(), 0, time.Millisecond)
		if tr.Hostile() {
			t.Fatalf("tripped after only %d early close(s), want %d", i+1, earlyCloseThreshold)
		}
	}
	tr.observe(context.Background(), 0, time.Millisecond)
	if !tr.Hostile() {
		t.Fatalf("Hostile() = false after %d consecutive early closes, want true", earlyCloseThreshold)
	}
	if got := diag.count("mcp: standalone SSE stream auto-disabled"); got != 1 {
		t.Errorf("auto-disabled WARN lines = %d, want exactly 1", got)
	}

	// A further hostile observation on an already-tripped tracker must not
	// re-log — the CompareAndSwap gate is what makes this once-only.
	tr.observe(context.Background(), 0, time.Millisecond)
	if got := diag.count("mcp: standalone SSE stream auto-disabled"); got != 1 {
		t.Errorf("auto-disabled WARN lines after a further hostile observation = %d, want still 1", got)
	}
}

// TestSSEHealthTrackerResetsOnProgress proves the reset-on-progress branch:
// neither a byte-delivering observation nor a slow (but zero-byte) close
// counts toward the consecutive-hostility streak, so a single blip on an
// otherwise-healthy gateway never trips the verdict — the false-positive
// guard ADR 0327 relies on to justify auto-deciding at all.
func TestSSEHealthTrackerResetsOnProgress(t *testing.T) {
	diag := &recordingDiag{}
	tr := newSSEHealthTracker("rs", diag)

	// Two early closes, then a byte-delivering observation resets the streak,
	// so a lone early close after it must not, by itself, trip the verdict.
	tr.observe(context.Background(), 0, time.Millisecond)
	tr.observe(context.Background(), 0, time.Millisecond)
	tr.observe(context.Background(), 1, time.Millisecond) // progress: resets
	tr.observe(context.Background(), 0, time.Millisecond)
	if tr.Hostile() {
		t.Fatal("Hostile() = true after a progress reset; the byte-delivering observation should have cleared the streak")
	}

	// A stream that simply stays open past earlyCloseWindow — even
	// delivering zero bytes, e.g. an ordinary idle long-lived connection — is
	// not a hostile signal either.
	tr.observe(context.Background(), 0, earlyCloseWindow)
	if tr.Hostile() {
		t.Fatal("Hostile() = true for a slow zero-byte close; elapsed >= earlyCloseWindow must not count as hostile")
	}
	if got := diag.count("mcp: standalone SSE stream auto-disabled"); got != 0 {
		t.Errorf("auto-disabled WARN lines = %d, want 0 (never tripped)", got)
	}
}
