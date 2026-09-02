package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/xdgconfig"
)

// ptrTriple is the (sessionID, state) pair SavePointer takes / LoadPointer
// returns, so the round-trip assertions can compare without the LastSeen field
// (which is stamped at write time).
func ptrTriple(sessionID, state string) (string, string) {
	return sessionID, state
}

// TestSessionStateStore_RoundTrip covers save→load for a per-target
// last-session pointer: the pointer is scoped to ITS target ONLY, an unseen
// target yields no pointer (the no-flag connect falls through to the listing),
// and a fresh store (simulating a relaunch) reads it back.
func TestSessionStateStore_RoundTrip(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))

	if err := store.SavePointer("remote-1.example:443", "sess-abc", "running"); err != nil {
		t.Fatalf("SavePointer: %v", err)
	}

	// A fresh store (relaunch) reads the pointer back.
	store2 := newSessionStateStore(fakeStateEnv(stateHome))
	gotID, gotState, ok := store2.LoadPointer("remote-1.example:443")
	if !ok || gotID != "sess-abc" || gotState != "running" {
		t.Fatalf("LoadPointer = (%q, %q, %v), want (sess-abc, running, true)", gotID, gotState, ok)
	}
	// An unseen target yields no pointer (fresh session), NOT a leaked one.
	if gotID, _, ok := store2.LoadPointer("other.example:443"); ok || gotID != "" {
		t.Fatalf("LoadPointer(unseen) = (%q, _, %v), want zero (no pointer)", gotID, ok)
	}
}

// TestSessionStateStore_PreservesOtherTargets asserts SavePointer is
// read-modify-write: saving a second target leaves the first intact.
func TestSessionStateStore_PreservesOtherTargets(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))

	if err := store.SavePointer("t1", "sess-1", "running"); err != nil {
		t.Fatalf("SavePointer(t1): %v", err)
	}
	if err := store.SavePointer("t2", "sess-2", "idle"); err != nil {
		t.Fatalf("SavePointer(t2): %v", err)
	}

	store2 := newSessionStateStore(fakeStateEnv(stateHome))
	if gotID, gotState, ok := store2.LoadPointer("t1"); !ok || gotID != "sess-1" || gotState != "running" {
		t.Fatalf("LoadPointer(t1) = (%q, %q, %v), want (sess-1, running, true)", gotID, gotState, ok)
	}
	if gotID, gotState, ok := store2.LoadPointer("t2"); !ok || gotID != "sess-2" || gotState != "idle" {
		t.Fatalf("LoadPointer(t2) = (%q, %q, %v), want (sess-2, idle, true)", gotID, gotState, ok)
	}
}

// TestSessionStateStore_OverwriteTarget asserts a second SavePointer for the
// SAME target overwrites the first (the pointer records the LATEST session).
func TestSessionStateStore_OverwriteTarget(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))

	if err := store.SavePointer("t", "old", "running"); err != nil {
		t.Fatalf("SavePointer(1): %v", err)
	}
	if err := store.SavePointer("t", "new", "completed"); err != nil {
		t.Fatalf("SavePointer(2): %v", err)
	}
	if gotID, gotState, ok := newSessionStateStore(fakeStateEnv(stateHome)).LoadPointer("t"); !ok || gotID != "new" || gotState != "completed" {
		t.Fatalf("LoadPointer after overwrite = (%q, %q, %v), want (new, completed, true)", gotID, gotState, ok)
	}
}

// TestSessionStateStore_ClearPointer asserts ClearPointer removes the entry
// and preserves the rest.
func TestSessionStateStore_ClearPointer(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))
	if err := store.SavePointer("t1", "a", "running"); err != nil {
		t.Fatal(err)
	}
	if err := store.SavePointer("t2", "b", "idle"); err != nil {
		t.Fatal(err)
	}
	if err := store.ClearPointer("t1"); err != nil {
		t.Fatalf("ClearPointer: %v", err)
	}
	store2 := newSessionStateStore(fakeStateEnv(stateHome))
	if gotID, _, ok := store2.LoadPointer("t1"); ok || gotID != "" {
		t.Fatalf("LoadPointer(t1) after clear = (%q, _, %v), want zero", gotID, ok)
	}
	if gotID, _, ok := store2.LoadPointer("t2"); !ok || gotID != "b" {
		t.Fatalf("LoadPointer(t2) after clear = (%q, _, %v), want preserved", gotID, ok)
	}
}

