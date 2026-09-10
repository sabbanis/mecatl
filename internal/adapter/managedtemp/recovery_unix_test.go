//go:build linux || darwin

package managedtemp

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

func TestNamespaceRecoversAfterRemoval(t *testing.T) {
	for _, replacement := range []string{"missing", "recreated", "renamed", "workspaces missing"} {
		t.Run(replacement, func(t *testing.T) {
			ns, workspace := recoveryNamespace(t)
			oldRoot := ns.root
			pinned, err := ns.openRoot()
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = pinned.Close() }()
			oldInfo, err := oldRoot.Stat(".")
			if err != nil {
				t.Fatal(err)
			}
			switch replacement {
			case "renamed":
				err = os.Rename(ns.Path(), ns.Path()+"-retired")
			case "workspaces missing":
				err = os.RemoveAll(filepath.Join(ns.Path(), "workspaces"))
			default:
				err = os.RemoveAll(ns.Path())
			}
			if err != nil {
				t.Fatal(err)
			}
			if replacement == "recreated" {
				if err := os.Mkdir(ns.Path(), 0o700); err != nil {
					t.Fatal(err)
				}
			}
			fresh, err := ns.OpenWorkspace("osfs", "identity", filepath.Dir(ns.Path()))
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			defer func() { _ = fresh.Close() }()
			visible, err := os.Stat(ns.Path())
			if err != nil {
				t.Fatal(err)
			}
			current, err := ns.root.Stat(".")
			if err != nil || !os.SameFile(current, visible) {
				t.Fatalf("recovered handle does not match visible namespace: %v", err)
			}
			if replacement != "workspaces missing" {
				if os.SameFile(oldInfo, current) {
					t.Fatal("namespace inode did not change")
				}
				if _, err := oldRoot.Stat("."); !errors.Is(err, fs.ErrClosed) {
					t.Fatalf("stale namespace handle not retired: %v", err)
				}
			}
			// A sweep already in progress owns a pin, not the replaceable cached root.
			if info, err := pinned.Stat("."); err != nil || !os.SameFile(info, oldInfo) {
				t.Fatalf("recovery invalidated an in-flight operation: %v", err)
			}
			// Recovery must not close a handle an earlier runner/lease still owns.
			if _, err := workspace.root.Stat("."); err != nil {
				t.Fatalf("recovery closed an independently owned workspace: %v", err)
			}
			if lease, err := workspace.Allocate("cmd"); err == nil {
				_ = lease.Close()
				t.Fatal("stale workspace allocated against a replaced visible path")
			}
			lease, err := fresh.Allocate("cmd")
			if err != nil {
				t.Fatalf("allocate after recovery: %v", err)
			}
			if err := lease.Close(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestNamespaceRecoveryRejectsUnsafeReplacement(t *testing.T) {
	for _, replacement := range []string{"symlink", "file", "mode", "owner", "workspaces link", "workspaces mode", "lock link", "missing parent"} {
		t.Run(replacement, func(t *testing.T) {
			ns, _ := recoveryNamespace(t)
			if err := os.RemoveAll(ns.Path()); err != nil {
				t.Fatal(err)
			}
			outside := t.TempDir()
			var err error
			switch replacement {
			case "symlink":
				err = os.Symlink(outside, ns.Path())
			case "file":
				err = os.WriteFile(ns.Path(), []byte("do not change"), 0o600)
			case "missing parent":
				err = os.Remove(filepath.Dir(ns.Path()))
			default:
				err = os.Mkdir(ns.Path(), 0o700)
				if err != nil {
					t.Fatal(err)
				}
				switch replacement {
				case "mode":
					err = os.Chmod(ns.Path(), 0o755)
				case "owner":
					if os.Geteuid() != 0 {
						t.Skip("changing directory owner requires root")
					}
					err = os.Chown(ns.Path(), 1, -1)
				case "workspaces link":
					err = os.Symlink(outside, filepath.Join(ns.Path(), "workspaces"))
				case "workspaces mode":
					err = os.Mkdir(filepath.Join(ns.Path(), "workspaces"), 0o755)
				case "lock link":
					err = os.Symlink(outside, filepath.Join(ns.Path(), "gc.lock"))
				}
			}
			if err != nil {
				t.Fatal(err)
			}
			before, _ := os.Lstat(ns.Path())
			if w, err := ns.OpenWorkspace("osfs", "identity", outside); err == nil {
				_ = w.Close()
				t.Fatal("unsafe namespace accepted")
			}
			after, _ := os.Lstat(ns.Path())
			if before != nil && (after == nil || !os.SameFile(before, after) || before.Mode() != after.Mode()) {
				t.Fatal("unsafe replacement was changed")
			}
			if before != nil && before.IsDir() {
				entries, err := os.ReadDir(ns.Path())
				if err != nil {
					t.Fatal(err)
				}
				want := 0
				if replacement == "workspaces link" || replacement == "workspaces mode" || replacement == "lock link" {
					want = 1
				}
				if len(entries) != want {
					t.Fatalf("recovery mutated unsafe replacement: %v", entries)
				}
			}
			entries, err := os.ReadDir(outside)
			if err != nil || len(entries) != 0 {
				t.Fatalf("recovery escaped namespace: %v, %v", entries, err)
			}
		})
	}
}

func TestNamespaceConcurrentRecovery(t *testing.T) {
	ns, stale := recoveryNamespace(t)
	old := ns.root
	// Pause a real sweep after it pins the old root and acquires its GC lock.
	ctx := &sweepBarrierContext{Context: context.Background(), entered: make(chan struct{}), release: make(chan struct{})}
	defer ctx.unblock()
	swept := make(chan error, 1)
	go func() {
		_, err := ns.Sweep(ctx, SweepOptions{Now: time.Now(), Interval: time.Hour, CommandReapAfter: time.Hour})
		swept <- err
	}()
	select {
	case <-ctx.entered:
	case <-time.After(10 * time.Second):
		t.Fatal("sweep did not reach pinned-root barrier")
	}
	if err := os.Rename(ns.Path(), ns.Path()+"-retired"); err != nil {
		t.Fatal(err)
	}
	const workers = 12
	start := make(chan struct{})
	allocated := make(chan *Lease, workers)
	release := make(chan struct{})
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			<-start
			lease, err := ns.AllocateWorkspace("osfs", "identity", filepath.Dir(ns.Path()), "cmd")
			if err != nil {
				t.Errorf("concurrent recovery/allocation: %v", err)
			}
			allocated <- lease
			<-release
			_ = lease.Close()
		})
	}
	close(start)
	var leases []*Lease
	for range workers {
		select {
		case lease := <-allocated:
			if lease != nil {
				leases = append(leases, lease)
			}
		case <-time.After(10 * time.Second):
			close(release)
			t.Fatal("allocation blocked behind in-flight sweep/recovery")
		}
	}
	// All allocations remain locked while a second sweep visits the recovered
	// namespace. The first sweep is still pinned to the retired namespace.
	result, err := ns.Sweep(context.Background(), SweepOptions{Now: time.Now().Add(2 * time.Hour), Interval: time.Hour, CommandReapAfter: time.Nanosecond})
	if err != nil || !result.Scanned || result.Deleted != 0 {
		t.Errorf("sweep of overlapping live allocations: %+v, %v", result, err)
	}
	for _, lease := range leases {
		if _, err := os.Stat(lease.TempDir()); err != nil {
			t.Errorf("sweep removed live allocation: %v", err)
		}
	}
	close(release)
	wg.Wait()
	ctx.unblock()
	if err := <-swept; err != nil {
		t.Fatalf("recovery invalidated pinned sweep: %v", err)
	}
	if lease, err := stale.Allocate("cmd"); err == nil {
		_ = lease.Close()
		t.Fatal("stale allocation succeeded")
	}
	if _, err := old.Stat("."); !errors.Is(err, fs.ErrClosed) {
		t.Fatalf("old root was not retired: %v", err)
	}
	if err := ns.Close(); err != nil {
		t.Fatal(err)
	}
	if w, err := ns.OpenWorkspace("osfs", "identity", filepath.Dir(ns.Path())); err == nil {
		_ = w.Close()
		t.Fatal("recovery resurrected a closed namespace")
	}
}

type sweepBarrierContext struct {
	context.Context
	calls            atomic.Int32
	entered, release chan struct{}
	once             sync.Once
}

func (c *sweepBarrierContext) Err() error {
	if c.calls.Add(1) == 2 {
		close(c.entered)
		<-c.release
	}
	return c.Context.Err()
}

func (c *sweepBarrierContext) unblock() { c.once.Do(func() { close(c.release) }) }

func TestNamespaceRejectsSymlinkToRetainedRoot(t *testing.T) {
	ns, stale := recoveryNamespace(t)
	retired := ns.Path() + "-retired"
	if err := os.Rename(ns.Path(), retired); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(retired, ns.Path()); err != nil {
		t.Fatal(err)
	}
	if lease, err := stale.Allocate("cmd"); err == nil {
		_ = lease.Close()
		t.Fatal("old runner followed a replacement namespace symlink")
	}
	if w, err := ns.OpenWorkspace("osfs", "identity", filepath.Dir(ns.Path())); err == nil {
		_ = w.Close()
		t.Fatal("recovery followed a replacement namespace symlink")
	}
	if _, err := os.Stat(filepath.Join(stale.Path(), "commands")); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("unsafe allocation mutated retained root: %v", err)
	}
}

