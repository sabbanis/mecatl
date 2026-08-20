// Package project defines the server-side Project document and the seams that
// persist it and resolve its working source. Project state stays above the agent
// loop: callers resolve an Environment before constructing an engine run.
package project

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

const (
	// MaxNameRunes is the inclusive display-name limit for Project names and
	// source labels.
	MaxNameRunes = 120
	maxIDRunes   = 256
)

var (
	// ErrNotFound means no Project exists for an opaque ID.
	ErrNotFound = errors.New("project: not found")
	// ErrAlreadyExists means Create encountered an existing Project ID.
	ErrAlreadyExists = errors.New("project: already exists")
	// ErrConflict means Replace or Delete received a stale revision.
	ErrConflict = errors.New("project: revision conflict")
	// ErrUnsupported is a permanent backend capability posture.
	ErrUnsupported = errors.New("project: unsupported")
	// ErrSourceNotFound means the registry has no registration for a SourceRef.
	ErrSourceNotFound = errors.New("project: source not found")
)

// SourceRef is an opaque, server-minted source identity. It carries no locator
// or authority; callers must resolve it through an authorized Project binding.
type SourceRef string

// WorkingSource is the Project-visible metadata for one registered working
// source. Its Label is registry-owned and never asserted by a client.
type WorkingSource struct {
	Ref   SourceRef `json:"source_ref"`
	Label string    `json:"label"`
}

// ValidateWorkingSource checks Project-visible working-source metadata.
func ValidateWorkingSource(source WorkingSource) error {
	if err := validateOpaque("working source ref", string(source.Ref)); err != nil {
		return err
	}
	return validateDisplay("working label", source.Label)
}

// Project is the complete server-owned durable Project document. References are
// deliberately absent from this working-source foundation; they arrive only with
// the bounded reference capability in a later release.
type Project struct {
	ID        string             `json:"id"`
	Owner     *session.Principal `json:"owner,omitempty"`
	Name      string             `json:"name"`
	Working   WorkingSource      `json:"working"`
	Revision  int64              `json:"revision"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

// Validate checks the backend-neutral Project value constraints. It validates no
// filesystem or deployment detail; source registration remains the registry's
// responsibility.
func (p Project) Validate() error {
	if err := validateOpaque("id", p.ID); err != nil {
		return err
	}
	if err := validateDisplay("name", p.Name); err != nil {
		return err
	}
	if err := ValidateWorkingSource(p.Working); err != nil {
		return err
	}
	if p.Revision < 1 {
		return fmt.Errorf("project: revision must be positive")
	}
	if p.CreatedAt.IsZero() || p.UpdatedAt.IsZero() {
		return fmt.Errorf("project: timestamps must be set")
	}
	if p.UpdatedAt.Before(p.CreatedAt) {
		return fmt.Errorf("project: updated_at precedes created_at")
	}
	if p.Owner != nil && (p.Owner.Issuer == "" || p.Owner.Subject == "") {
		return fmt.Errorf("project: owner identity must be set")
	}
	return nil
}

func validateOpaque(field, value string) error {
	if !utf8.ValidString(value) || value == "" || utf8.RuneCountInString(value) > maxIDRunes {
		return fmt.Errorf("project: invalid %s", field)
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return fmt.Errorf("project: invalid %s", field)
		}
	}
	return nil
}

func validateDisplay(field, value string) error {
	if value != strings.TrimSpace(value) || !utf8.ValidString(value) || value == "" || utf8.RuneCountInString(value) > MaxNameRunes {
		return fmt.Errorf("project: invalid %s", field)
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return fmt.Errorf("project: invalid %s", field)
		}
	}
	return nil
}

// Clone returns an isolated copy safe for callers to modify.
func (p Project) Clone() Project {
	p.Owner = p.Owner.Clone()
	return p
}

// Store persists complete Project documents. Create is create-only; Replace and
// Delete compare expectedRevision with the stored document atomically. Adapters
// apply owner filtering before a Page forms its result.
type Store interface {
	Create(context.Context, Project) error
	Load(context.Context, string) (Project, error)
	Replace(context.Context, Project, int64) (Project, error)
	Delete(context.Context, string, int64) error
	Page(context.Context, PageRequest) (Page, error)
}

// Cursor is the structured keyset position. Transports encode it opaquely.
type Cursor struct {
	UpdatedAt time.Time
	ID        string
}

// PageRequest selects an owner-filtered, descending-updated Project page.
type PageRequest struct {
	Limit             int
	Cursor            *Cursor
	OwnershipEnforced bool
	Owner             *session.Principal
}

// Page is a weakly-consistent bounded keyset result.
type Page struct {
	Projects   []Project
	NextCursor *Cursor
	TotalCount int
}

// SourceRegistry is an immutable process-lifetime registry of server-minted
// source identities. Resolution returns a complete Environment; the registry
// reveals neither a backend locator nor authority details.
type SourceRegistry interface {
	ListWorking(context.Context) ([]WorkingSource, error)
	ResolveWorking(context.Context, SourceRef) (tool.Environment, error)
}
