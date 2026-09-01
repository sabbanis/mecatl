package fstools

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/tool"
)

// ledger_failure_test.go pins the Scenario 3 fail-closed acceptance criteria
// (docs/adr/0278): a failed RecordRead, an unavailable/corrupt RecordedVersion
// lookup, and a post-mutation RecordRead failure must all fail closed without
// ever weakening the final ReplaceFile/CreateFile CAS.

var (
	// errSimulatedLedgerRecord is a sentinel a fake ReadLedger returns from
	// RecordRead to simulate a genuine ledger storage/write failure.
	errSimulatedLedgerRecord = errors.New("simulated ledger record failure")
	// errSimulatedLedgerLookup is a sentinel a fake ReadLedger returns from
	// RecordedVersion to simulate an unavailable/corrupt ledger lookup.
	errSimulatedLedgerLookup = errors.New("simulated ledger lookup failure")
)

// ledgerFailureWorkspace wraps a real tool.Workspace and can be programmed to
// fail RecordRead and/or RecordedVersion on demand, while every other
// operation (Read, ReadVersion, CreateFile, ReplaceFile, Glob, Grep, Stat)
// delegates unchanged to the embedded Workspace. This lets a test inject a
// genuine ledger-layer failure independent of file-content operations,
// exactly the seam ADR 0278 introduces.
type ledgerFailureWorkspace struct {
	tool.Workspace

	// recordReadErr, if non-nil, is returned by the NEXT RecordRead call
	// instead of delegating; it is then cleared unless recordReadSticky.
	recordReadErr    error
	recordReadSticky bool

	// lookupErr, if non-nil, is returned by EVERY RecordedVersion call instead
	// of delegating (a lookup failure is modeled as sticky/ongoing, since an
	// unavailable backend does not usually self-heal mid-test).
	lookupErr error

	// replaceFileCalled/createFileCalled record whether the final CAS mutation
	// was ever reached, so a test can assert a lookup failure refuses BEFORE
	// the mutation rather than merely producing an error result some other way.
	replaceFileCalled bool
	createFileCalled  bool
}

func (w *ledgerFailureWorkspace) RecordRead(ctx context.Context, path string, version tool.FileVersion) error {
	if w.recordReadErr != nil {
		err := w.recordReadErr
		if !w.recordReadSticky {
			w.recordReadErr = nil
		}
		return err
	}
	return w.Workspace.RecordRead(ctx, path, version)
}

func (w *ledgerFailureWorkspace) RecordedVersion(ctx context.Context, path string) (tool.FileVersion, bool, error) {
	if w.lookupErr != nil {
		return tool.FileVersion{}, false, w.lookupErr
	}
	return w.Workspace.RecordedVersion(ctx, path)
}

func (w *ledgerFailureWorkspace) ReplaceFile(ctx context.Context, path string, old tool.FileVersion, data []byte) (tool.FileVersion, error) {
	w.replaceFileCalled = true
	return w.Workspace.ReplaceFile(ctx, path, old, data)
}

func (w *ledgerFailureWorkspace) CreateFile(ctx context.Context, path string, data []byte) (tool.FileVersion, error) {
	w.createFileCalled = true
	return w.Workspace.CreateFile(ctx, path, data)
}

// TestPersistentReadLedgers_Scenario3_ReadRecordFailureFailsClosed pins AC3.1:
// if recording a successful Read fails, the tool reports that the read
// evidence was not retained, and a LATER Edit or existing-file Write is
// refused until a Read is recorded successfully.
func TestPersistentReadLedgers_Scenario3_ReadRecordFailureFailsClosed(t *testing.T) {
	base := memfs.NewWorkspace("/")
	seed(t, base, "a.txt", "hello\n")
	ws := &ledgerFailureWorkspace{Workspace: base, recordReadErr: errSimulatedLedgerRecord}

	// The Read itself succeeded (content is readable) but the record failed:
	// the tool must report BOTH facts.
	res := exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), ws)
	if !res.IsError {
		t.Fatalf("Read with a failed RecordRead must be a tool error, got: %s", res.Content)
	}
	if !strings.Contains(res.Content, "hello") && !strings.Contains(res.Content, "read") {
		t.Fatalf("Read-record-failure result should still be informative about the read: %q", res.Content)
	}
	if !strings.Contains(res.Content, "not retained") && !strings.Contains(res.Content, "failed to retain") {
		t.Fatalf("Read-record-failure result must say the evidence was not retained: %q", res.Content)
	}

	// A later Edit is refused: no valid evidence was ever recorded.
	editRes := exec(t, EditTool{}, call(t, "Edit", map[string]any{
		"path": "a.txt", "old_string": "hello", "new_string": "hi",
	}), ws)
	if !editRes.IsError {
		t.Fatal("Edit after a failed RecordRead must be refused (no evidence was retained)")
	}

	// Once the ledger failure clears and a Read succeeds, Edit is authorized.
	ws.recordReadErr = nil
	exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), ws)
	editRes = exec(t, EditTool{}, call(t, "Edit", map[string]any{
		"path": "a.txt", "old_string": "hello", "new_string": "hi",
	}), ws)
	if editRes.IsError {
		t.Fatalf("Edit after a SUCCESSFUL Read-record should succeed, got: %s", editRes.Content)
	}
}

