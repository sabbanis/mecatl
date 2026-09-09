package main

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

// startupResumeSource is the pure startup read surface. Both methods are
// ownership-checked server reads; neither enters the run funnel.
type startupResumeSource interface {
	client.SessionLister
	client.SessionTranscripter
	client.SessionGetter
}

const startupReasonNotFound = client.CapabilityReasonUnknown

// startupStateRunning is the session.State value for a running (in-flight) run.
// Local constant so goconst stays quiet across the reattach branches (the
// server's session.State string is the source of truth; this mirrors it).
const startupStateRunning = "running"

type startupResumeError struct {
	Reason         client.CapabilityReason
	text           string
	cause          error
	candidateFresh bool
	// noEligibleChat marks the specific --resume-latest miss where the inventory was
	// listed successfully but held no eligible resumable chat. It is the ONLY miss
	// --resume-latest degrades into a fresh session; a list/transport failure
	// (also Reason == CapabilityReasonUnknown) is NOT this case and still surfaces.
	noEligibleChat bool
}

func (e *startupResumeError) Error() string { return e.text }
func (e *startupResumeError) Unwrap() error { return e.cause }

// startupResumeOutcome is the no-flag/flag startup resolution: at most ONE of
// Resume (adopt a terminal transcript) or Reattach (arm a WatchSessionEvents
// stream against a running server-owned detached run) is set; when neither is,
// the run starts a FRESH session (the cfg.workspace). The reattach arm is new
// (ADR 0322 Scenario 3); the resume arm is byte-identical to the pre-reattach
// path. Workspace is the session's stored workspace for a resume, the cfg
// workspace for a fresh session, and the session's stored workspace for a
// reattach (a detached run keeps its workspace).
type startupResumeOutcome struct {
	Resume   *client.ResumeSelection
	Reattach *client.ReattachSelection
}

// startupResumeConfig resolves the startup resume/reattach/fresh intent from cfg.
// It returns the outcome (resume OR reattach OR neither=fresh) + the workspace
// the ui should bind (a resume/reattach's stored workspace, else cfg.workspace).
//
// The no-flag default path (ADR 0322 Scenario 3) reads the persisted last-session
// pointer for the connect target, calls GetSession(id), and auto-branches on
// state: running → reattach via WatchSessionEvents (replay-then-follow); idle/
// terminal → resume as today; missing/gone → fall through to the listing path
// (now including running sessions as reattach candidates); none → fresh. --new
// forces a fresh session even when a pointer exists. --resume <id> auto-branches
// (reattach if running, resume if idle/terminal). --resume-latest's eligibility
// expands to include running sessions (reattach) when detachSupported reports
// the server advertises detached runs.
//
// detachSupported is the capability seam for task 04: it reports whether the
// server advertises ServerCapabilities.detached_runs (task 04 adds the proto
// field). For task 03 it is a closure the caller wires (defaulting to a
// constant false); the reattach affordance on the POINTER path is NOT gated on
// it (the pointer's state is verified via GetSession — a running session IS a
// real detached run, since tasks 01/02 already shipped the server surface),
// but the --resume-latest LISTING expansion to include running rows IS gated on
// it (an older server without the capability keeps the conservative exclusion,
// so a running row never silently reattaches to a stale-or-cancelled run).
// startupResumeConfig is the legacy startup resolution seam the existing tests
// exercise: it resolves the --resume/--resume-latest/fresh intent with NO
// persisted pointer and a constant-false detachSupported (the conservative
// pre-reattach behaviour). It returns the resume selection (or nil for a fresh
// session) + the workspace. The pointer-aware path lives in
// startupResumeConfigWithPointer; main wires that one.
func startupResumeConfig(ctx context.Context, source startupResumeSource, cfg config) (*client.ResumeSelection, string, error) {
	outcome, ws, err := startupResumeConfigWithPointer(ctx, source, cfg, nil, "", func() bool { return false })
	if err != nil {
		return nil, "", err
	}
	if outcome.Reattach != nil {
		// Under a constant-false detachSupported the reattach arm never fires;
		// defensive (the legacy seam never returns a reattach).
		return nil, ws, nil
	}
	return outcome.Resume, ws, nil
}

