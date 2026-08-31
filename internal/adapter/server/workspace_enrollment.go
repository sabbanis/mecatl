package server

import (
	"context"
	"fmt"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

// ConnectWorkspaceServices starts the one client-owned pre-prompt enrollment
// bundle. Ownership is checked before process-local broker state is consulted.
func (s *Service) ConnectWorkspaceServices(ctx context.Context, id session.SessionID) (vmcpbroker.WorkspaceEnrollmentPresentation, error) {
	if _, err := s.GetSession(ctx, id); err != nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, ErrNotFound
	}
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	sess, err := s.cfg.Store.Load(ctx, id)
	if err != nil || sess == nil || sess.ID != id || s.authorizeSession(ctx, sess) != nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, ErrNotFound
	}
	if s.cfg.VMCPBroker == nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: workspace services are not configured", ErrFailedPrecondition)
	}
	presentation, err := s.cfg.VMCPBroker.ConnectWorkspaceServices(ctx, id)
	if err != nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, err
	}
	if presentation.Status == vmcpbroker.ConnectionPending {
		state := session.WorkspaceEnrollmentState{
			ID: presentation.ID, Backends: presentation.Backends,
			Status: session.WorkspaceEnrollmentPending, ExpiresAt: presentation.ExpiresAt,
		}
		if err := sess.StartWorkspaceEnrollment(state); err != nil {
			_ = s.cfg.VMCPBroker.AbortWorkspaceEnrollment(id, presentation.ID, vmcpbroker.WorkspaceEnrollmentFailed)
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: record workspace enrollment", ErrInternal)
		}
		if err := s.cfg.Store.Save(ctx, sess); err != nil {
			_ = s.cfg.VMCPBroker.AbortWorkspaceEnrollment(id, presentation.ID, vmcpbroker.WorkspaceEnrollmentFailed)
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: persist workspace enrollment", ErrInternal)
		}
	}
	return presentation, nil
}
