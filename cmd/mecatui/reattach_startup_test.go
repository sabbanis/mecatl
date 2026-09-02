package main

import (
	"context"
	"errors"
	"testing"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

// detachSupported is the constant capability closure used across the reattach
// startup tests: true advertises the detached-runs capability (the reattach
// affordance is on); false the conservative pre-capability behaviour.
var detachSupportedOn = func() bool { return true }
var detachSupportedOff = func() bool { return false }

// TestDetachedRun_Scenario3_AutoReattachToRunningSession asserts AC3.1 at the
// startup layer: a no-flag connect whose persisted pointer names a RUNNING
// session auto-reattaches (returns a ReattachSelection) when the server
// advertises detached runs. The pointer's state is verified via GetSession, so
// a running session IS a real detached run.
func TestDetachedRun_Scenario3_AutoReattachToRunningSession(t *testing.T) {
	source := &fakeStartupResumeSource{
		snapshots: map[string]client.SessionSnapshot{
			"sess-running": {State: "running"},
		},
	}
	store := newSessionStateStore(fakeStateEnv(t.TempDir()))
	if err := store.SavePointer("target-1", "sess-running", "running"); err != nil {
		t.Fatal(err)
	}
	cfg := config{workspace: "/default"}
	outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-1", detachSupportedOn)
	if err != nil {
		t.Fatalf("no-flag reattach returned error: %v", err)
	}
	if outcome.Reattach == nil || outcome.Reattach.SessionID != "sess-running" {
		t.Fatalf("outcome = %+v, want Reattach{sess-running}", outcome)
	}
	if outcome.Resume != nil {
		t.Fatalf("a running pointer must NOT resume (no terminal transcript), got Resume %+v", outcome.Resume)
	}
}

// TestDetachedRun_Scenario3_AutoResumeIdleSession asserts AC3.2 at the startup
// layer: a no-flag connect whose persisted pointer names an IDLE/terminal
// session resumes as today (loads the terminal transcript, returns a
// ResumeSelection), NOT a reattach.
func TestDetachedRun_Scenario3_AutoResumeIdleSession(t *testing.T) {
	for _, state := range []string{"idle", "completed", "cancelled", "failed"} {
		t.Run(state, func(t *testing.T) {
			source := &fakeStartupResumeSource{
				snapshots: map[string]client.SessionSnapshot{
					"sess-term": {State: state},
				},
				transcripts: map[string]client.SessionTranscript{
					"sess-term": {SessionID: "sess-term", Complete: true, Kind: client.SessionKindMain},
				},
			}
			store := newSessionStateStore(fakeStateEnv(t.TempDir()))
			if err := store.SavePointer("target-1", "sess-term", state); err != nil {
				t.Fatal(err)
			}
			cfg := config{workspace: "/default"}
			outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-1", detachSupportedOn)
			if err != nil {
				t.Fatalf("terminal pointer resume returned error: %v", err)
			}
			if outcome.Resume == nil || outcome.Resume.Row.ID != "sess-term" {
				t.Fatalf("outcome = %+v, want Resume{sess-term} (terminal → resume as today)", outcome)
			}
			if outcome.Reattach != nil {
				t.Fatalf("a terminal pointer must NOT reattach, got Reattach %+v", outcome.Reattach)
			}
		})
	}
}

// TestDetachedRun_Scenario3_NoPointerFallsThroughToListing asserts AC3.3 at the
// startup layer: a no-flag connect with NO persisted pointer falls through to
// the listing path (the --resume-latest shape), which now includes running
// sessions as reattach candidates when detachSupported. With no rows it starts
// fresh (nil outcome, the cfg workspace).
func TestDetachedRun_Scenario3_NoPointerFallsThroughToListing(t *testing.T) {
	t.Run("no rows → fresh", func(t *testing.T) {
		source := &fakeStartupResumeSource{}
		store := newSessionStateStore(fakeStateEnv(t.TempDir()))
		cfg := config{workspace: "/default"}
		outcome, ws, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-none", detachSupportedOn)
		if err != nil {
			t.Fatalf("no-pointer no-rows returned error: %v", err)
		}
		if outcome.Resume != nil || outcome.Reattach != nil {
			t.Fatalf("outcome = %+v, want nil (fresh session)", outcome)
		}
		if ws != "/default" {
			t.Fatalf("workspace = %q, want /default (fresh)", ws)
		}
	})
	t.Run("running row → reattach candidate", func(t *testing.T) {
		source := &fakeStartupResumeSource{
			rows: []client.SessionListItem{
				{ID: "live", ModifiedAt: 90, Kind: client.SessionKindMain, State: "running", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}},
			},
			snapshots: map[string]client.SessionSnapshot{"live": {State: "running"}},
		}
		store := newSessionStateStore(fakeStateEnv(t.TempDir()))
		cfg := config{workspace: "/default"}
		outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-none", detachSupportedOn)
		if err != nil {
			t.Fatalf("no-pointer running-row listing returned error: %v", err)
		}
		if outcome.Reattach == nil || outcome.Reattach.SessionID != "live" {
			t.Fatalf("outcome = %+v, want Reattach{live} (running row is a reattach candidate)", outcome)
		}
	})
}

