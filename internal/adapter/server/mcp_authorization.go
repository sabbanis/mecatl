package server

import (
	"context"
	"fmt"
	"strings"

	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/memory"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

// MCPAuthorizationControl is the safe correlation supplied by an attached
// client. It has no success assertion, browser code, or credential field.
type MCPAuthorizationControl struct {
	SessionID       session.SessionID
	AuthorizationID string
}

// MCPAuthorizationControlResult is the Service-authoritative status and optional
// continuation selected for an exact authorization control operation.
type MCPAuthorizationControlResult struct {
	Event session.Event
	Run   *agent.Run
}

// MCPAuthorizationPresentation returns a live browser URL only after loading
// and authorizing the owner session. Invalid/foreign/stale controls collapse to
// ErrNotFound before the Runtime is consulted.
func (s *Service) MCPAuthorizationPresentation(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (string, error) {
	// Authorize the caller before taking the control lock or consulting the
	// process-local Runtime; all later reads are reloaded under the lease.
	if _, err := s.GetSession(ctx, id); err != nil {
		return "", ErrNotFound
	}
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	if err := s.acquireLease(ctx, id); err != nil {
		return "", err
	}
	sess, err := s.cfg.Store.Load(ctx, id)
	if err != nil {
		return "", ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil || !pending.ExpiresAt.After(s.cfg.Now()) {
		return "", ErrNotFound
	}
	status, err := s.cfg.VMCPBroker.CheckAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
	if err != nil || status.Status != vmcpbroker.ConnectionPending {
		return "", ErrNotFound
	}
	return status.BrowserURL, nil
}

// ControlMCPAuthorization executes an exact recheck or cancellation while owning
// the session lock and lease. Its event is the authoritative outcome selected in
// that critical section; transports relay it verbatim.
func (s *Service) ControlMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl, cancel bool) (MCPAuthorizationControlResult, error) {
	// This first load authorizes the caller. The snapshot used for the decision is
	// always reloaded after the lock and lease are held.
	if _, err := s.GetSession(ctx, id); err != nil {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	if err := s.acquireLease(ctx, id); err != nil {
		return MCPAuthorizationControlResult{}, err
	}
	sess, err := s.cfg.Store.Load(ctx, id)
	if err != nil {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}

	resolved := func(status session.MCPAuthorizationStatus, reason string) (MCPAuthorizationControlResult, error) {
		run, err := s.resolveMCPAuthorization(ctx, sess, reason)
		if err != nil {
			return MCPAuthorizationControlResult{}, err
		}
		return mcpAuthorizationControlResult(pending, status, run), nil
	}
	if cancel {
		// A missing process-local transaction cannot undo the durable paired repair.
		_ = s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
		if !pending.ExpiresAt.After(s.cfg.Now()) {
			return resolved(session.MCPAuthorizationExpired, "MCP authorization expired")
		}
		return resolved(session.MCPAuthorizationCancelled, "MCP authorization cancelled")
	}
	if !pending.ExpiresAt.After(s.cfg.Now()) {
		_ = s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
		return resolved(session.MCPAuthorizationExpired, "MCP authorization expired")
	}
	status, err := s.cfg.VMCPBroker.CheckAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
	if err != nil || status.Status != vmcpbroker.ConnectionPending && status.Status != vmcpbroker.ConnectionConnected {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	if status.Status == vmcpbroker.ConnectionPending {
		return mcpAuthorizationControlResult(pending, session.MCPAuthorizationPending, nil), nil
	}
	engine, env, err := s.engineAndEnvironmentFor(ctx, sess)
	if err != nil {
		return MCPAuthorizationControlResult{}, fmt.Errorf("%w: continuation engine", ErrFailedPrecondition)
	}
	claimed, err := sess.ClaimMCPAuthorization()
	if err != nil {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return MCPAuthorizationControlResult{}, fmt.Errorf("%w: persist authorization claim", ErrInternal)
	}
	s.recordMCPAuthorizationEvent(ctx, id, session.Event{Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: claimed.AuthorizationID, Backend: claimed.Backend, Call: claimed.Call.ID, ExpiresAt: claimed.ExpiresAt, Status: session.MCPAuthorizationConnected}})
	s.stopMCPAuthorizationExpiry(id)
	prepared := engine.PrepareMCPAuthorizationContinuation(memory.WithWorkspace(ctx, sess.Workspace), sess, env, claimed)
	if !s.register(id, prepared.Run(), sess) {
		s.repairMCPAuthorizationRegistration(ctx, sess)
		return MCPAuthorizationControlResult{}, ErrNoActiveRun
	}
	return mcpAuthorizationControlResult(pending, session.MCPAuthorizationConnected, prepared.Start()), nil
}

func mcpAuthorizationControlResult(pending session.PendingMCPAuthorization, status session.MCPAuthorizationStatus, run *agent.Run) MCPAuthorizationControlResult {
	typ := session.EvMCPAuthorizationResolved
	if status == session.MCPAuthorizationPending {
		typ = session.EvMCPAuthorizationRequired
	}
	return MCPAuthorizationControlResult{Event: session.Event{Type: typ, MCPAuthorization: &session.MCPAuthorizationPayload{
		AuthorizationID: pending.AuthorizationID,
		Backend:         pending.Backend,
		Call:            pending.Call.ID,
		ExpiresAt:       pending.ExpiresAt,
		Status:          status,
	}}, Run: run}
}

func (s *Service) recordMCPAuthorizationEvent(ctx context.Context, id session.SessionID, ev session.Event) {
	s.appendEvent(context.WithoutCancel(ctx), id, ev)
	s.PublishSessionEvent(id, ev)
}

// RecheckMCPAuthorization observes the broker transaction. Pending is inert;
// only a connected observation claims and launches the stored continuation.
func (s *Service) RecheckMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	result, err := s.ControlMCPAuthorization(ctx, id, control, false)
	return result.Run, err
}

// CancelMCPAuthorization resolves one exact pending authorization with paired
// errors. It deliberately does not call Runtime.Disconnect.
func (s *Service) CancelMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	result, err := s.ControlMCPAuthorization(ctx, id, control, true)
	return result.Run, err
}

func (s *Service) resolveMCPAuthorization(ctx context.Context, sess *session.Session, reason string) (*agent.Run, error) {
	pending, ok := sess.PendingMCPAuthorization()
	if !ok {
		return nil, ErrNotFound
	}
	results, err := sess.AbortMCPAuthorization(reason)
	if err != nil {
		return nil, ErrNotFound
	}
	if err := sess.RecordToolResults(results); err != nil {
		return nil, fmt.Errorf("%w: record authorization resolution", ErrInternal)
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return nil, fmt.Errorf("%w: persist authorization resolution", ErrInternal)
	}
	s.recordMCPAuthorizationEvent(ctx, sess.ID, session.Event{Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: pending.AuthorizationID, Backend: pending.Backend, Call: pending.Call.ID, ExpiresAt: pending.ExpiresAt, Status: mcpAuthorizationResolutionStatus(reason)}})
	s.stopMCPAuthorizationExpiry(sess.ID)
	engine, env, err := s.engineAndEnvironmentFor(ctx, sess)
	if err != nil {
		return nil, fmt.Errorf("%w: continuation engine", ErrFailedPrecondition)
	}
	prepared := engine.PrepareAfterMCPAuthorization(memory.WithWorkspace(ctx, sess.Workspace), sess, env)
	if !s.register(sess.ID, prepared.Run(), sess) {
		s.repairMCPAuthorizationRegistration(ctx, sess)
		return nil, ErrNoActiveRun
	}
	return prepared.Start(), nil
}

