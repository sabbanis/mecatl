package session

import (
	"fmt"
	"time"
)

// WorkspaceEnrollmentStatus is the client-owned pre-prompt enrollment state.
type WorkspaceEnrollmentStatus string

// Workspace enrollment states.
const (
	WorkspaceEnrollmentPending   WorkspaceEnrollmentStatus = "pending"
	WorkspaceEnrollmentConnected WorkspaceEnrollmentStatus = "connected"
	WorkspaceEnrollmentDenied    WorkspaceEnrollmentStatus = "denied"
	WorkspaceEnrollmentCancelled WorkspaceEnrollmentStatus = "cancelled"
	WorkspaceEnrollmentExpired   WorkspaceEnrollmentStatus = "expired"
	WorkspaceEnrollmentFailed    WorkspaceEnrollmentStatus = "failed"
)

// WorkspaceEnrollmentState contains only safe bundle correlation. OAuth URLs,
// credentials, grants, and discovered tools remain process-local adapter state.
type WorkspaceEnrollmentState struct {
	ID        string
	Backends  []string
	Status    WorkspaceEnrollmentStatus
	ExpiresAt time.Time
}

// StartWorkspaceEnrollment records one client-owned bundle without changing the
// agent-loop lifecycle state.
func (s *Session) StartWorkspaceEnrollment(enrollment WorkspaceEnrollmentState) error {
	if s.State != StateIdle || s.Conversation == nil || len(s.Conversation.Messages) != 0 {
		return fmt.Errorf("%w: workspace enrollment must precede the first prompt", ErrIllegalTransition)
	}
	if enrollment.ID == "" || len(enrollment.Backends) == 0 || enrollment.Status != WorkspaceEnrollmentPending || enrollment.ExpiresAt.IsZero() {
		return fmt.Errorf("%w: invalid workspace enrollment", ErrIllegalTransition)
	}
	seen := make(map[string]struct{}, len(enrollment.Backends))
	for _, backend := range enrollment.Backends {
		if backend == "" {
			return fmt.Errorf("%w: invalid workspace enrollment backend", ErrIllegalTransition)
		}
		if _, ok := seen[backend]; ok {
			return fmt.Errorf("%w: duplicate workspace enrollment backend", ErrIllegalTransition)
		}
		seen[backend] = struct{}{}
	}
	cloned := enrollment.Clone()
	s.workspaceEnrollment = &cloned
	return nil
}

// WorkspaceEnrollment returns an independent copy of the safe bundle state.
func (s *Session) WorkspaceEnrollment() (WorkspaceEnrollmentState, bool) {
	if s.workspaceEnrollment == nil {
		return WorkspaceEnrollmentState{}, false
	}
	return s.workspaceEnrollment.Clone(), true
}

// ClearWorkspaceEnrollment forgets process-local enrollment correlation.
func (s *Session) ClearWorkspaceEnrollment() { s.workspaceEnrollment = nil }

// Clone returns an independent enrollment value.
func (e WorkspaceEnrollmentState) Clone() WorkspaceEnrollmentState {
	e.Backends = append([]string(nil), e.Backends...)
	return e
}
