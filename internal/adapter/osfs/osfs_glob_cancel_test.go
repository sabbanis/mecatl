package osfs

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"slices"
	"testing"
	"testing/fstest"

	"github.com/bmatcuk/doublestar/v4"
)

func TestGlobCancellationBeforeTraversal(t *testing.T) {
	ws, err := NewWorkspace(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := ws.Glob(ctx, ""); !errors.Is(err, context.Canceled) {
		t.Fatalf("Glob error = %v, want context.Canceled", err)
	}
}

func TestGlobCancellationDuringRecursiveNoMatchTraversal(t *testing.T) {
	ws, err := NewWorkspace(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"a/one.txt", "a/b/two.txt", "a/b/c/three.txt"} {
		if err := ws.Write(context.Background(), path, []byte("content")); err != nil {
			t.Fatal(err)
		}
	}
	ctx := &grepCountingCancelContext{Context: context.Background(), cancelAt: 3}

	if _, err := ws.Glob(ctx, "**/*.never"); !errors.Is(err, context.Canceled) {
		t.Fatalf("Glob error = %v, want cancellation during no-match traversal", err)
	}
}

func TestGlobCancellationFromFinalVisitor(t *testing.T) {
	ws, err := NewWorkspace(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.Write(context.Background(), "only.txt", []byte("content")); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())

	err = ws.fs.globWalk(ctx, "only.txt", func(string, fs.DirEntry) error {
		cancel()
		return nil
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("globWalk error = %v, want cancellation raised by final visitor", err)
	}
}

func TestPathGlobStopsTraversalWhenCancellationReachesReadDir(t *testing.T) {
	for _, test := range []struct {
		name string
		call func(context.Context, *Workspace) error
	}{
		{
			name: "Glob",
			call: func(ctx context.Context, ws *Workspace) error {
				_, err := ws.Glob(ctx, "**/*.never")
				return err
			},
		},
		{
			name: "Grep",
			call: func(ctx context.Context, ws *Workspace) error {
				_, err := ws.Grep(ctx, "needle", "**/*.never")
				return err
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			ws, err := NewWorkspace(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			// Keep many root siblings queued after cancellation. The context cancels at
			// the first recursive ReadDir below the first root child; without production's
			// fail-on-I/O option, doublestar swallows that error and checks every sibling.
			for i := range 32 {
				path := fmt.Sprintf("%02d/child/file.txt", i)
				if err := ws.Write(context.Background(), path, []byte("needle")); err != nil {
					t.Fatal(err)
				}
			}
			const cancelAt = 10
			ctx := &grepCountingCancelContext{Context: context.Background(), cancelAt: cancelAt}

			if err := test.call(ctx, ws); !errors.Is(err, context.Canceled) {
				t.Fatalf("error = %v, want context.Canceled", err)
			}
			if ctx.checks > cancelAt+4 {
				t.Fatalf("context checks = %d, want at most %d; traversal continued after cancellation", ctx.checks, cancelAt+4)
			}
		})
	}
}

func TestGlobWalkPreservesIgnoredIOErrorSemantics(t *testing.T) {
	base := faultingGlobFS{FS: fstest.MapFS{
		"blocked/secret.txt": {Data: []byte("secret")},
		"visible/ok.txt":     {Data: []byte("ok")},
	}}
	var matches []string
	err := doublestar.GlobWalk(globWalkFS{ctx: context.Background(), base: base}, "**/*.txt", func(path string, _ fs.DirEntry) error {
		matches = append(matches, path)
		return nil
	}, doublestar.WithFailOnIOErrors())
	if err != nil {
		t.Fatalf("GlobWalk returned ordinary ReadDir error: %v", err)
	}
	if want := []string{"visible/ok.txt"}; !slices.Equal(matches, want) {
		t.Fatalf("matches = %v, want %v", matches, want)
	}

	err = doublestar.GlobWalk(globWalkFS{ctx: context.Background(), base: base}, "blocked.txt", func(string, fs.DirEntry) error {
		t.Fatal("failed Stat must be treated as a nonmatch")
		return nil
	}, doublestar.WithFailOnIOErrors())
	if err != nil {
		t.Fatalf("GlobWalk returned ordinary Stat error: %v", err)
	}
}

type faultingGlobFS struct{ fs.FS }

func (f faultingGlobFS) ReadDir(name string) ([]fs.DirEntry, error) {
	if name == "blocked" {
		return nil, fs.ErrPermission
	}
	return fs.ReadDir(f.FS, name)
}

func (f faultingGlobFS) Stat(name string) (fs.FileInfo, error) {
	if name == "blocked.txt" {
		return nil, fs.ErrPermission
	}
	return fs.Stat(f.FS, name)
}
