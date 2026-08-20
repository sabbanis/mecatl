package projectsource_test

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/projectsource"
	"github.com/stacklok/mecatl/internal/project"
)

func TestCanonicalRootRegistry_ListsOpaqueStableSourceAndResolvesEnvironment(t *testing.T) {
	root := t.TempDir()
	registry, err := projectsource.NewCanonicalRoot(root, "Canonical root")
	if err != nil {
		t.Fatalf("NewCanonicalRoot: %v", err)
	}
	sources, err := registry.ListWorking(context.Background())
	if err != nil {
		t.Fatalf("ListWorking: %v", err)
	}
	if len(sources) != 1 || sources[0].Ref == "" || sources[0].Label != "Canonical root" {
		t.Fatalf("ListWorking = %#v", sources)
	}
	if strings.Contains(string(sources[0].Ref), root) {
		t.Fatalf("source ref leaks root %q: %q", root, sources[0].Ref)
	}
	reopened, err := projectsource.NewCanonicalRoot(root, "Renamed root")
	if err != nil {
		t.Fatalf("reopen NewCanonicalRoot: %v", err)
	}
	reopenedSources, err := reopened.ListWorking(context.Background())
	if err != nil {
		t.Fatalf("reopen ListWorking: %v", err)
	}
	if reopenedSources[0].Ref != sources[0].Ref {
		t.Fatalf("source ref changed across reopen: %q != %q", reopenedSources[0].Ref, sources[0].Ref)
	}
	if _, err := registry.ResolveWorking(context.Background(), project.SourceRef("unknown")); !errors.Is(err, project.ErrSourceNotFound) {
		t.Fatalf("ResolveWorking(unknown) = %v, want ErrSourceNotFound", err)
	}
	env, err := registry.ResolveWorking(context.Background(), sources[0].Ref)
	if err != nil {
		t.Fatalf("ResolveWorking: %v", err)
	}
	want, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatalf("EvalSymlinks: %v", err)
	}
	if got := env.Workspace().Root(); got != want {
		t.Fatalf("workspace root = %q, want %q", got, want)
	}
}