// TestPersistentReadLedgers_Scenario3_LookupFailurePreventsMutation pins
// AC3.2: an unavailable or corrupt ledger lookup refuses Edit and
// existing-file Write BEFORE ReplaceFile is ever called; it must never be
// treated as an unrecorded-but-otherwise-authorized read.
func TestPersistentReadLedgers_Scenario3_LookupFailurePreventsMutation(t *testing.T) {
	t.Run("Edit", func(t *testing.T) {
		base := memfs.NewWorkspace("/")
		seed(t, base, "a.txt", "hello\n")
		exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), base)

		ws := &ledgerFailureWorkspace{Workspace: base, lookupErr: errSimulatedLedgerLookup}
		res := exec(t, EditTool{}, call(t, "Edit", map[string]any{
			"path": "a.txt", "old_string": "hello", "new_string": "hi",
		}), ws)
		if !res.IsError {
			t.Fatal("Edit with an unavailable ledger lookup must be refused")
		}
		if ws.replaceFileCalled {
			t.Fatal("Edit must refuse BEFORE ReplaceFile is ever called on a lookup failure")
		}
	})

	t.Run("Write", func(t *testing.T) {
		base := memfs.NewWorkspace("/")
		seed(t, base, "a.txt", "old\n")
		exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), base)

		ws := &ledgerFailureWorkspace{Workspace: base, lookupErr: errSimulatedLedgerLookup}
		res := exec(t, WriteTool{}, call(t, "Write", map[string]any{
			"path": "a.txt", "content": "new\n",
		}), ws)
		if !res.IsError {
			t.Fatal("Write with an unavailable ledger lookup must be refused")
		}
		if ws.replaceFileCalled {
			t.Fatal("Write must refuse BEFORE ReplaceFile is ever called on a lookup failure")
		}
	})
}

// TestPersistentReadLedgers_Scenario3_CreateOnlyUnchanged pins AC3.5: new-file
// Write remains create-only and does not require a ledger entry (no prior Read
// needed); concurrent creators still produce exactly one winner (the loser
// gets a model-visible create-conflict refusal, and the winner's content
// survives).
func TestPersistentReadLedgers_Scenario3_CreateOnlyUnchanged(t *testing.T) {
	// No prior Read is needed for a brand-new file, even with an armed ledger
	// wrapper that would fail any RecordedVersion lookup — proving Write's
	// create path never consults the ledger before CreateFile.
	base := memfs.NewWorkspace("/")
	ws := &ledgerFailureWorkspace{Workspace: base, lookupErr: errSimulatedLedgerLookup}
	res := exec(t, WriteTool{}, call(t, "Write", map[string]any{
		"path": "new.txt", "content": "fresh\n",
	}), ws)
	if res.IsError {
		t.Fatalf("Write of a new file must not consult the ledger lookup, got: %s", res.Content)
	}
	data, err := base.Read(context.Background(), "new.txt")
	if err != nil || string(data) != "fresh\n" {
		t.Fatalf("new file content = (%q, %v), want (\"fresh\\n\", nil)", data, err)
	}

	// Concurrent creators: exactly one winner (mirrors
	// TestWriteCreateOnlyRejectsConcurrentCreate's proof under the revised seam).
	baseConcurrent := memfs.NewWorkspace("/")
	cws := &createConflictWorkspace{Workspace: baseConcurrent}
	res = exec(t, WriteTool{}, call(t, "Write", map[string]any{
		"path": "race.txt", "content": "agent\n",
	}), cws)
	if !res.IsError || !strings.Contains(res.Content, "already exists") {
		t.Fatalf("concurrent create result = (error=%v, content=%q), want model-visible create refusal", res.IsError, res.Content)
	}
	final, err := baseConcurrent.Read(context.Background(), "race.txt")
	if err != nil {
		t.Fatalf("Read final file: %v", err)
	}
	if string(final) != "concurrent\n" {
		t.Fatalf("final file = %q, want the concurrent create preserved (exactly one winner)", final)
	}
}

