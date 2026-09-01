package memfs_test

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memledger"
)

// TestPersistentReadLedgers_Scenario1_IndependentSessionLedgers pins AC1.3
// (docs/adr/0278): two Workspaces over ONE shared file-content backend
// (memfs.FileSystem) can select two INDEPENDENT tool.ReadLedger instances, so
// a record made through one Workspace's ledger is ABSENT from the other's —
// even though both Workspaces see the same file contents.
func TestPersistentReadLedgers_Scenario1_IndependentSessionLedgers(t *testing.T) {
	ctx := context.Background()
	fs := memfs.NewFileSystem("/ws")
	if err := fs.Write(ctx, "shared.txt", []byte("shared content")); err != nil {
		t.Fatalf("Write: %v", err)
	}

	wsA := memfs.NewWorkspaceOverFileSystem(fs, memledger.New())
	wsB := memfs.NewWorkspaceOverFileSystem(fs, memledger.New())

	// Both Workspaces see the SAME file content (one shared backend).
	dataA, err := wsA.Read(ctx, "shared.txt")
	if err != nil {
		t.Fatalf("wsA.Read: %v", err)
	}
	dataB, err := wsB.Read(ctx, "shared.txt")
	if err != nil {
		t.Fatalf("wsB.Read: %v", err)
	}
	if string(dataA) != string(dataB) {
		t.Fatalf("Workspaces over the same backend saw different content: %q vs %q", dataA, dataB)
	}

	// Record a read through wsA's ledger only.
	_, ver, err := wsA.ReadVersion(ctx, "shared.txt")
	if err != nil {
		t.Fatalf("wsA.ReadVersion: %v", err)
	}
	if err := wsA.RecordRead(ctx, "shared.txt", ver); err != nil {
		t.Fatalf("wsA.RecordRead: %v", err)
	}

	// wsA's own ledger has the record.
	if _, ok, err := wsA.RecordedVersion(ctx, "shared.txt"); err != nil || !ok {
		t.Fatalf("wsA.RecordedVersion = (ok=%v, err=%v), want (true, nil)", ok, err)
	}

	// wsB's INDEPENDENT ledger has NO record of it, despite sharing file content
	// with wsA.
	if _, ok, err := wsB.RecordedVersion(ctx, "shared.txt"); err != nil {
		t.Fatalf("wsB.RecordedVersion: %v", err)
	} else if ok {
		t.Fatal("wsB.RecordedVersion reported ok=true — the two Workspaces' ledgers must be independent")
	}
}

// TestPersistentReadLedgers_Scenario1_DefaultMemoryLifecycle pins AC1.4
// (docs/adr/0278): with no durable ledger explicitly selected, the standard
// construction path (memfs.NewWorkspace) uses a FRESH in-memory ledger, and
// rebuilding the Workspace (as the default per-session factory does on every
// new run) starts with an EMPTY ledger — the existing per-live-Workspace reset
// behaviour (AGENTS.md: "the ledger belongs to the live Workspace/Environment
// instance and resets whenever the default factory rebuilds that Workspace").
func TestPersistentReadLedgers_Scenario1_DefaultMemoryLifecycle(t *testing.T) {
	ctx := context.Background()

	// First "live" Workspace: record a read.
	first := memfs.NewWorkspace("/ws")
	if err := first.Write(ctx, "a.txt", []byte("v1")); err != nil {
		t.Fatalf("Write: %v", err)
	}
	_, ver, err := first.ReadVersion(ctx, "a.txt")
	if err != nil {
		t.Fatalf("ReadVersion: %v", err)
	}
	if err := first.RecordRead(ctx, "a.txt", ver); err != nil {
		t.Fatalf("RecordRead: %v", err)
	}
	if _, ok, err := first.RecordedVersion(ctx, "a.txt"); err != nil || !ok {
		t.Fatalf("first.RecordedVersion = (ok=%v, err=%v), want (true, nil)", ok, err)
	}

	// A REBUILT Workspace (default factory rebuild on the next run, or process
	// restart) is a fresh in-memory ledger: no prior record survives.
	rebuilt := memfs.NewWorkspace("/ws")
	if err := rebuilt.Write(ctx, "a.txt", []byte("v1")); err != nil {
		t.Fatalf("Write (rebuilt): %v", err)
	}
	if _, ok, err := rebuilt.RecordedVersion(ctx, "a.txt"); err != nil {
		t.Fatalf("rebuilt.RecordedVersion: %v", err)
	} else if ok {
		t.Fatal("rebuilt.RecordedVersion reported ok=true — a rebuilt default Workspace must start with an empty ledger")
	}
}