func TestNamespaceReadSweepCompletionRecovers(t *testing.T) {
	ns, _ := recoveryNamespace(t)
	opts := SweepOptions{Now: time.Now(), Interval: time.Hour, CommandReapAfter: time.Hour}
	if _, err := ns.Sweep(context.Background(), opts); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(ns.Path(), ns.Path()+"-retired"); err != nil {
		t.Fatal(err)
	}
	if _, err := ns.ReadSweepCompletion(); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("read returned retired namespace's completion instead of recovering: %v", err)
	}
	if _, err := os.Stat(ns.Path()); err != nil {
		t.Fatalf("read did not recover configured root: %v", err)
	}
}

func TestWorkspaceManifestChecksVisibleIdentityBeforeMutation(t *testing.T) {
	for _, existing := range []bool{false, true} {
		t.Run(map[bool]string{false: "create", true: "replace"}[existing], func(t *testing.T) {
			_, w := recoveryNamespace(t)
			before, err := w.root.ReadFile("workspace.manifest")
			if err != nil {
				t.Fatal(err)
			}
			if !existing {
				if err := w.root.Remove("workspace.manifest"); err != nil {
					t.Fatal(err)
				}
			}
			if err := os.Rename(w.Path(), w.Path()+"-retired"); err != nil {
				t.Fatal(err)
			}
			if err := os.Mkdir(w.Path(), 0o700); err != nil {
				t.Fatal(err)
			}
			manifest, err := workspaceManifestJSON(filepath.Base(w.Path()), "/changed")
			if err != nil {
				t.Fatal(err)
			}
			if err := w.writeWorkspaceManifest(manifest, "/changed"); err == nil {
				t.Fatal("manifest mutated through a retained handle after replacement")
			}
			after, err := w.root.ReadFile("workspace.manifest")
			if existing && (err != nil || string(after) != string(before)) {
				t.Fatalf("retired manifest changed: %q, %v", after, err)
			}
			if !existing && !errors.Is(err, fs.ErrNotExist) {
				t.Fatalf("manifest created in retired workspace: %q, %v", after, err)
			}
			entries, err := os.ReadDir(w.Path())
			if err != nil || len(entries) != 0 {
				t.Fatalf("replacement workspace changed: %v, %v", entries, err)
			}
		})
	}
}