// startupResumeConfigWithPointer is the pointer-aware resolution main wires: it
// returns the outcome (resume OR reattach OR neither=fresh) + the workspace.
func startupResumeConfigWithPointer(ctx context.Context, source startupResumeSource, cfg config, ptrStore *sessionStateStore, target string, detachSupported func() bool) (startupResumeOutcome, string, error) {
	// --new forces a fresh session: skip the pointer and the listing.
	if cfg.forceNew {
		return startupResumeOutcome{}, cfg.workspace, nil
	}
	resume, reattach, err := resolveStartupResumeWithPointer(ctx, source, cfg, ptrStore, target, detachSupported)
	if err != nil {
		// A "no eligible chat" listing miss degrades into a fresh session (fall
		// through to cfg.workspace) instead of failing startup — for BOTH the
		// --resume-latest path AND the no-flag default path (which falls through to
		// the listing when no pointer exists). Only that specific miss
		// (noEligibleChat) is degraded: a list/transport failure still surfaces
		// (AC3.3: "if none exist, starts fresh"), and --resume <id> never lists.
		var resumeErr *startupResumeError
		if errors.As(err, &resumeErr) && resumeErr.noEligibleChat && (cfg.resumeLatest || (cfg.resumeID == "" && !cfg.forceNew)) {
			return startupResumeOutcome{}, cfg.workspace, nil
		}
		return startupResumeOutcome{}, "", err
	}
	if resume != nil {
		return startupResumeOutcome{Resume: resume}, cfg.workspace, nil
	}
	if reattach != nil {
		return startupResumeOutcome{Reattach: reattach}, cfg.workspace, nil
	}
	return startupResumeOutcome{}, cfg.workspace, nil
}

// resolveStartupResume is the flag-driven resolution. --resume <id> auto-branches
// (reattach if running + detachSupported, resume if terminal); --resume-latest
// lists, expands eligibility to include running (reattach) when detachSupported,
// and picks the newest; the NO-FLAG default reads the persisted pointer and
// auto-branches on its state, falling through to the listing when no pointer
// exists or the pointer's session is gone.
// resolveStartupResume is the legacy flag-driven resolution seam the existing
// tests exercise: --resume <id> or --resume-latest with NO persisted pointer and
// NO detached-runs capability (the conservative pre-reattach behaviour). It
// delegates to resolveStartupResumeWithPointer with a nil pointer store and a
// constant-false detachSupported, so the --resume/--resume-latest paths are
// byte-identical to the pre-reattach shape (the reattach arm never fires under a
// false capability). Kept as the stable test seam; the pointer-aware path lives
// in resolveStartupResumeWithPointer.
func resolveStartupResume(ctx context.Context, source startupResumeSource, exactID string, latest bool) (*client.ResumeSelection, error) {
	cfg := config{resumeID: exactID, resumeLatest: latest}
	resume, reattach, err := resolveStartupResumeWithPointer(ctx, source, cfg, nil, "", func() bool { return false })
	if err != nil {
		return nil, err
	}
	if reattach != nil {
		// Under a constant-false detachSupported the reattach arm never fires;
		// this is defensive (a running --resume <id> on a false capability falls
		// back to the transcript load, never a reattach).
		return nil, nil
	}
	return resume, nil
}