func (s *Service) repairMCPAuthorizationRegistration(ctx context.Context, sess *session.Session) {
	// The connected claim is a no-retry boundary. If process shutdown wins before
	// the inert continuation can register, abandon pairs every unmatched call
	// rather than leaving a claimed protected action executable after restart.
	if err := sess.Abandon(); err != nil {
		return
	}
	_ = s.cfg.Store.Save(context.WithoutCancel(ctx), sess)
	s.stopMCPAuthorizationExpiry(sess.ID)
}

func mcpAuthorizationResolutionStatus(reason string) session.MCPAuthorizationStatus {
	switch {
	case strings.Contains(strings.ToLower(reason), "expired"):
		return session.MCPAuthorizationExpired
	case strings.Contains(strings.ToLower(reason), "interrupted"):
		return session.MCPAuthorizationInterrupted
	case strings.Contains(strings.ToLower(reason), "closed"):
		return session.MCPAuthorizationClosed
	case strings.Contains(strings.ToLower(reason), "failed"):
		return session.MCPAuthorizationFailed
	default:
		return session.MCPAuthorizationCancelled
	}
}

func matchingMCPAuthorization(sess *session.Session, control MCPAuthorizationControl) (session.PendingMCPAuthorization, bool) {
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || control.SessionID != sess.ID || pending.AuthorizationID != control.AuthorizationID {
		return session.PendingMCPAuthorization{}, false
	}
	return pending, true
}
