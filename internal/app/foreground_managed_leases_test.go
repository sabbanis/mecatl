package app

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/internal/adapter/managedtemp"
	"github.com/stacklok/mecatl/internal/testutil/testhome"
)

func managedLeaseConfig(t *testing.T, workspace, managedRoot string) Config {
	t.Helper()
	storage, err := openManagedTemporaryStorage(temporaryStorageConfig{Mode: temporaryStorageManaged, ManagedRoot: managedRoot})
	if err != nil {
		t.Fatalf("open managed temporary storage: %v", err)
	}
	t.Cleanup(storage.close)
	return Config{
		Workspace:   workspace,
		Shell:       "/bin/sh",
		managedTemp: storage,
		temporaryStorage: temporaryStorageConfig{
			Mode:        temporaryStorageManaged,
			ManagedRoot: managedRoot,
		},
	}
}

// TestADR_0281_ForegroundLeaseOverlayAndMetadataPrivacy pins the foreground
// managed lease contract at the real command runner boundary.
func TestADR_0281_ForegroundLeaseOverlayAndMetadataPrivacy(t *testing.T) {
	workspace := t.TempDir()
	managedRoot := filepath.Join(t.TempDir(), "managed")
	t.Setenv("OPENROUTER_API_KEY", "must-not-leak")
	runner := buildCommandRunnerForRoot(managedLeaseConfig(t, workspace, managedRoot), workspace)
	if runner == nil {
		t.Fatal("managed command runner is unavailable")
	}
	command := "printf '%s\\n%s\\n' \"$TMPDIR\" \"$GOTMPDIR\"; cat \"$TMPDIR/../manifest.json\"; printf '\\nsecret=%s\\n' \"$OPENROUTER_API_KEY\""
	res, err := runner.Run(context.Background(), command)
	if err != nil || res.ExitCode != 0 {
		t.Fatalf("Run = %+v, %v", res, err)
	}
	lines := strings.Split(strings.TrimSpace(res.Stdout), "\n")
	if len(lines) < 4 {
		t.Fatalf("managed command output = %q", res.Stdout)
	}
	if lines[3] != "secret=" {
		t.Fatalf("managed overlay restored scrubbed credential: %q", lines[3])
	}
	if lines[0] != lines[1] || !strings.HasSuffix(lines[0], "/tmp") || !strings.Contains(lines[0], "/cmd-") {
		t.Fatalf("temporary overlay = %q, %q; want one cmd-<id>/tmp directory", lines[0], lines[1])
	}
	if strings.Contains(command, lines[0]) || strings.Contains(command, strings.TrimSuffix(lines[0], "/tmp")) {
		t.Fatalf("shell text contains injected managed path: %q", command)
	}
	manifest := strings.Join(lines[2:], "\n")
	for _, forbidden := range []string{"printf", "TMPDIR", "GOTMPDIR", "environment", "credential", "output", "transcript"} {
		if strings.Contains(strings.ToLower(manifest), strings.ToLower(forbidden)) {
			t.Fatalf("lease manifest exposes %q: %s", forbidden, manifest)
		}
	}
	if _, err := os.Stat(filepath.Dir(lines[0])); !os.IsNotExist(err) {
		t.Fatalf("completed lease remains at %q: %v", filepath.Dir(lines[0]), err)
	}
}

// findManagedLeaseDir walks root looking for an allocated "cmd-*"/"job-*"
// lease directory (managedtemp.Workspace.Allocate's naming). It exists so the
// "cancel" case below can confirm the command actually started (Allocate runs
// synchronously in osfs's CommandRunner.run, before cmd.Start) instead of
// racing a fixed sleep against process fork/exec under load.
func findManagedLeaseDir(root string) (string, bool) {
	var found string
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || found != "" {
			return nil //nolint:nilerr // tolerant scan: skip races/permission churn, keep walking
		}
		if d.IsDir() && (strings.HasPrefix(d.Name(), "cmd-") || strings.HasPrefix(d.Name(), "job-")) {
			found = path
			return fs.SkipAll
		}
		return nil
	})
	return found, found != ""
}

