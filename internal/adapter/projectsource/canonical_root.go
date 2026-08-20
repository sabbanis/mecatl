// Package projectsource implements immutable local working-source registries.
package projectsource

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/osfs"
	"github.com/stacklok/mecatl/internal/project"
)

// CanonicalRoot is a one-entry immutable registry for a local canonical root.
// The root stays private to the adapter; Project callers receive only its opaque
// source reference and configured display label.
type CanonicalRoot struct {
	root   string
	source project.WorkingSource
}

var _ project.SourceRegistry = (*CanonicalRoot)(nil)

// NewCanonicalRoot creates an immutable local registry. Its source reference is
// a domain-separated digest of the physically canonical root, stable across a
// restart at the same binding and never path-bearing.
func NewCanonicalRoot(root, label string) (*CanonicalRoot, error) {
	canonical, err := canonicalRoot(root)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256([]byte("mecatl/project-source/local-root/v1\x00" + canonical))
	source := project.WorkingSource{
		Ref:   project.SourceRef(base64.RawURLEncoding.EncodeToString(digest[:])),
		Label: label,
	}
	if err := project.ValidateWorkingSource(source); err != nil {
		return nil, err
	}
	return &CanonicalRoot{root: canonical, source: source}, nil
}

// ListWorking returns the registry's one locator-free working source.
func (r *CanonicalRoot) ListWorking(ctx context.Context) ([]project.WorkingSource, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return []project.WorkingSource{r.source}, nil
}

// ResolveWorking returns an Environment confined to the registered canonical
// root. The shell is intentionally absent at this adapter boundary; composition
// can wrap the resolved workspace in a complete shell-bearing Environment when
// it wires the Project-session lifecycle.
func (r *CanonicalRoot) ResolveWorking(ctx context.Context, ref project.SourceRef) (tool.Environment, error) {
	if err := ctx.Err(); err != nil {
		return tool.Environment{}, err
	}
	if ref != r.source.Ref {
		return tool.Environment{}, fmt.Errorf("projectsource: resolve source: %w", project.ErrSourceNotFound)
	}
	ws, err := osfs.NewWorkspace(r.root)
	if err != nil {
		return tool.Environment{}, fmt.Errorf("projectsource: open working source: %w", err)
	}
	return tool.NewEnvironment(session.EnvironmentRef{Kind: session.EnvKindLocal, ID: r.root}, ws, nil)
}

func canonicalRoot(root string) (string, error) {
	if root == "" {
		return "", fmt.Errorf("projectsource: canonical root is required")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("projectsource: make root absolute: %w", err)
	}
	canonical, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return "", fmt.Errorf("projectsource: canonicalize root: %w", err)
	}
	info, err := os.Stat(canonical)
	if err != nil {
		return "", fmt.Errorf("projectsource: stat canonical root: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("projectsource: canonical root is not a directory")
	}
	return canonical, nil
}
