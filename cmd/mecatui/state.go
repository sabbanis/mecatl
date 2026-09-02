package main

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/goccy/go-yaml"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/internal/adapter/xdgconfig"
	"github.com/stacklok/mecatl/internal/adapter/yamldiag"
)

// state.go is the mecatui CLIENT-SIDE model-selection state file: the last-used
// (provider, model) the /models picker writes and the next launch reads. It lives
// in the cmd/mecatui MAIN (the composition root), NOT in cmd/mecatui/client — the
// client stays proto/grpc-only and never touches os/xdg. main already imports
// internal/app + adapters, so reusing internal/adapter/xdgconfig here is the same
// legal composition-side import as trust.go's internal/app use.
//
// # File: settings-vs-state split
//
// The file is machine-written STATE, so it lives under XDG_STATE_HOME (not the
// human config base) — the same split the workspace-trust feature established
// (trust.yaml is state under XDG, settings.yaml is human config). Path:
// <XDG_STATE_HOME or ~/.local/state>/mecatui/models.yaml.
//
// # Format: per-workspace map + a global default
//
//	version: 1
//	default:
//	  providerId: openai
//	  modelId: gpt-5
//	workspaces:
//	  /abs/realpath/repo-a: { providerId: openrouter, modelId: anthropic/claude-... }
//
// Read order on launch: workspaces[realpath(ws)] if present, else the global default
// (if ever set), else the zero selection (the server default). Write on select:
// update ONLY the per-workspace entry — the global default is left untouched so an
// unseen/new repo falls back to the server default instead of silently inheriting the
// last pick made elsewhere. (A future explicit "set as default" is the only writer of
// default.) Workspaces are realpath-keyed (filepath.Abs + EvalSymlinks), mirroring the
// trust registry, so a moved/symlinked repo doesn't fork its state.
//
// # Safety
//
// Read is fail-soft: a missing/oversized/malformed file ⇒ the zero selection (the
// server default), never an error that aborts launch. Write is atomic (temp-file +
// rename, 0o600, O_NOFOLLOW on the final-path symlink guard), mirroring the trust
// registry's Remember discipline; a write failure is returned to the caller (the
// ui surfaces it as a muted notice) but never crashes the picker.

// stateVersion is the schema version main writes and expects. A file with a
// different (unknown) version is ignored fail-safe (treated as no persisted state).
const stateVersion = 1

// maxStateBytes caps the models.yaml read so a pathological file can't blow memory;
// over the cap it is ignored fail-safe (no persisted selection). Mirrors the trust
// registry's cap.
const maxStateBytes = 1 << 20 // 1 MiB

// stateSubpath is the state file relative to the XDG state base.
var stateSubpath = filepath.Join("mecatui", "models.yaml")

// modelSelectionEntry is one persisted (provider, model, effort) tuple on disk. The
// reasoningEffort field (ADR 0055) is omitempty + backward-compatible: an old file
// with no key loads "" (the auto/unset tier), and an "auto"/unset pick (the picker
// maps auto→"" before persisting) writes no key, keeping the file clean.
type modelSelectionEntry struct {
	ProviderID      string `yaml:"providerId"`
	ModelID         string `yaml:"modelId"`
	ReasoningEffort string `yaml:"reasoningEffort,omitempty"`
}

// modelStateFile is the on-disk schema of models.yaml.
type modelStateFile struct {
	Version    int                            `yaml:"version"`
	Default    modelSelectionEntry            `yaml:"default,omitempty"`
	Workspaces map[string]modelSelectionEntry `yaml:"workspaces,omitempty"`
}

// selectionStore is the main-owned concrete SelectionStore (ui.SelectionStore): it
// loads the persisted last-used selection at launch and persists a pick. It is
// bound to a resolved state-file path; tests inject a temp path. A "" path means
// no XDG state dir resolved — persistence is then a no-op (Load returns zero, Save
// reports an error the ui treats fail-soft).
type selectionStore struct {
	path string
}

