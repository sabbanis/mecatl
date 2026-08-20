package projectstore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gofrs/flock"

	"github.com/stacklok/mecatl/internal/project"
)

const localLockRetry = 5 * time.Millisecond

// Local is a durable, single-host Project store rooted under a server state
// directory. Its physical layout and locking are adapter details; callers use
// only the project.Store contract.
type Local struct {
	dir      string
	lockPath string
}

var _ project.Store = (*Local)(nil)

// NewLocal opens a durable Project store below stateDir. It creates only
// owner-readable state directories; a caller selects this adapter for the
// local --store-dir deployment posture.
func NewLocal(stateDir string) (*Local, error) {
	if stateDir == "" {
		return nil, fmt.Errorf("projectstore: local store requires a state directory")
	}
	dir := filepath.Join(stateDir, "projects")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("projectstore: create local directory: %w", err)
	}
	return &Local{dir: dir, lockPath: filepath.Join(dir, ".projects.lock")}, nil
}

// Create atomically writes a new Project document.
func (s *Local) Create(ctx context.Context, item project.Project) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := item.Validate(); err != nil {
		return err
	}
	return s.withLock(ctx, func() error {
		if _, err := s.read(item.ID); err == nil {
			return fmt.Errorf("projectstore: create %q: %w", item.ID, project.ErrAlreadyExists)
		} else if !errors.Is(err, project.ErrNotFound) {
			return err
		}
		return s.write(item)
	})
}

// Load returns the current complete Project document when it is visible to ownership.
func (s *Local) Load(ctx context.Context, id string, ownership project.Ownership) (project.Project, error) {
	if err := ctx.Err(); err != nil {
		return project.Project{}, err
	}
	var out project.Project
	err := s.withLock(ctx, func() error {
		item, err := s.read(id)
		if err != nil {
			return err
		}
		if !ownership.Allows(item.Owner) {
			return fmt.Errorf("projectstore: load %q: %w", id, project.ErrNotFound)
		}
		out = item
		return nil
	})
	return out, err
}

// Replace atomically checks ownership and expectedRevision before replacing the complete document.
func (s *Local) Replace(ctx context.Context, item project.Project, expectedRevision int64, ownership project.Ownership) (project.Project, error) {
	if err := ctx.Err(); err != nil {
		return project.Project{}, err
	}
	if err := item.Validate(); err != nil {
		return project.Project{}, err
	}
	var out project.Project
	err := s.withLock(ctx, func() error {
		current, err := s.read(item.ID)
		if err != nil {
			return err
		}
		if !ownership.Allows(current.Owner) {
			return fmt.Errorf("projectstore: replace %q: %w", item.ID, project.ErrNotFound)
		}
		if current.Revision != expectedRevision || item.Revision != expectedRevision+1 {
			return fmt.Errorf("projectstore: replace %q: %w", item.ID, project.ErrConflict)
		}
		if err := s.write(item); err != nil {
			return err
		}
		out = item.Clone()
		return nil
	})
	return out, err
}

// Delete atomically checks ownership and removes a Project document at its current revision.
func (s *Local) Delete(ctx context.Context, id string, expectedRevision int64, ownership project.Ownership) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return s.withLock(ctx, func() error {
		current, err := s.read(id)
		if err != nil {
			return err
		}
		if !ownership.Allows(current.Owner) {
			return fmt.Errorf("projectstore: delete %q: %w", id, project.ErrNotFound)
		}
		if current.Revision != expectedRevision {
			return fmt.Errorf("projectstore: delete %q: %w", id, project.ErrConflict)
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := os.Remove(s.path(id)); err != nil {
			return fmt.Errorf("projectstore: delete %q: %w", id, err)
		}
		return nil
	})
}

// Page reads an owner-filtered keyset page from the local store.
func (s *Local) Page(ctx context.Context, request project.PageRequest) (project.Page, error) {
	if err := ctx.Err(); err != nil {
		return project.Page{}, err
	}
	var out project.Page
	err := s.withLock(ctx, func() error {
		entries, err := os.ReadDir(s.dir)
		if err != nil {
			return fmt.Errorf("projectstore: list: %w", err)
		}
		rows := make([]project.Project, 0, len(entries))
		for _, entry := range entries {
			if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
				continue
			}
			if err := ctx.Err(); err != nil {
				return err
			}
			data, err := os.ReadFile(filepath.Join(s.dir, entry.Name()))
			if err != nil {
				return fmt.Errorf("projectstore: read page record: %w", err)
			}
			var item project.Project
			if err := json.Unmarshal(data, &item); err != nil {
				return fmt.Errorf("projectstore: decode page record: %w", err)
			}
			if err := item.Validate(); err != nil {
				return fmt.Errorf("projectstore: invalid page record: %w", err)
			}
			rows = append(rows, item)
		}
		out = project.Paginate(rows, request)
		return nil
	})
	return out, err
}

func (s *Local) withLock(ctx context.Context, fn func() error) error {
	locked := flock.New(s.lockPath)
	ok, err := locked.TryLockContext(ctx, localLockRetry)
	if err != nil {
		return fmt.Errorf("projectstore: lock: %w", err)
	}
	if !ok {
		return fmt.Errorf("projectstore: lock unavailable")
	}
	defer func() { _ = locked.Close() }()
	return fn()
}

func (s *Local) read(id string) (project.Project, error) {
	data, err := os.ReadFile(s.path(id))
	if os.IsNotExist(err) {
		return project.Project{}, fmt.Errorf("projectstore: load %q: %w", id, project.ErrNotFound)
	}
	if err != nil {
		return project.Project{}, fmt.Errorf("projectstore: read %q: %w", id, err)
	}
	var item project.Project
	if err := json.Unmarshal(data, &item); err != nil {
		return project.Project{}, fmt.Errorf("projectstore: decode %q: %w", id, err)
	}
	if item.ID != id {
		return project.Project{}, fmt.Errorf("projectstore: record identity mismatch for %q", id)
	}
	if err := item.Validate(); err != nil {
		return project.Project{}, fmt.Errorf("projectstore: invalid record %q: %w", id, err)
	}
	return item.Clone(), nil
}

func (s *Local) write(item project.Project) error {
	data, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("projectstore: encode %q: %w", item.ID, err)
	}
	tmp, err := os.CreateTemp(s.dir, ".project-*.tmp")
	if err != nil {
		return fmt.Errorf("projectstore: create temporary record: %w", err)
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("projectstore: set temporary mode: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("projectstore: write temporary record: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("projectstore: sync temporary record: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("projectstore: close temporary record: %w", err)
	}
	if err := os.Rename(tmpName, s.path(item.ID)); err != nil {
		return fmt.Errorf("projectstore: replace record %q: %w", item.ID, err)
	}
	return nil
}

func (s *Local) path(id string) string {
	sum := sha256.Sum256([]byte(id))
	return filepath.Join(s.dir, hex.EncodeToString(sum[:])+".json")
}