// TestDetachedRun_Scenario3_NewFlagForcesFresh asserts AC3.4 at the startup
// layer: `--new` forces a fresh session even when a persisted pointer names a
// running session.
func TestDetachedRun_Scenario3_NewFlagForcesFresh(t *testing.T) {
	source := &fakeStartupResumeSource{
		snapshots: map[string]client.SessionSnapshot{
			"sess-running": {State: "running"},
		},
	}
	store := newSessionStateStore(fakeStateEnv(t.TempDir()))
	if err := store.SavePointer("target-1", "sess-running", "running"); err != nil {
		t.Fatal(err)
	}
	cfg := config{forceNew: true, workspace: "/default"}
	outcome, ws, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-1", detachSupportedOn)
	if err != nil {
		t.Fatalf("--new returned error: %v", err)
	}
	if outcome.Resume != nil || outcome.Reattach != nil {
		t.Fatalf("--new outcome = %+v, want nil (forced fresh)", outcome)
	}
	if ws != "/default" {
		t.Fatalf("--new workspace = %q, want /default (fresh)", ws)
	}
	if source.listCalls != 0 {
		t.Fatalf("--new listed inventory %d times; want 0 (skip listing)", source.listCalls)
	}
}

// TestDetachedRun_Scenario3_PointerPersistedAndRead asserts AC3.5 at the store
// layer: the pointer is written (SavePointer) and read back (LoadPointer)
// fail-soft — a corrupt/missing file degrades to the listing path (no pointer).
// (The full fail-soft coverage is in session_state_test.go; this asserts the
// startup path honours it: a missing-pointer no-flag connect falls through.)
func TestDetachedRun_Scenario3_PointerPersistedAndRead(t *testing.T) {
	store := newSessionStateStore(fakeStateEnv(t.TempDir()))
	if err := store.SavePointer("target-1", "sess-x", "running"); err != nil {
		t.Fatalf("SavePointer: %v", err)
	}
	gotID, gotState, ok := store.LoadPointer("target-1")
	if !ok || gotID != "sess-x" || gotState != "running" {
		t.Fatalf("LoadPointer = (%q, %q, %v), want (sess-x, running, true)", gotID, gotState, ok)
	}
	// Fail-soft: a missing pointer (target with no entry) degrades to the
	// listing path (the no-flag connect does not error).
	source := &fakeStartupResumeSource{}
	cfg := config{workspace: "/default"}
	outcome, ws, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-missing", detachSupportedOn)
	if err != nil {
		t.Fatalf("missing-pointer connect returned error: %v", err)
	}
	if outcome.Resume != nil || outcome.Reattach != nil {
		t.Fatalf("missing-pointer outcome = %+v, want nil (fresh via listing)", outcome)
	}
	if ws != "/default" {
		t.Fatalf("missing-pointer workspace = %q, want /default", ws)
	}
}

// TestDetachedRun_Scenario3_ResumeIDAutoBranchesReattach asserts --resume <id>
// auto-branches: a running session + the capability → ReattachSelection; a
// terminal session → ResumeSelection (the transcript load).
func TestDetachedRun_Scenario3_ResumeIDAutoBranchesReattach(t *testing.T) {
	t.Run("running → reattach", func(t *testing.T) {
		source := &fakeStartupResumeSource{
			snapshots: map[string]client.SessionSnapshot{
				"sess-running": {State: "running"},
			},
		}
		cfg := config{resumeID: "sess-running", workspace: "/default"}
		outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, nil, "", detachSupportedOn)
		if err != nil {
			t.Fatalf("--resume running returned error: %v", err)
		}
		if outcome.Reattach == nil || outcome.Reattach.SessionID != "sess-running" {
			t.Fatalf("outcome = %+v, want Reattach{sess-running}", outcome)
		}
	})
	t.Run("terminal → resume", func(t *testing.T) {
		source := &fakeStartupResumeSource{
			snapshots: map[string]client.SessionSnapshot{
				"sess-term": {State: "completed"},
			},
			transcripts: map[string]client.SessionTranscript{
				"sess-term": {SessionID: "sess-term", Complete: true, Kind: client.SessionKindMain},
			},
		}
		cfg := config{resumeID: "sess-term", workspace: "/default"}
		outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, nil, "", detachSupportedOn)
		if err != nil {
			t.Fatalf("--resume terminal returned error: %v", err)
		}
		if outcome.Resume == nil || outcome.Resume.Row.ID != "sess-term" {
			t.Fatalf("outcome = %+v, want Resume{sess-term}", outcome)
		}
		if outcome.Reattach != nil {
			t.Fatalf("terminal --resume must NOT reattach, got %+v", outcome.Reattach)
		}
	})
}

