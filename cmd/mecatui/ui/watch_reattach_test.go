package ui

import (
	"context"
	"io"
	"sync"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
)

// fakeWatchStreamer is a scripted client.WatchStreamer for the reattach tests:
// it returns a *client.WatchStream over a scripted WatchRecver, recording the id
// + cursor it was called with. It mirrors fakeLiveStreamer (the LiveStreamer
// analogue). The script is reused for every call so a reconnect can re-drain.
type fakeWatchStreamer struct {
	mu      sync.Mutex
	script  []*mecatlv1.WatchSessionEventsResponse
	err     error
	calls   int
	lastID  string
	lastCur string
}

func (f *fakeWatchStreamer) WatchSessionEvents(_ context.Context, id, cursor string) (*client.WatchStream, error) {
	f.mu.Lock()
	f.calls++
	f.lastID = id
	f.lastCur = cursor
	f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	return client.NewWatchStream(newFakeWatchRecverForUI(f.script...)), nil
}

// newFakeWatchRecverForUI is a scripted WatchRecver (the exported twin of the
// client's unexported fakeWatchRecver) so the ui tests can build a *WatchStream
// without the proto-free constraint the production ui carries — ui tests DO
// import proto directly (see delivery_live_test.go).
func newFakeWatchRecverForUI(script ...*mecatlv1.WatchSessionEventsResponse) *fakeWatchRecverUI {
	return &fakeWatchRecverUI{script: script}
}

type fakeWatchRecverUI struct {
	mu     sync.Mutex
	script []*mecatlv1.WatchSessionEventsResponse
	idx    int
	endErr error
}