// TestPersistentReadLedgers_Scenario3_PostMutationRecordFailure pins AC3.6: if
// persisting the new version after a successful create or replace fails, the
// tool reports BOTH the successful mutation and the record failure — WITHOUT
// rollback — and the NEXT existing-file mutation is refused until another
// successful Read records evidence.
func TestPersistentReadLedgers_Scenario3_PostMutationRecordFailure(t *testing.T) {
	t.Run("Edit", func(t *testing.T) {
		base := memfs.NewWorkspace("/")
		seed(t, base, "a.txt", "hello\n")
		exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), base)

		ws := &ledgerFailureWorkspace{Workspace: base}
		// Arm the record failure only for the POST-mutation re-record (the Edit
		// under test performs exactly one RecordRead call, at the end).
		ws.recordReadErr = errSimulatedLedgerRecord

		res := exec(t, EditTool{}, call(t, "Edit", map[string]any{
			"path": "a.txt", "old_string": "hello", "new_string": "hi",
		}), ws)
		if !res.IsError {
			t.Fatalf("Edit must report the record failure as an error result, got: %s", res.Content)
		}
		// The mutation ALREADY SUCCEEDED — no rollback.
		data, err := base.Read(context.Background(), "a.txt")
		if err != nil || string(data) != "hi\n" {
			t.Fatalf("file content after post-mutation record failure = (%q, %v), want (\"hi\\n\", nil) — no rollback", data, err)
		}
		if !strings.Contains(res.Content, "edited") && !strings.Contains(res.Content, "replaced") {
			t.Fatalf("result must report the successful edit despite the record failure: %q", res.Content)
		}
		if !strings.Contains(res.Content, "not retained") && !strings.Contains(res.Content, "failed to retain") {
			t.Fatalf("result must report the record failure: %q", res.Content)
		}

		// The next existing-file mutation is refused: no valid evidence exists.
		next := exec(t, EditTool{}, call(t, "Edit", map[string]any{
			"path": "a.txt", "old_string": "hi", "new_string": "bye",
		}), ws)
		if !next.IsError {
			t.Fatal("the next Edit must be refused until another successful Read records evidence")
		}
	})

	t.Run("Write overwrite", func(t *testing.T) {
		base := memfs.NewWorkspace("/")
		seed(t, base, "a.txt", "old\n")
		exec(t, ReadTool{}, call(t, "Read", map[string]any{"path": "a.txt"}), base)

		ws := &ledgerFailureWorkspace{Workspace: base, recordReadErr: errSimulatedLedgerRecord}
		res := exec(t, WriteTool{}, call(t, "Write", map[string]any{
			"path": "a.txt", "content": "new\n",
		}), ws)
		if !res.IsError {
			t.Fatalf("Write overwrite must report the record failure as an error result, got: %s", res.Content)
		}
		data, err := base.Read(context.Background(), "a.txt")
		if err != nil || string(data) != "new\n" {
			t.Fatalf("file content after post-mutation record failure = (%q, %v), want (\"new\\n\", nil) — no rollback", data, err)
		}
		if !strings.Contains(res.Content, "overwrote") {
			t.Fatalf("result must report the successful overwrite despite the record failure: %q", res.Content)
		}

		next := exec(t, WriteTool{}, call(t, "Write", map[string]any{
			"path": "a.txt", "content": "again\n",
		}), ws)
		if !next.IsError {
			t.Fatal("the next Write overwrite must be refused until another successful Read records evidence")
		}
	})

	t.Run("Write create", func(t *testing.T) {
		base := memfs.NewWorkspace("/")
		ws := &ledgerFailureWorkspace{Workspace: base, recordReadErr: errSimulatedLedgerRecord}
		res := exec(t, WriteTool{}, call(t, "Write", map[string]any{
			"path": "new.txt", "content": "fresh\n",
		}), ws)
		if !res.IsError {
			t.Fatalf("Write create must report the record failure as an error result, got: %s", res.Content)
		}
		data, err := base.Read(context.Background(), "new.txt")
		if err != nil || string(data) != "fresh\n" {
			t.Fatalf("file content after post-create record failure = (%q, %v), want (\"fresh\\n\", nil) — no rollback", data, err)
		}
		if !strings.Contains(res.Content, "wrote") {
			t.Fatalf("result must report the successful create despite the record failure: %q", res.Content)
		}

		// A later Edit on this now-existing file is refused: no valid evidence.
		next := exec(t, EditTool{}, call(t, "Edit", map[string]any{
			"path": "new.txt", "old_string": "fresh", "new_string": "stale",
		}), ws)
		if !next.IsError {
			t.Fatal("Edit of the newly-created file must be refused until a successful Read records evidence")
		}
	})
}