// newSelectionStore resolves the models.yaml path under XDG_STATE_HOME (via the
// shared xdgconfig leaf) and returns a store bound to it. When no state dir
// resolves (no XDG_STATE_HOME and no home) the path is "" — persistence degrades to
// a no-op rather than anchoring state at a bogus path.
func newSelectionStore(env xdgconfig.ResolveEnv) *selectionStore {
	base := xdgconfig.UserStateDir(env)
	if base == "" {
		return &selectionStore{}
	}
	return &selectionStore{path: filepath.Join(base, stateSubpath)}
}

// Load returns the persisted selection for workspace: the per-workspace entry
// (realpath-keyed) if present, else the global default, else the zero selection.
// Fail-soft: a missing/oversized/malformed/wrong-version file yields the zero
// selection (the server default), never an error.
func (s *selectionStore) Load(workspace string) client.ModelSelection {
	if s == nil || s.path == "" {
		return client.ModelSelection{}
	}
	sf, ok := s.read()
	if !ok {
		return client.ModelSelection{}
	}
	if key, err := realpathState(workspace); err == nil {
		if e, found := sf.Workspaces[key]; found {
			return entrySelection(e)
		}
	}
	return entrySelection(sf.Default)
}

// entrySelection is the single on-disk-entry → client.ModelSelection projection,
// threading every persisted field (provider, model, effort) so a new field is added
// in ONE place rather than at each read site.
func entrySelection(e modelSelectionEntry) client.ModelSelection {
	return client.ModelSelection{
		ProviderID:      e.ProviderID,
		ModelID:         e.ModelID,
		ReasoningEffort: e.ReasoningEffort,
	}
}

// selectionEntry is the inverse: a client.ModelSelection → on-disk entry projection,
// the single write-side mirror of entrySelection.
func selectionEntry(sel client.ModelSelection) modelSelectionEntry {
	return modelSelectionEntry{
		ProviderID:      sel.ProviderID,
		ModelID:         sel.ModelID,
		ReasoningEffort: sel.ReasoningEffort,
	}
}

// Save persists sel as the per-workspace entry (realpath-keyed) ONLY. It deliberately
// does NOT touch the global default: an unseen/new repo falls back to the server
// default rather than silently inheriting whatever was last picked elsewhere (which
// could be an expensive model). A future explicit "set as default" affordance is the
// only thing that should write Default. It is read-modify-write: it preserves the
// existing default and every other workspace's entry. A zero (empty/unresolvable)
// workspace persists nothing. The write is atomic.
func (s *selectionStore) Save(workspace string, sel client.ModelSelection) error {
	if s == nil || s.path == "" {
		return errors.New("mecatui: no XDG state dir to persist the model selection")
	}
	sf, _ := s.read() // a corrupt/absent file ⇒ start fresh (never block a write)
	sf.Version = stateVersion
	if sf.Workspaces == nil {
		sf.Workspaces = make(map[string]modelSelectionEntry)
	}
	entry := selectionEntry(sel)
	if key, err := realpathState(workspace); err == nil {
		sf.Workspaces[key] = entry
	}
	out, err := yaml.Marshal(sf)
	if err != nil {
		return err
	}
	return writeStateFile(s.path, ".models-*", out)
}

// LoadWorkspace returns ONLY the per-workspace (realpath-keyed) entry for
// workspace, with ok=false when there is no such entry (so the caller can tell a
// workspace-set selection apart from a global-default one — the /models picker
// provenance line needs that distinction). Fail-soft like Load.
func (s *selectionStore) LoadWorkspace(workspace string) (client.ModelSelection, bool) {
	if s == nil || s.path == "" {
		return client.ModelSelection{}, false
	}
	sf, ok := s.read()
	if !ok {
		return client.ModelSelection{}, false
	}
	key, err := realpathState(workspace)
	if err != nil {
		return client.ModelSelection{}, false
	}
	e, found := sf.Workspaces[key]
	if !found {
		return client.ModelSelection{}, false
	}
	return entrySelection(e), true
}