// TestSessionStateStore_FailSoftRead covers the fail-soft read paths: a missing
// file, a malformed file, and a wrong-version file all yield no pointer, never a
// crash. The no-flag connect falls through to the session listing.
func TestSessionStateStore_FailSoftRead(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		store := newSessionStateStore(fakeStateEnv(t.TempDir()))
		if gotID, _, ok := store.LoadPointer("t"); ok || gotID != "" {
			t.Fatalf("LoadPointer on missing file = (%q, _, %v), want zero", gotID, ok)
		}
	})
	t.Run("malformed yaml", func(t *testing.T) {
		stateHome := t.TempDir()
		path := filepath.Join(stateHome, sessionStateSubpath)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(":\n  not: [valid"), 0o600); err != nil {
			t.Fatal(err)
		}
		store := newSessionStateStore(fakeStateEnv(stateHome))
		if gotID, _, ok := store.LoadPointer("t"); ok || gotID != "" {
			t.Fatalf("LoadPointer on malformed file = (%q, _, %v), want zero (fail-soft)", gotID, ok)
		}
	})
	t.Run("wrong version", func(t *testing.T) {
		stateHome := t.TempDir()
		path := filepath.Join(stateHome, sessionStateSubpath)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("version: 999\ntargets: {t: {last_session: x}}\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		store := newSessionStateStore(fakeStateEnv(stateHome))
		if gotID, _, ok := store.LoadPointer("t"); ok || gotID != "" {
			t.Fatalf("LoadPointer on wrong-version file = (%q, _, %v), want zero (fail-safe)", gotID, ok)
		}
	})
}

// TestSessionStateStore_AtomicWritePerms asserts the persisted file is
// owner-only (0o600), matching the trust-registry discipline and models.yaml.
func TestSessionStateStore_AtomicWritePerms(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))
	if err := store.SavePointer("t", "x", "running"); err != nil {
		t.Fatalf("SavePointer: %v", err)
	}
	fi, err := os.Stat(filepath.Join(stateHome, sessionStateSubpath))
	if err != nil {
		t.Fatalf("stat sessions.yaml: %v", err)
	}
	if perm := fi.Mode().Perm(); perm != 0o600 {
		t.Fatalf("sessions.yaml perms = %o, want 0600", perm)
	}
}

// TestSessionStateStore_NoStateDir asserts that with no XDG state dir resolvable,
// persistence degrades to a no-op (Load zero, Save errors) rather than crashing
// or writing somewhere bogus — the same discipline as models.yaml.
func TestSessionStateStore_NoStateDir(t *testing.T) {
	env := xdgconfig.ResolveEnv{
		Getenv:      func(string) string { return "" },
		UserHomeDir: func() (string, error) { return "", os.ErrNotExist },
		ReadFile:    os.ReadFile,
	}
	store := newSessionStateStore(env)
	if gotID, _, ok := store.LoadPointer("t"); ok || gotID != "" {
		t.Fatalf("LoadPointer with no state dir = (%q, _, %v), want zero", gotID, ok)
	}
	if err := store.SavePointer("t", "x", "running"); err == nil {
		t.Fatal("SavePointer with no state dir should report an error")
	}
}

// TestSessionStateStore_SaveZeroSessionIDIsNoOp asserts a zero sessionID (a null
// pointer) is a no-op — it does not write an empty entry.
func TestSessionStateStore_SaveZeroSessionIDIsNoOp(t *testing.T) {
	stateHome := t.TempDir()
	store := newSessionStateStore(fakeStateEnv(stateHome))
	if err := store.SavePointer("t", "", "running"); err != nil {
		t.Fatalf("SavePointer(zero): %v", err)
	}
	// The file should not exist (or be empty) — a null pointer wrote nothing.
	if _, err := os.Stat(filepath.Join(stateHome, sessionStateSubpath)); err == nil {
		data, _ := os.ReadFile(filepath.Join(stateHome, sessionStateSubpath))
		if strings.Contains(string(data), "last_session") {
			t.Fatalf("a zero pointer wrote an entry:\n%s", data)
		}
	}
}

// ensure ptrTriple is used (no unused warning).
var _ = ptrTriple