type ownerFileInfo struct {
	fs.FileInfo
	stat syscall.Stat_t
}

func (i ownerFileInfo) Sys() any { return &i.stat }

func TestRecoveryRejectsWrongOwnerWithoutPrivileges(t *testing.T) {
	ns, _ := recoveryNamespace(t)
	info, err := os.Lstat(ns.Path())
	if err != nil {
		t.Fatal(err)
	}
	if err := validatePrivateDirInfo(info); err != nil {
		t.Fatalf("valid owner fixture: %v", err)
	}
	stat := *info.Sys().(*syscall.Stat_t)
	stat.Uid ^= 1
	if err := validatePrivateDirInfo(ownerFileInfo{FileInfo: info, stat: stat}); err == nil {
		t.Fatal("recovery's private-directory validator accepted a different UID")
	}
}

func TestAllocateWorkspaceOwnsAndClosesHandles(t *testing.T) {
	ns, _ := recoveryNamespace(t)
	for range 32 {
		lease, err := ns.AllocateWorkspace("osfs", "identity", filepath.Dir(ns.Path()), "cmd")
		if err != nil {
			t.Fatal(err)
		}
		parent, root := lease.parent.root, lease.root
		if err := lease.Remove(); err != nil {
			t.Fatal(err)
		}
		for _, handle := range []*os.Root{parent, root} {
			if _, err := handle.Stat("."); !errors.Is(err, fs.ErrClosed) {
				t.Fatalf("per-allocation handle leaked: %v", err)
			}
		}
	}
}

func recoveryNamespace(t *testing.T) (*Namespace, *Workspace) {
	t.Helper()
	ns, err := Open(filepath.Join(t.TempDir(), "managed"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ns.Close() })
	w, err := ns.OpenWorkspace("osfs", "identity", filepath.Dir(ns.Path()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close() })
	return ns, w
}