// LoadGlobalDefault returns the global `default:` block (the zero selection when
// none is set). Fail-soft like Load. The /models picker reads it to mark the ★
// global-default row and to derive the "global default" provenance label.
func (s *selectionStore) LoadGlobalDefault() client.ModelSelection {
	if s == nil || s.path == "" {
		return client.ModelSelection{}
	}
	sf, ok := s.read()
	if !ok {
		return client.ModelSelection{}
	}
	return entrySelection(sf.Default)
}

// SaveGlobalDefault persists sel as the global `default:` block (the model used by
// a NEW/unseen workspace that has no per-workspace entry). It is the explicit "set
// as global default" writer the package header anticipated — the ONLY writer of
// Default — and is invoked by the picker's ctrl+g. It is read-modify-write: it
// preserves the existing per-workspace map and the schema version, touching only the
// default block. The write is atomic (same temp+rename / O_NOFOLLOW discipline as
// Save). A nil store / unresolved state path returns an error the ui surfaces
// fail-soft.
func (s *selectionStore) SaveGlobalDefault(sel client.ModelSelection) error {
	if s == nil || s.path == "" {
		return errors.New("mecatui: no XDG state dir to persist the global default model")
	}
	sf, _ := s.read() // a corrupt/absent file ⇒ start fresh (never block a write)
	sf.Version = stateVersion
	sf.Default = selectionEntry(sel)
	out, err := yaml.Marshal(sf)
	if err != nil {
		return err
	}
	return writeStateFile(s.path, ".models-*", out)
}

// read loads + parses the state file. ok is false (and the file is ignored
// fail-soft) on any read/parse failure or an unknown schema version. The open is
// O_NOFOLLOW (symmetric with the WRITE path's symlink guard, CWE-59): a symlinked
// state path fails the open ⇒ treated as no-state, the same fail-soft as a
// malformed file — a planted symlink can never redirect the read.
func (s *selectionStore) read() (modelStateFile, bool) {
	data, err := readStateFile(s.path)
	if err != nil {
		return modelStateFile{}, false
	}
	if len(data) > maxStateBytes {
		return modelStateFile{}, false
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return modelStateFile{}, false
	}
	document, err := yamldiag.ParseSettingsDocument(data)
	if err != nil {
		return modelStateFile{}, false
	}
	var sf modelStateFile
	if err := document.Decode(document.Mapping(), &sf); err != nil {
		return modelStateFile{}, false
	}
	if sf.Version != stateVersion {
		return modelStateFile{}, false
	}
	return sf, true
}

// realpathState canonicalizes a workspace to its realpath (filepath.Abs +
// EvalSymlinks), symmetric on Load and Save, so a moved/aliased symlink can't fork
// the state. An empty or unresolvable workspace returns an error (the caller then
// skips the per-workspace entry and uses default).
func realpathState(workspace string) (string, error) {
	if workspace == "" {
		return "", errors.New("empty workspace")
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", err
	}
	return resolved, nil
}

// readStateFile reads the state file with O_NOFOLLOW, so a symlink at the final
// path fails the open (CWE-59) — symmetric with writeStateFile's symlink guard.
// The caller treats any error fail-soft (no persisted state).
func readStateFile(path string) ([]byte, error) {
	f, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0) //nolint:gosec // path derived solely from XDG state base, not repo-controlled
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	return io.ReadAll(f)
}

