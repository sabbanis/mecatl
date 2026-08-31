package server

import (
	"context"
	"fmt"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

// ConnectWorkspaceServices starts or observes the one client-owned pre-prompt
// enrollment bundle. Ownership is checked before process-local broker state is
// consulted; an existing live pending bundle is observed rather than duplicated.
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
	principal := session.PrincipalFromContext(ctx)
	if sess.Owner == nil || !sess.Owner.SameIdentity(principal) {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, ErrNotFound
	}
	if s.cfg.VMCPBroker == nil || !s.cfg.VMCPBroker.WorkspaceEnrollmentRequired() {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: workspace services are not configured", ErrFailedPrecondition)
	}
	if sess.State != session.StateIdle || sess.Conversation == nil || len(sess.Conversation.Messages) != 0 {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: workspace enrollment must precede the first prompt", ErrFailedPrecondition)
	}
	if _, active := s.LookupRun(id); active {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: session has an active run", ErrFailedPrecondition)
	}
	if _, pending := sess.PendingAsk(); pending {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: session has a pending permission approval", ErrFailedPrecondition)
	}
	if _, pending := sess.PendingMCPAuthorization(); pending {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: session has a pending tool authorization", ErrFailedPrecondition)
	}
	if s.cfg.VMCPBroker.ProtectedCatalogueReady(id) {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: protected catalogue is already admitted", ErrFailedPrecondition)
	}
	if err := s.ensureWorkspaceBrokerSession(ctx, id, sess); err != nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, err
	}

	if enrollment, pending := sess.WorkspaceEnrollment(); pending && !s.cfg.VMCPBroker.WorkspaceEnrollmentLive(id, enrollment.ID) {
		// A persisted correlation without its process-local transaction is restart or
		// process-loss evidence. Forget it before starting a fresh complete bundle.
		sess.ClearWorkspaceEnrollment()
		if err := s.cfg.Store.Save(ctx, sess); err != nil {
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: clear stale workspace enrollment", ErrInternal)
		}
	}

	presentation, err := s.cfg.VMCPBroker.ConnectWorkspaceServices(ctx, id)
	if err != nil {
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, err
	}
	switch presentation.Status {
	case vmcpbroker.ConnectionPending:
		if existing, ok := sess.WorkspaceEnrollment(); ok {
			if existing.ID != presentation.ID {
				_ = s.cfg.VMCPBroker.AbortWorkspaceEnrollment(id, presentation.ID, vmcpbroker.WorkspaceEnrollmentFailed)
				return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: conflicting workspace enrollment", ErrFailedPrecondition)
			}
			return presentation, nil
		}
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
	case vmcpbroker.ConnectionConnected:
		if _, ok := sess.WorkspaceEnrollment(); !ok {
			s.cfg.VMCPBroker.RejectProtectedCatalogue(id)
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: connected bundle has no pending enrollment", ErrFailedPrecondition)
		}
		// Persist no catalogue or grant. Clearing the safe correlation before the
		// factory rebuild means a crash at any later instruction requires reenrollment.
		sess.ClearWorkspaceEnrollment()
		if err := s.cfg.Store.Save(ctx, sess); err != nil {
			s.cfg.VMCPBroker.RejectProtectedCatalogue(id)
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: persist workspace enrollment completion", ErrInternal)
		}
		if err := s.installWorkspaceCatalogue(ctx, sess); err != nil {
			s.cfg.VMCPBroker.RejectProtectedCatalogue(id)
			return vmcpbroker.WorkspaceEnrollmentPresentation{}, err
		}
	default:
		s.cfg.VMCPBroker.RejectProtectedCatalogue(id)
		return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: invalid workspace enrollment status", ErrInternal)
	}
	return presentation, nil
}

func (s *Service) ensureWorkspaceBrokerSession(ctx context.Context, id session.SessionID, sess *session.Session) error {
	generation, bound := s.cfg.VMCPBrokerBindings.Generation(id)
	if bound && generation != s.cfg.VMCPBrokerGeneration {
		return fmt.Errorf("%w: broker configuration changed", ErrFailedPrecondition)
	}
	s.mu.Lock()
	entry := s.brokerSessions[id]
	s.mu.Unlock()
	if entry != nil {
		return nil
	}
	_, entry, release, err := s.openBrokerSession(id, true)
	if err != nil {
		return err
	}
	if release != nil {
		defer func() { _ = release() }()
	}
	s.mu.Lock()
	committed := s.commitBrokerSessionLocked(id, entry)
	s.mu.Unlock()
	if !committed {
		return fmt.Errorf("%w: broker session closed during enrollment", ErrFailedPrecondition)
	}
	sess.BrokerEnrollmentID = s.brokerEnrollmentID()
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return fmt.Errorf("%w: persist broker reenrollment binding", ErrInternal)
	}
	return nil
}

func (s *Service) installWorkspaceCatalogue(ctx context.Context, sess *session.Session) error {
	if !s.cfg.VMCPBroker.ProtectedCatalogueReady(sess.ID) {
		return fmt.Errorf("%w: protected catalogue is not ready", ErrFailedPrecondition)
	}
	s.mu.Lock()
	entry := s.brokerSessions[sess.ID]
	_, replace := s.sessionEngines[sess.ID]
	s.mu.Unlock()
	if entry == nil || entry.opened == nil {
		return fmt.Errorf("%w: broker session is unavailable", ErrFailedPrecondition)
	}
	brokerTools := entry.opened.Tools()
	if len(brokerTools) == 0 || s.brokerToolsCollideWithSharedCatalog(brokerTools) {
		return fmt.Errorf("%w: protected catalogue collides with shared catalog", ErrFailedPrecondition)
	}
	sel := ProviderSelector{ProviderID: sess.ProviderID, ModelID: sess.ModelID, ReasoningEffort: sess.ReasoningEffort}
	_, err := s.buildAndRegisterSessionEngine(ctx, sess, sel, nil, profileForSession(sess), sess.Mode, replace)
	return err
}