// TestADR_0281_LeaseCleanupPreservesCommandOutcome pins that cleanup happens
// after the command outcome is fixed, including cancellation and deadline.
func TestADR_0281_LeaseCleanupPreservesCommandOutcome(t *testing.T) {
	workspace := t.TempDir()
	managedRoot := filepath.Join(t.TempDir(), "managed")
	runner := buildCommandRunnerForRoot(managedLeaseConfig(t, workspace, managedRoot), workspace)
	if runner == nil {
		t.Fatal("managed command runner is unavailable")
	}
	for _, tc := range []struct {
		name     string
		ctx      func() (context.Context, context.CancelFunc)
		command  string
		wantErr  error
		wantExit int
	}{
		{name: "non-zero", ctx: func() (context.Context, context.CancelFunc) { return context.WithCancel(context.Background()) }, command: "printf %s \"$TMPDIR\"; exit 7", wantExit: 7},
		{name: "cancel", ctx: func() (context.Context, context.CancelFunc) { return context.WithCancel(context.Background()) }, command: "printf %s \"$TMPDIR\"; sleep 30", wantErr: context.Canceled},
		{name: "timeout", ctx: func() (context.Context, context.CancelFunc) {
			// A generous margin over the default 20ms: under a loaded full-suite
			// run, process fork/exec can occasionally exceed a razor-thin deadline
			// before the shell even starts, making the outcome timing-dependent
			// rather than a genuine deadline-exceeded exercise.
			return context.WithTimeout(context.Background(), 300*time.Millisecond)
		}, command: "printf %s \"$TMPDIR\"; sleep 30", wantErr: context.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := tc.ctx()
			defer cancel()
			// leaseCh carries the REAL lease dir observed on disk while the command
			// is still running, for the cancel case: relying on res.Stdout (the
			// command's own "$TMPDIR" echo) races cancellation against the shell's
			// fork/exec — a fixed sleep before cancel() could fire before the shell
			// even started, leaving Stdout empty and lease == "." (always exists),
			// which was the "terminal lease remains at \".\"" flake. Polling for the
			// lease directory (created synchronously by osfs's managedLease, before
			// cmd.Start) proves the command actually started before we cancel it.
			leaseCh := make(chan string, 1)
			if tc.wantErr == context.Canceled {
				go func() {
					var dir string
					eventually(2*time.Second, func() bool {
						d, ok := findManagedLeaseDir(managedRoot)
						if ok {
							dir = d
						}
						return ok
					})
					leaseCh <- dir
					cancel()
				}()
			}
			res, err := runner.Run(ctx, tc.command)
			if !errors.Is(err, tc.wantErr) || (tc.wantErr == nil && err != nil) || res.ExitCode != tc.wantExit {
				t.Fatalf("Run = %+v, %v; want exit %d, err %v", res, err, tc.wantExit, tc.wantErr)
			}
			lease := filepath.Dir(strings.TrimSpace(res.Stdout))
			if tc.wantErr == context.Canceled {
				if got := <-leaseCh; got != "" {
					lease = got
				}
			}
			if _, err := os.Stat(lease); !os.IsNotExist(err) {
				t.Fatalf("terminal lease remains at %q: %v", lease, err)
			}
		})
	}
}