// writeStateFile atomically replaces the state file with the trust-registry
// discipline: mkdir -p the parent, refuse to write THROUGH a pre-planted symlink at
// the final path (O_NOFOLLOW spirit via an Lstat guard, CWE-59), write to a sibling
// temp file (O_EXCL|0o600), then rename over the target. tempPrefix is the prefix
// for the sibling temp file (e.g. ".models-*" / ".sessions-*") so the two state
// files do not collide on the temp namespace; the *.yaml.tmp suffix is appended.
func writeStateFile(path string, tempPrefix string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	if fi, err := os.Lstat(path); err == nil && fi.Mode()&fs.ModeSymlink != 0 {
		return &os.PathError{Op: "open", Path: path, Err: syscall.ELOOP}
	}
	tmp, err := os.CreateTemp(dir, tempPrefix+"-*.yaml.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return fmt.Errorf("rename state file: %w", err)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// sessions.yaml — the per-server-target last-session pointer (ADR 0321 Scenario 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// The detached-runs last-session pointer: a persisted record of the last session
// mecatui used for ONE connect target, so a reconnecting `mecatui connect ADDRESS`
// with no flags can auto-branch (running → reattach via WatchSessionEvents;
// idle/terminal → resume as today; none → fresh). It is a SIBLING to models.yaml
// in the SAME XDG_STATE_HOME/mecatui dir, reusing the exact selectionStore
// infrastructure: fail-soft read (a missing/oversized/malformed file ⇒ no pointer,
// never an error that aborts launch), atomic write (0o600, O_NOFOLLOW symlink
// guard), the maxStateBytes cap. The user never types a flag, never remembers a
// session id — the tool remembers, the user forgets (ADR 0321 decision 4).
//
// # Format: per-target map
//
//	version: 1
//	targets:
//	  remote-1.example:443: { last_session: sess-abc, last_seen: 1725200000, state: running }
//
// Keyed by connect target (the dial string — host:port, or whatever ADDRESS was
// passed to `mecatui connect`). Read order on connect: targets[address] if
// present, else no pointer (fresh session). Written on detach (Ctrl+C leaves the
// run, the pointer records the id + state) and on session switch (the active
// session becomes the last for the target). last_seen is a Unix timestamp for
// staleness display; state is the session's state at the time of recording
// (running/idle/completed/cancelled/failed — a running state is the reattach
// affordance, the whole point of the pointer).
//
// # Safety
//
// Read is fail-soft like models.yaml: a missing/oversized/malformed/wrong-version
// file yields no pointer (the no-flag connect falls through to the session
// listing path), never an error. Write is atomic with the SAME temp+rename /
// O_NOFOLLOW discipline. The file is NEVER a source of truth for session state —
// the server is; the pointer is a HINT the no-flag path reads then verifies via
// GetSession before branching. A stale pointer (the session was cancelled
// server-side) degrades to the listing path.

// sessionStateSubpath is the sessions.yaml path relative to the XDG state base.
var sessionStateSubpath = filepath.Join("mecatui", "sessions.yaml")

// sessionStateFile is the on-disk schema of sessions.yaml.
type sessionStateFile struct {
	Version int                       `yaml:"version"`
	Targets map[string]sessionPointer `yaml:"targets,omitempty"`
}

// sessionPointer is one persisted last-session record for a connect target.
type sessionPointer struct {
	// LastSession is the opaque session id to reattach to / resume.
	LastSession string `yaml:"last_session"`
	// LastSeen is a Unix timestamp of when the pointer was written (staleness).
	LastSeen int64 `yaml:"last_seen"`
	// State is the session's state at the time of recording (running/idle/
	// completed/cancelled/failed). A running state is the reattach affordance.
	State string `yaml:"state"`
}

// sessionStateStore is the main-owned concrete SessionStateStore: it loads the
// persisted last-session pointer at connect and persists it on detach / session
// switch. Bound to a resolved state-file path; tests inject a temp path. A ""
// path means no XDG state dir resolved — persistence degrades to a no-op.
type sessionStateStore struct {
	path string
}

// newSessionStateStore resolves the sessions.yaml path under XDG_STATE_HOME (via
// the shared xdgconfig leaf) and returns a store bound to it. When no state dir
// resolves the path is "" — persistence degrades to a no-op.
func newSessionStateStore(env xdgconfig.ResolveEnv) *sessionStateStore {
	base := xdgconfig.UserStateDir(env)
	if base == "" {
		return &sessionStateStore{}
	}
	return &sessionStateStore{path: filepath.Join(base, sessionStateSubpath)}
}

// SessionPointer is the proto-free, ui-visible last-session record the no-flag
// connect path reads to auto-branch (running → reattach; idle/terminal →
// resume). LastSeen is a Unix timestamp; State is the session state at the time
// of recording. An empty LastSession means no pointer (fresh session).
type SessionPointer struct {
	LastSession string
	LastSeen    int64
	State       string
}

// LoadPointer returns the persisted last-session pointer for the connect target
// as primitives for the ui's SessionStateStore interface (sessionID + state + ok).
// Fail-soft: a missing/oversized/malformed/wrong-version file yields ok=false,
// never an error — the no-flag connect falls through to the session listing path.
// LoadPointerFull returns the full SessionPointer (with LastSeen for staleness).
func (s *sessionStateStore) LoadPointer(target string) (string, string, bool) {
	ptr := s.LoadPointerFull(target)
	return ptr.LastSession, ptr.State, ptr.LastSession != ""
}

// LoadPointerFull returns the full SessionPointer (LastSession + LastSeen + State)
// for the connect path's staleness display. Fail-soft like LoadPointer.
func (s *sessionStateStore) LoadPointerFull(target string) SessionPointer {
	if s == nil || s.path == "" || target == "" {
		return SessionPointer{}
	}
	sf, ok := s.read()
	if !ok {
		return SessionPointer{}
	}
	ptr, found := sf.Targets[target]
	if !found {
		return SessionPointer{}
	}
	return SessionPointer(ptr)
}

// SavePointer persists the last-session pointer for the connect target. It is
// read-modify-write: it preserves every OTHER target's entry. A zero sessionID is
// a no-op (a null pointer is not a pointer). The write is atomic. Called on detach
// (the run continues server-side, the pointer records id + state) and on session
// switch (the active session becomes the last for the target). lastSeen is a Unix
// timestamp (0 ⇒ now at write time for the detach/switch callers that don't have
// one).
func (s *sessionStateStore) SavePointer(target, sessionID, state string) error {
	if s == nil || s.path == "" {
		return errors.New("mecatui: no XDG state dir to persist the last-session pointer")
	}
	if target == "" || sessionID == "" {
		return nil // a null pointer is not a pointer
	}
	sf, _ := s.read() // a corrupt/absent file ⇒ start fresh
	sf.Version = stateVersion
	if sf.Targets == nil {
		sf.Targets = make(map[string]sessionPointer)
	}
	sf.Targets[target] = sessionPointer{
		LastSession: sessionID,
		LastSeen:    nowUnix(),
		State:       state,
	}
	out, err := yaml.Marshal(sf)
	if err != nil {
		return err
	}
	return writeStateFile(s.path, ".sessions-*", out)
}

// nowUnix returns the current Unix timestamp for the LastSeen field. Extracted so
// tests can stub it; production uses time.Now().Unix().
var nowUnix = func() int64 { return time.Now().Unix() }

// ClearPointer removes the last-session pointer for a target (e.g. on a clean
// `--new` start, or when the session is confirmed gone). Read-modify-write
// preserving every other target. No-op when no entry exists.
func (s *sessionStateStore) ClearPointer(target string) error {
	if s == nil || s.path == "" {
		return errors.New("mecatui: no XDG state dir to clear the last-session pointer")
	}
	if target == "" {
		return nil
	}
	sf, ok := s.read()
	if !ok {
		return nil // nothing to clear
	}
	if _, found := sf.Targets[target]; !found {
		return nil
	}
	delete(sf.Targets, target)
	out, err := yaml.Marshal(sf)
	if err != nil {
		return err
	}
	return writeStateFile(s.path, ".sessions-*", out)
}

// read loads + parses the sessions state file. ok is false (and the file is
// ignored fail-soft) on any read/parse failure or an unknown schema version.
// Mirrors selectionStore.read (the SAME fail-soft discipline, the SAME cap).
func (s *sessionStateStore) read() (sessionStateFile, bool) {
	data, err := readStateFile(s.path)
	if err != nil {
		return sessionStateFile{}, false
	}
	if len(data) > maxStateBytes {
		return sessionStateFile{}, false
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return sessionStateFile{}, false
	}
	document, err := yamldiag.ParseSettingsDocument(data)
	if err != nil {
		return sessionStateFile{}, false
	}
	var sf sessionStateFile
	if err := document.Decode(document.Mapping(), &sf); err != nil {
		return sessionStateFile{}, false
	}
	if sf.Version != stateVersion {
		return sessionStateFile{}, false
	}
	return sf, true
}