// resolveStartupResumeWithPointer is the flag-driven resolution the no-flag
// default + the capability path drive. --resume <id> auto-branches (reattach if
// running + detachSupported, resume if terminal); --resume-latest lists, expands
// eligibility to include running (reattach) when detachSupported, and picks the
// newest; the NO-FLAG default reads the persisted pointer and auto-branches on
// its state, falling through to the listing when no pointer exists or the
// pointer's session is gone.
func resolveStartupResumeWithPointer(ctx context.Context, source startupResumeSource, cfg config, ptrStore *sessionStateStore, target string, detachSupported func() bool) (*client.ResumeSelection, *client.ReattachSelection, error) {
	if cfg.resumeID != "" {
		return loadExactStartupResumeWithReattach(ctx, source, cfg.resumeID, detachSupported)
	}
	if cfg.resumeLatest {
		return resolveResumeLatest(ctx, source, detachSupported)
	}
	// No flags: the persisted-pointer auto-branch (ADR 0322 Scenario 3). Reads the
	// last-session pointer for the connect target, calls GetSession(id), and
	// branches on state. Fail-soft: a missing/corrupt pointer (or a gone session)
	// falls through to the listing path (the --resume-latest shape, now including
	// running rows as reattach candidates when detachSupported).
	if ptrStore != nil && target != "" {
		ptr := ptrStore.LoadPointerFull(target)
		if ptr.LastSession != "" {
			if resume, reattach, err := resolvePointerSession(ctx, source, ptr, detachSupported); err == nil {
				return resume, reattach, nil
			}
			// A lookup/transcript failure (the session was deleted server-side, or
			// the transport glitched) degrades to the listing path — the pointer is
			// a HINT, not a source of truth; the server is.
		}
	}
	// No pointer (or a gone/stale pointer): the listing path, including running
	// rows as reattach candidates when detachSupported.
	return resolveResumeLatest(ctx, source, detachSupported)
}

// resolvePointerSession auto-branches on the persisted pointer's session state:
// running → reattach (a detached run still going server-side); idle/terminal →
// resume as today (load the transcript); gone → error (the caller falls through
// to the listing). detachSupported gates ONLY the reattach arm: a running session
// without the capability stays a conservative miss (the run was cancelled on
// disconnect), so the pointer degrades to the listing rather than silently
// reattaching to a stale run. This keeps the pointer path honest about an older
// server while still auto-resuming terminal sessions (which need no capability).
func resolvePointerSession(ctx context.Context, source startupResumeSource, ptr SessionPointer, detachSupported func() bool) (*client.ResumeSelection, *client.ReattachSelection, error) {
	snapshot, err := source.GetSession(ctx, ptr.LastSession)
	if err != nil {
		return nil, nil, err
	}
	if snapshot.State == startupStateRunning {
		if detachSupported != nil && detachSupported() {
			return nil, &client.ReattachSelection{SessionID: ptr.LastSession, Snapshot: snapshot}, nil
		}
		// A running pointer on a server without the detached-runs capability: the
		// run was cancelled on disconnect. Degrade to the listing (the caller
		// falls through) rather than resuming a transcript that lags a dead run.
		return nil, nil, &startupResumeError{Reason: startupReasonNotFound, noEligibleChat: false, text: "the last session was running but the server does not support detached runs; starting a fresh chat"}
	}
	// idle/completed/cancelled/failed → resume as today (load the terminal
	// transcript). Reuse the existing loadExactStartupResume path so the
	// eligibility + transcript validation is byte-identical.
	resume, err := loadExactStartupResume(ctx, source, ptr.LastSession)
	if err != nil {
		return nil, nil, err
	}
	return resume, nil, nil
}