func (f *fakeWatchRecverUI) Recv() (*mecatlv1.WatchSessionEventsResponse, error) {
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

// watchEnvForUI builds one WatchSessionEventsResponse carrying an Event + cursor + phase.
func watchEnvForUI(ev *mecatlv1.Event, cursor, phase string) *mecatlv1.WatchSessionEventsResponse {
	return &mecatlv1.WatchSessionEventsResponse{Event: ev, Cursor: cursor, Phase: phase}
}

// phaseEnvForUI builds a phase-only WatchSessionEventsResponse (no Event).
func phaseEnvForUI(cursor, phase string) *mecatlv1.WatchSessionEventsResponse {
	return &mecatlv1.WatchSessionEventsResponse{Cursor: cursor, Phase: phase}
}

// reattachScript is the watch analogue of scriptedRun for the reattach tests:
// a session.init + a delta + a tool call in the `replay` phase, then the
// phase-only `live` boundary marker, so a test can assert the replay→live
// footer transition.
func reattachScript() []*mecatlv1.WatchSessionEventsResponse {
	return []*mecatlv1.WatchSessionEventsResponse{
		watchEnvForUI(&mecatlv1.Event{Type: "session.init", Seq: 1}, "c1", client.WatchPhaseReplay),
		watchEnvForUI(&mecatlv1.Event{Type: "turn.start", Seq: 2, Turn: 1}, "c2", client.WatchPhaseReplay),
		watchEnvForUI(&mecatlv1.Event{Type: "message.delta", Seq: 3, Turn: 1, Text: "running detached…"}, "c3", client.WatchPhaseReplay),
		watchEnvForUI(&mecatlv1.Event{Type: "tool.call", Seq: 4, Turn: 1, ToolCall: &mecatlv1.ToolCall{Id: "r1", Name: "Read", Args: `{}`}}, "c4", client.WatchPhaseReplay),
		phaseEnvForUI("c4", client.WatchPhaseLive),
	}
}

// newReattachModel builds a Model via New with a Reattach selection + a fake
// Watch streamer, mirroring the production reattach Init path (the no-flag
// pointer named a running session). It drives the Init batch's NON-watch cmds
// (sp.Tick, startupResumeReadyMsg, statusLine) but NOT the recursive watch drain
// — the test drives watch messages one at a time via feedWatchMsg so it bounds
// the drain and avoids the reconnect loop. Returns the Model + the fake.
func newReattachModel(t *testing.T, fw *fakeWatchStreamer) Model {
	t.Helper()
	deps := Deps{
		Watch: fw,
		Reattach: &client.ReattachSelection{
			SessionID: "sess-running",
			Snapshot:  client.SessionSnapshot{State: "running", Workspace: "/ws"},
		},
		Theme:       theme.New("aztec", theme.AztecPalette()),
		Workspace:   "/ws",
		Mode:        "default",
		Model:       "mock-model",
		Ctx:         context.Background(),
		NoAltScreen: true,
	}
	m := newTestModelFromDeps(deps)
	// Drive Init: it's a tea.Batch of sp.Tick + startupResumeReadyMsg +
	// statusLineWaitCmd. The startupResumeReadyMsg fires finishStartupResume,
	// which (because m.detached) arms the watch from the beginning of the log
	// and returns waitWatchCmd. Feed the batch, then drive the
	// startupResumeReadyMsg so the watch arms; the waitWatchCmd it returns is
	// driven explicitly below (bounded, no recursion).
	initCmd := m.Init()
	if batch, ok := runCmd(initCmd).(tea.BatchMsg); ok {
		for _, c := range batch {
			msg := runCmd(c)
			if msg == nil {
				continue
			}
			mm, next := m.Update(msg)
			m = mm.(Model)
			_ = next // do not recursively drain the watch; the test drives it.
		}
	}
	return m
}

// feedWatchMsg drives ONE watch message through the model (run waitWatchCmd,
// then Update its result), WITHOUT recursively draining the reconnect loop. It
// returns the model + the next cmd (the reducer's re-arm) so the caller can
// drive the next message.
func feedWatchMsg(t *testing.T, m Model) (Model, tea.Cmd) {
	t.Helper()
	cmd := m.waitWatchCmd()
	if cmd == nil {
		t.Fatal("waitWatchCmd nil; watch not armed")
	}
	msg := runCmdTimeout(t, cmd)
	if msg == nil {
		t.Fatal("waitWatchCmd returned nil msg")
	}
	mm, next := m.Update(msg)
	return mm.(Model), next
}

// TestDetachedRun_Scenario3_AutoReattachToRunningSession asserts AC3.1 at the UI
// layer: a reattach (deps.Reattach naming a running session) transitions to
// phaseFollowing, marks detached, and arms the watch (WatchSessionEvents) from
// the beginning of the log (cursor ""). The footer renders the reattach indicator.
func TestDetachedRun_Scenario3_AutoReattachToRunningSession(t *testing.T) {
	fw := &fakeWatchStreamer{script: reattachScript()}
	m := newReattachModel(t, fw)

	if m.phase != phaseFollowing {
		t.Fatalf("phase = %v, want phaseFollowing", m.phase)
	}
	if !m.detached {
		t.Fatal("detached = false, want true (following a detached run)")
	}
	if m.sessionID != "sess-running" {
		t.Fatalf("sessionID = %q, want sess-running", m.sessionID)
	}
	if fw.calls < 1 || fw.lastID != "sess-running" || fw.lastCur != "" {
		t.Fatalf("WatchSessionEvents calls=%d lastID=%q lastCur=%q, want 1/sess-running/\"\" (beginning of log)", fw.calls, fw.lastID, fw.lastCur)
	}
	if m.watchCh == nil {
		t.Fatal("watchCh should be armed after reattach Init")
	}
	// Disarm the watch to stop the background goroutine before exit.
	(&m).disarmWatch()
}

// TestDetachedRun_Scenario3_ReplayToLiveIndicator asserts AC3.6 at the UI layer:
// the WatchPhaseReplay→WatchPhaseLive boundary drives a `⟳ replaying N events…`
// footer during replay, then switches to the normal live-following spinner.
func TestDetachedRun_Scenario3_ReplayToLiveIndicator(t *testing.T) {
	fw := &fakeWatchStreamer{script: reattachScript()}
	m := newReattachModel(t, fw)
	defer (&m).disarmWatch()

	// Feed the 4 replay envelopes one at a time (bounded, no recursion).
	for i := 0; i < 4; i++ {
		var next tea.Cmd
		m, next = feedWatchMsg(t, m)
		_ = next // bounded drive; do not recursively drain
	}
	if !m.watchReplaying {
		t.Fatal("watchReplaying = false during replay, want true")
	}
	if m.watchReplayCount != 4 {
		t.Fatalf("watchReplayCount = %d, want 4 (4 replay envelopes delivered)", m.watchReplayCount)
	}
	footer := m.footerActivity()
	if !containsPlain(footer, "replaying") {
		t.Fatalf("replay footer = %q, want it to contain 'replaying'", footer)
	}
	// Feed the phase-only `live` boundary: watchReplaying clears, the footer
	// switches to the normal live-following spinner.
	m, _ = feedWatchMsg(t, m)
	if m.watchReplaying {
		t.Fatal("watchReplaying = true after the live boundary, want false")
	}
	if m.watchReplayCount != 0 {
		t.Fatalf("watchReplayCount = %d after boundary, want 0 (reset)", m.watchReplayCount)
	}
	footer = m.footerActivity()
	if !containsPlain(footer, "following detached run") {
		t.Fatalf("live footer = %q, want 'following detached run…'", footer)
	}
}

// TestDetachedRun_Scenario3_WatchEventReducesIntoConversation asserts a watch
// event (a replay message.delta) reduces through the SAME updateStreamEvent
// path a live event takes, so the conversation renders the detached run's
// output as it is replayed.
func TestDetachedRun_Scenario3_WatchEventReducesIntoConversation(t *testing.T) {
	fw := &fakeWatchStreamer{script: reattachScript()}
	m := newReattachModel(t, fw)
	defer (&m).disarmWatch()
	// Feed session.init + turn.start + delta (3 replay envelopes).
	for i := 0; i < 3; i++ {
		m, _ = feedWatchMsg(t, m)
	}
	if m.conv.isEmpty() {
		t.Fatal("conversation empty after replaying a delta, want the detached run's output rendered")
	}
}

// TestDetachedRun_Scenario3_DetachedSessionSwitchDisarmsWatch asserts a session
// switch (disarmLiveFeed) tears down the watch + clears detached, so a fresh
// session drives its own run, never a stale watch.
func TestDetachedRun_Scenario3_DetachedSessionSwitchDisarmsWatch(t *testing.T) {
	fw := &fakeWatchStreamer{script: reattachScript()}
	m := newReattachModel(t, fw)
	if m.watchCh == nil || !m.detached {
		t.Fatal("precondition: watch armed + detached")
	}
	(&m).disarmLiveFeed()
	if m.watchCh != nil {
		t.Fatal("watchCh not nil after disarmLiveFeed (session switch), want torn down")
	}
	if m.detached {
		t.Fatal("detached = true after session switch, want false (fresh session drives its own run)")
	}
}

// containsPlain is a stripped-ANSI substring check so the footer assertions are
// robust to lipgloss styling.
func containsPlain(s, sub string) bool {
	out := make([]byte, 0, len(s))
	in := false
	for _, r := range s {
		if r == 0x1b {
			in = true
			continue
		}
		if in {
			if r == 'm' {
				in = false
			}
			continue
		}
		out = append(out, byte(r))
	}
	return contains(string(out), sub)
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// Compile-time guard: the fakeWatchStreamer satisfies client.WatchStreamer.
var _ client.WatchStreamer = (*fakeWatchStreamer)(nil)

// Ensure tea import is used.
var _ tea.Model = (tea.Model)(nil)

// TestDetachedRun_Scenario3_EnterOnRunningRowReattaches asserts AC3.1's
// sessions-surface arm (Slice 5): `enter` on a RUNNING row in the sessions
// browser sets a sessionsReattachIntent, which the Model applies by
// transitioning to phaseFollowing + arming the watch. The `● running` badge
// distinguishes a running row (a reattach candidate) from a terminal one.
func TestDetachedRun_Scenario3_EnterOnRunningRowReattaches(t *testing.T) {
	fw := &fakeWatchStreamer{script: reattachScript()}
	conv := newSessionsConv()
	m := newSessionsModel(t, conv, &fakeSessionLister{}, &fakeSessionTranscriptLoader{})
	m.deps.Watch = fw
	row := client.SessionListItem{
		ID: "sess-running", Title: "detached run", Kind: client.SessionKindMain,
		State: "running", Capabilities: client.SessionInventoryCapabilities{PublicChat: true, ViewTranscript: true},
	}
	setActiveSessions(&m, newSessionsPanelState())
	ensureActiveSessions(&m).loading = false
	ensureActiveSessions(&m).sessions = []client.SessionListItem{row}
	ensureActiveSessions(&m).syncFilter()

	// `enter` on the running row: sets the reattach intent; applySurfaceIntent
	// runs in HandleKey's intent path and transitions to phaseFollowing + arms
	// the watch. Drive the returned cmd once (no recursive drain — the watch
	// reconnect loop would otherwise re-arm forever on the scripted stream).
	mm, cmd, handled := m.onOverlayKey(tea.KeyPressMsg{Code: tea.KeyEnter})
	m = mm.(Model)
	if !handled {
		t.Fatal("enter on running row was not handled")
	}
	if cmd != nil {
		msg := runCmd(cmd)
		if batch, ok := msg.(tea.BatchMsg); ok {
			for _, c := range batch {
				bm := runCmd(c)
				if bm == nil {
					continue
				}
				mm2, _ := m.Update(bm)
				m = mm2.(Model)
			}
		} else if msg != nil {
			mm2, _ := m.Update(msg)
			m = mm2.(Model)
		}
	}
	if m.phase != phaseFollowing {
		t.Fatalf("phase = %v, want phaseFollowing (reattach from sessions browser)", m.phase)
	}
	if !m.detached {
		t.Fatal("detached = false, want true")
	}
	if m.sessionID != "sess-running" {
		t.Fatalf("sessionID = %q, want sess-running", m.sessionID)
	}
	if fw.calls < 1 || fw.lastID != "sess-running" {
		t.Fatalf("WatchSessionEvents calls=%d lastID=%q, want 1/sess-running", fw.calls, fw.lastID)
	}
	(&m).disarmWatch()
}

// TestDetachedRun_Scenario3_RunningRowRendersFilledCircleBadge asserts the
// `● running` badge (Slice 5): a running row renders the filled-circle state
// badge distinguishing it from a terminal row.
func TestDetachedRun_Scenario3_RunningRowRendersFilledCircleBadge(t *testing.T) {
	if got := stateBadge("running"); got != "●" {
		t.Fatalf("stateBadge(running) = %q, want ● (filled circle, reattach candidate)", got)
	}
	if got := stateBadge("completed"); got != "✓" {
		t.Fatalf("stateBadge(completed) = %q, want ✓", got)
	}
}