// TestADR_0281_GroupLivenessControlsImmediateCleanup pins the documented group
// boundary: a live managed group retains its lease, while an escaped process
// does not block cleanup after the managed group exits.
func TestADR_0281_GroupLivenessControlsImmediateCleanup(t *testing.T) {
	workspace := t.TempDir()
	managedRoot := filepath.Join(t.TempDir(), "managed")
	runner := buildCommandRunnerForRoot(managedLeaseConfig(t, workspace, managedRoot), workspace)
	if runner == nil {
		t.Fatal("managed command runner is unavailable")
	}
	live, err := runner.Run(context.Background(), "sleep 1 </dev/null >/dev/null 2>&1 & printf %s \"$TMPDIR\"")
	if err != nil || live.ExitCode != 0 {
		t.Fatalf("live-group Run = %+v, %v", live, err)
	}
	liveLease := filepath.Dir(strings.TrimSpace(live.Stdout))
	manifest, err := os.ReadFile(filepath.Join(liveLease, "manifest.json"))
	if err != nil || !strings.Contains(string(manifest), "terminal") {
		t.Fatalf("live group did not retain terminal lifecycle record: %v, %s", err, manifest)
	}

	escaped, err := runner.Run(context.Background(), "setsid sleep 1 </dev/null >/dev/null 2>&1 & sleep 0.05; printf %s \"$TMPDIR\"")
	if err != nil || escaped.ExitCode != 0 {
		t.Fatalf("escaped Run = %+v, %v", escaped, err)
	}
	if _, err := os.Stat(filepath.Dir(strings.TrimSpace(escaped.Stdout))); !os.IsNotExist(err) {
		t.Fatalf("escaped descendant retained completed group lease: %v", err)
	}
}

// TestADR_0281_TestHomeUsesValidatedLeaseMarker pins that only a real lease
// directs process-wide test-home state beneath a managed command allocation.
func TestADR_0281_TestHomeUsesValidatedLeaseMarker(t *testing.T) {
	ns, err := managedtemp.Open(filepath.Join(t.TempDir(), "managed"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ns.Close() })
	workspace, err := ns.OpenWorkspace("osfs", "test-home-workspace", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })
	lease, err := workspace.Allocate("cmd")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = lease.Close() })
	// testhome deliberately changes process-wide variables; keep this test's
	// helper invocation from contaminating unrelated app tests in this package.
	t.Setenv("HOME", os.Getenv("HOME"))
	t.Setenv("XDG_CONFIG_HOME", os.Getenv("XDG_CONFIG_HOME"))

	for _, tc := range []struct {
		name   string
		marker string
		inside bool
	}{
		{name: "validated", marker: lease.Path(), inside: true},
		{name: "absent", marker: "", inside: false},
		{name: "forged", marker: t.TempDir(), inside: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("MECATL_TEST_TEMP_LEASE", tc.marker)
			var home string
			if exit := testhome.Run("managed", func() int { home = os.Getenv("HOME"); return 0 }); exit != 0 {
				t.Fatalf("testhome.Run exit = %d", exit)
			}
			if got := strings.HasPrefix(home, lease.Path()+string(filepath.Separator)); got != tc.inside {
				t.Fatalf("HOME = %q, inside managed lease = %v; want %v", home, got, tc.inside)
			}
		})
	}
}

// TestADR_0281_ChildEnvironmentGetsDistinctAffinedLease pins that separate
// child namespace runners allocate separate managed workspace leases.
func TestADR_0281_ChildEnvironmentGetsDistinctAffinedLease(t *testing.T) {
	managedRoot := filepath.Join(t.TempDir(), "managed")
	parent := t.TempDir()
	child := t.TempDir()
	cfg := managedLeaseConfig(t, parent, managedRoot)
	parentRunner := buildCommandRunnerForRoot(cfg, parent)
	childRunner := buildCommandRunnerForRoot(cfg, child)
	if parentRunner == nil || childRunner == nil {
		t.Fatal("managed command runner is unavailable")
	}
	parentResult, err := parentRunner.Run(context.Background(), "printf %s \"$TMPDIR\"")
	if err != nil {
		t.Fatal(err)
	}
	childResult, err := childRunner.Run(context.Background(), "printf %s \"$TMPDIR\"")
	if err != nil {
		t.Fatal(err)
	}
	parentPath, childPath := strings.TrimSpace(parentResult.Stdout), strings.TrimSpace(childResult.Stdout)
	if parentPath == childPath || filepath.Dir(filepath.Dir(parentPath)) == filepath.Dir(filepath.Dir(childPath)) {
		t.Fatalf("parent and child lease paths are not distinct and workspace-affined: %q / %q", parentPath, childPath)
	}
}
