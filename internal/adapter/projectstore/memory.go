// Package projectstore provides reference in-memory and durable local Project
// store adapters for the server-side project.Store seam.
package projectstore

import (
	"context"
	"fmt"
	"sync"

	"github.com/stacklok/mecatl/internal/project"
)

// Memory is an in-memory, concurrency-safe Project store reference adapter.
type Memory struct {
	mu       sync.RWMutex
	projects map[string]project.Project
}

var _ project.Store = (*Memory)(nil)

// NewMemory constructs an empty in-memory Project store.
func NewMemory() *Memory {
	return &Memory{projects: make(map[string]project.Project)}
}

// Create atomically stores a new complete Project document.
func (s *Memory) Create(ctx context.Context, item project.Project) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := item.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.projects[item.ID]; exists {
		return fmt.Errorf("projectstore: create %q: %w", item.ID, project.ErrAlreadyExists)
	}
	s.projects[item.ID] = item.Clone()
	return nil
}

// Load returns an isolated Project copy.
func (s *Memory) Load(ctx context.Context, id string) (project.Project, error) {
	if err := ctx.Err(); err != nil {
		return project.Project{}, err
	}
	s.mu.RLock()
	item, exists := s.projects[id]
	s.mu.RUnlock()
	if !exists {
		return project.Project{}, fmt.Errorf("projectstore: load %q: %w", id, project.ErrNotFound)
	}
	return item.Clone(), nil
}

// Replace atomically checks a revision and replaces the complete document.
func (s *Memory) Replace(ctx context.Context, item project.Project, expectedRevision int64) (project.Project, error) {
	if err := ctx.Err(); err != nil {
		return project.Project{}, err
	}
	if err := item.Validate(); err != nil {
		return project.Project{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, exists := s.projects[item.ID]
	if !exists {
		return project.Project{}, fmt.Errorf("projectstore: replace %q: %w", item.ID, project.ErrNotFound)
	}
	if current.Revision != expectedRevision || item.Revision != expectedRevision+1 {
		return project.Project{}, fmt.Errorf("projectstore: replace %q: %w", item.ID, project.ErrConflict)
	}
	s.projects[item.ID] = item.Clone()
	return item.Clone(), nil
}

// Delete atomically removes a Project only at its current revision.
func (s *Memory) Delete(ctx context.Context, id string, expectedRevision int64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, exists := s.projects[id]
	if !exists {
		return fmt.Errorf("projectstore: delete %q: %w", id, project.ErrNotFound)
	}
	if current.Revision != expectedRevision {
		return fmt.Errorf("projectstore: delete %q: %w", id, project.ErrConflict)
	}
	delete(s.projects, id)
	return nil
}

// Page returns an owner-filtered keyset page from an isolated map snapshot.
func (s *Memory) Page(ctx context.Context, request project.PageRequest) (project.Page, error) {
	if err := ctx.Err(); err != nil {
		return project.Page{}, err
	}
	s.mu.RLock()
	rows := make([]project.Project, 0, len(s.projects))
	for _, item := range s.projects {
		rows = append(rows, item.Clone())
	}
	s.mu.RUnlock()
	return project.Paginate(rows, request), nil
}
