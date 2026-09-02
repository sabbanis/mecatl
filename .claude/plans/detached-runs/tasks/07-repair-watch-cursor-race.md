---
id: 07-repair-watch-cursor-race
title: Repair — cursorSink closure races the Bubble Tea model (panel-review High)
blocked_by: []
status: pending
branch: "plan-detached-runs/07-repair-watch-cursor-race"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

Panel-review ship-blocker (High, a genuine `-race` failure). `startWatchReconnect`
(`cmd/mecatui/ui/update.go:3564-3572`) passes a closure into `ReconnectWatchCmd`
that writes `m.watchCursor` from the reconnect loop's goroutine
(`client/watch.go:352-363` `drainWatchProbe` calls the sink on that goroutine).
The Update goroutine concurrently reads/writes `m.watchCursor`
(`updateWatchMsg` ~line 3512, `startWatchReconnect` ~line 3556) — a data race on
the Bubble Tea model. The existing `ReconnectLiveCmd` precedent has NO cursorSink
and mutates no model state from its reconnect goroutine — the watch path invented
a parallel, racy structure.

**Fix:** drop the `cursorSink` entirely. The reconnect loop already holds a
goroutine-local `cursor` (watch.go:~302) — advance THAT and re-open from it.
`m.watchCursor` is advanced only by the Update goroutine and threaded into
`startWatchReconnect` as the `initialCursor` argument (already the case).

**Test:** the cursor-advance-on-reconnect behavior must still be pinned (a test
that reconnect resumes from the furthest received cursor — AC3.1's at-least-once
contract), now without any model-field mutation off the Update goroutine.

## Acceptance criteria

- AC7.1: No model field is written from any watch goroutine; the reconnect loop
  advances its own local cursor and re-opens from it.
  - verify: `TestDetachedRun_Repair_WatchReconnectCursorStaysOnUpdateGoroutine`
- AC7.2: Reconnect-after-drop still resumes from the furthest received cursor
  (existing `client/watch_test.go` reconnect test keeps passing).