// resolveResumeLatest lists the session inventory, expands eligibility to include
// running rows as reattach candidates when detachSupported, and picks the newest
// eligible. A running row resolves to a ReattachSelection; a terminal row to a
// ResumeSelection. Mirrors the pre-reattach --resume-latest shape with the
// running-row expansion added.
func resolveResumeLatest(ctx context.Context, source startupResumeSource, detachSupported func() bool) (*client.ResumeSelection, *client.ReattachSelection, error) {
	rows, err := source.ListSessions(ctx)
	if err != nil {
		return nil, nil, &startupResumeError{Reason: client.CapabilityReasonUnknown, text: "could not list resumable chats; retry or start without a resume flag", cause: err}
	}

	// Do not trust transport ordering here: the wire promises this key, but sorting
	// again makes selection deterministic for custom clients and unit fixtures.
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].ModifiedAt != rows[j].ModifiedAt {
			return rows[i].ModifiedAt > rows[j].ModifiedAt
		}
		return rows[i].ID < rows[j].ID
	})
	for _, row := range rows {
		if !resumeLatestEligible(row, detachSupported) {
			continue
		}
		if row.State == startupStateRunning {
			// A running row is a reattach candidate (the server owns the detached
			// run). Verify via GetSession (the row's state may lag) then resolve to
			// a ReattachSelection. A GetSession failure or a state that is no longer
			// running degrades to the next row.
			snapshot, snapErr := source.GetSession(ctx, row.ID)
			if snapErr != nil || snapshot.State != startupStateRunning {
				continue
			}
			return nil, &client.ReattachSelection{SessionID: row.ID, Snapshot: snapshot}, nil
		}
		selection, loadErr := loadStartupResume(ctx, source, row, true)
		if loadErr == nil {
			return selection, nil, nil
		}
		// Latest means newest with an available authoritative transcript. A
		// pruned/corrupt row is advisory inventory, so continue to the next row.
	}
	return nil, nil, &startupResumeError{Reason: startupReasonNotFound, noEligibleChat: true, text: "no eligible resumable chat was found; use --resume with an exact ID or start a new chat"}
}

func startupResumeEligible(row client.SessionListItem, latest bool) bool {
	if row.Kind != client.SessionKindMain || !row.Capabilities.PublicChat {
		return false
	}
	if row.State == "awaiting" {
		return false
	}
	// Exact adoption may display a crash-orphaned running transcript; only the
	// ordinary first-prompt funnel can prove it stale. Latest is conservative and
	// never guesses among running rows.
	return !latest || row.State != startupStateRunning
}

// resumeLatestEligible is the --resume-latest/listing eligibility predicate,
// expanded to include running rows as reattach candidates when detachSupported.
// It is startupResumeEligible's listing-path sibling with the running-row
// expansion added: under the capability, a running main-chat row is admitted as a
// reattach candidate; without it, the conservative exclusion holds (a running row
// is never guessed among). awaiting is always excluded (it parks for a human).
func resumeLatestEligible(row client.SessionListItem, detachSupported func() bool) bool {
	if row.Kind != client.SessionKindMain || !row.Capabilities.PublicChat {
		return false
	}
	if row.State == "awaiting" {
		return false
	}
	if row.State == startupStateRunning {
		return detachSupported != nil && detachSupported()
	}
	return true
}

// loadExactStartupResumeWithReattach is the --resume <id> auto-branch: it loads
// the session, and if the session is running AND detachSupported, resolves to a
// ReattachSelection (the run is still going server-side); else it falls through
// to the existing loadExactStartupResume (terminal transcript adoption).
func loadExactStartupResumeWithReattach(ctx context.Context, source startupResumeSource, id string, detachSupported func() bool) (*client.ResumeSelection, *client.ReattachSelection, error) {
	snapshot, err := source.GetSession(ctx, id)
	if err != nil {
		reason := client.CapabilityReasonUnknown
		if client.IsNotFound(err) {
			reason = startupReasonNotFound
		}
		return nil, nil, &startupResumeError{Reason: reason, text: "session lookup unavailable; retry or start without a resume flag", cause: err}
	}
	if snapshot.State == startupStateRunning && detachSupported != nil && detachSupported() {
		return nil, &client.ReattachSelection{SessionID: id, Snapshot: snapshot}, nil
	}
	resume, err := loadExactStartupResume(ctx, source, id)
	if err != nil {
		return nil, nil, err
	}
	return resume, nil, nil
}