// TestDetachedRun_Scenario3_ResumeLatestExcludesRunningWithoutCapability
// asserts the --resume-latest listing keeps the conservative running-row
// exclusion when detachSupported is false (an older server without the
// capability): a running row is NEVER guessed among.
func TestDetachedRun_Scenario3_ResumeLatestExcludesRunningWithoutCapability(t *testing.T) {
	source := &fakeStartupResumeSource{
		rows: []client.SessionListItem{
			{ID: "live", ModifiedAt: 90, Kind: client.SessionKindMain, State: "running", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}},
			{ID: "term", ModifiedAt: 80, Kind: client.SessionKindMain, State: "completed", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}},
		},
		transcripts: map[string]client.SessionTranscript{
			"term": {SessionID: "term", Complete: true, Kind: client.SessionKindMain},
		},
		snapshots: map[string]client.SessionSnapshot{"term": {State: "completed"}},
	}
	cfg := config{resumeLatest: true, workspace: "/default"}
	outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, nil, "", detachSupportedOff)
	if err != nil {
		t.Fatalf("--resume-latest without capability returned error: %v", err)
	}
	// The running row "live" is excluded; "term" (completed) is adopted.
	if outcome.Resume == nil || outcome.Resume.Row.ID != "term" {
		t.Fatalf("outcome = %+v, want Resume{term} (running excluded without capability)", outcome)
	}
	if outcome.Reattach != nil {
		t.Fatalf("without capability --resume-latest must NOT reattach, got %+v", outcome.Reattach)
	}
}

// TestDetachedRun_Scenario3_StalePointerDegradesToListing asserts a pointer
// whose session is GONE (GetSession not-found) degrades to the listing path —
// the pointer is a HINT, not a source of truth; the server is.
func TestDetachedRun_Scenario3_StalePointerDegradesToListing(t *testing.T) {
	source := &fakeStartupResumeSource{
		snapshotErrs: map[string]error{"gone": errors.New("not found")},
		// The listing has a terminal session the degraded path adopts.
		rows: []client.SessionListItem{
			{ID: "term", ModifiedAt: 80, Kind: client.SessionKindMain, State: "completed", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}},
		},
		transcripts: map[string]client.SessionTranscript{
			"term": {SessionID: "term", Complete: true, Kind: client.SessionKindMain},
		},
		snapshots: map[string]client.SessionSnapshot{"term": {State: "completed"}},
	}
	store := newSessionStateStore(fakeStateEnv(t.TempDir()))
	if err := store.SavePointer("target-1", "gone", "running"); err != nil {
		t.Fatal(err)
	}
	cfg := config{workspace: "/default"}
	outcome, _, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-1", detachSupportedOn)
	if err != nil {
		t.Fatalf("stale pointer returned error: %v", err)
	}
	// The degraded listing adopted "term".
	if outcome.Resume == nil || outcome.Resume.Row.ID != "term" {
		t.Fatalf("outcome = %+v, want Resume{term} (degraded to listing)", outcome)
	}
}

// TestDetachedRun_Scenario3_RunningPointerWithoutCapabilityDegrades asserts a
// running pointer on a server WITHOUT the detached-runs capability degrades to
// the listing (the run was cancelled on disconnect) rather than silently
// reattaching to a stale run.
func TestDetachedRun_Scenario3_RunningPointerWithoutCapabilityDegrades(t *testing.T) {
	source := &fakeStartupResumeSource{
		snapshots: map[string]client.SessionSnapshot{
			"sess-running": {State: "running"},
		},
		// No listing rows → degraded fresh session.
	}
	store := newSessionStateStore(fakeStateEnv(t.TempDir()))
	if err := store.SavePointer("target-1", "sess-running", "running"); err != nil {
		t.Fatal(err)
	}
	cfg := config{workspace: "/default"}
	outcome, ws, err := startupResumeConfigWithPointer(context.Background(), source, cfg, store, "target-1", detachSupportedOff)
	if err != nil {
		t.Fatalf("running pointer without capability returned error: %v", err)
	}
	if outcome.Reattach != nil {
		t.Fatalf("running pointer without capability must NOT reattach, got %+v", outcome.Reattach)
	}
	if outcome.Resume != nil {
		t.Fatalf("running pointer without capability must NOT resume (no transcript), got %+v", outcome.Resume)
	}
	if ws != "/default" {
		t.Fatalf("workspace = %q, want /default (degraded fresh)", ws)
	}
}