func loadExactStartupResume(ctx context.Context, source startupResumeSource, id string) (*client.ResumeSelection, error) {
	snapshot, err := source.GetSession(ctx, id)
	if err != nil {
		reason := client.CapabilityReasonUnknown
		if client.IsNotFound(err) {
			reason = startupReasonNotFound
		}
		return nil, &startupResumeError{Reason: reason, text: "session lookup unavailable; retry or start without a resume flag", cause: err}
	}
	transcript, err := source.GetSessionTranscript(ctx, id)
	if err != nil {
		reason := client.CapabilityReasonTranscriptUnavailable
		if client.IsNotFound(err) {
			reason = startupReasonNotFound
		}
		return nil, &startupResumeError{Reason: reason, text: "the authoritative transcript is unavailable; retry or start without a resume flag", cause: err}
	}
	if !transcript.Complete || transcript.SessionID != id {
		return nil, &startupResumeError{Reason: client.CapabilityReasonTranscriptUnavailable, text: "the authoritative transcript is unavailable; retry or start without a resume flag", candidateFresh: true}
	}
	row := client.SessionListItem{
		ID: id, State: snapshot.State, Placement: snapshot.Placement, CreatedAt: snapshot.CreatedAt,
		Title: snapshot.Title, Kind: transcript.Kind, Relationship: transcript.Relationship,
		Capabilities: client.SessionInventoryCapabilities{
			PublicChat: transcript.Kind == client.SessionKindMain && snapshot.State != "awaiting",
			Inspect:    true, AuthoritativeTranscript: true, ActivityReplay: transcript.Activity.Available,
		},
	}
	if transcript.Kind != client.SessionKindMain {
		row.ReasonCode = client.CapabilityReasonInspectOnlyKind
	} else if snapshot.State == "awaiting" {
		row.ReasonCode = client.CapabilityReasonAwaitingApproval
	}
	if !startupResumeEligible(row, false) {
		return nil, &startupResumeError{Reason: row.ReasonCode, text: capabilityStartupGuidance(row.ReasonCode)}
	}
	return &client.ResumeSelection{Row: row, Transcript: transcript, Snapshot: snapshot}, nil
}

func loadStartupResume(ctx context.Context, source startupResumeSource, row client.SessionListItem, latest bool) (*client.ResumeSelection, error) {
	if !startupResumeEligible(row, latest) {
		reason := row.ReasonCode
		if reason == "" {
			reason = client.CapabilityReasonUnknown
		}
		return nil, &startupResumeError{Reason: reason, text: capabilityStartupGuidance(reason)}
	}
	transcript, err := source.GetSessionTranscript(ctx, row.ID)
	if err != nil || !transcript.Complete || transcript.SessionID != row.ID {
		return nil, &startupResumeError{Reason: client.CapabilityReasonTranscriptUnavailable, text: "the authoritative transcript is unavailable; retry or start without a resume flag"}
	}
	snapshot, err := source.GetSession(ctx, row.ID)
	if err != nil {
		return nil, &startupResumeError{Reason: client.CapabilityReasonTranscriptUnavailable, text: "the authoritative session metadata is unavailable; retry or start without a resume flag"}
	}
	row.State = snapshot.State
	row.Placement = snapshot.Placement
	row.CreatedAt = snapshot.CreatedAt
	row.Title = snapshot.Title
	return &client.ResumeSelection{Row: row, Transcript: transcript, Snapshot: snapshot}, nil
}

func capabilityStartupGuidance(reason client.CapabilityReason) string {
	switch reason {
	case client.CapabilityReasonInspectOnlyKind:
		return "that session is inspect-only and cannot be continued as a chat"
	case client.CapabilityReasonAwaitingApproval:
		return "that chat is awaiting approval and cannot be adopted at startup"
	case client.CapabilityReasonActiveElsewhere:
		return "that chat is currently active; retry after its run finishes"
	case client.CapabilityReasonTranscriptUnavailable:
		return "the authoritative transcript is unavailable; retry or start without a resume flag"
	default:
		return fmt.Sprintf("that session cannot be continued (%s)", client.CapabilityReasonUnknown)
	}
}
