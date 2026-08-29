package server

import (
	"context"
	"fmt"
	"strings"
	"time"

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

// ControlMCPAuthorization executes an exact recheck or cancellation and returns
// the status selected by the Service, rather than requiring a wire adapter to
// infer it from a nil/non-nil continuation.
func (s *Service) ControlMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl, cancel bool) (MCPAuthorizationControlResult, error) {
	sess, err := s.GetSession(ctx, id)
	if err != nil {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok {
		return MCPAuthorizationControlResult{}, ErrNotFound
	}
	payload := &session.MCPAuthorizationPayload{AuthorizationID: pending.AuthorizationID, Backend: pending.Backend, Call: pending.Call.ID, ExpiresAt: pending.ExpiresAt}
	var run *agent.Run
	if cancel {
		run, err = s.CancelMCPAuthorization(ctx, id, control)
		payload.Status = mcpAuthorizationResolutionStatusForCancel(pending, s.cfg.Now())
	} else {
		run, err = s.RecheckMCPAuthorization(ctx, id, control)
		if run == nil && err == nil {
			payload.Status = session.MCPAuthorizationPending
		} else {
			payload.Status = session.MCPAuthorizationConnected
		}
	}
	if err != nil {
		return MCPAuthorizationControlResult{}, err
	}
	typ := session.EvMCPAuthorizationResolved
	if payload.Status == session.MCPAuthorizationPending {
		typ = session.EvMCPAuthorizationRequired
	}
	return MCPAuthorizationControlResult{Event: session.Event{Type: typ, MCPAuthorization: payload}, Run: run}, nil
}

func (s *Service) recordMCPAuthorizationEvent(ctx context.Context, id session.SessionID, ev session.Event) {
	s.appendEvent(context.WithoutCancel(ctx), id, ev)
	s.PublishSessionEvent(id, ev)
}

func mcpAuthorizationResolutionStatusForCancel(pending session.PendingMCPAuthorization, now time.Time) session.MCPAuthorizationStatus {
	if !pending.ExpiresAt.After(now) {
		return session.MCPAuthorizationExpired
	}
	return session.MCPAuthorizationCancelled
}

// RecheckMCPAuthorization observes the broker transaction. Pending is inert;
// only a connected observation claims and launches the stored continuation.
func (s *Service) RecheckMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	// The first load is owner authorization only. The control decision uses the
	// fresh snapshot obtained after both the in-process lock and cross-process lease.
	if _, err := s.GetSession(ctx, id); err != nil {
		return nil, ErrNotFound
	}
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	if err := s.acquireLease(ctx, id); err != nil {
		return nil, err
	}
	sess, err := s.cfg.Store.Load(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return nil, ErrNotFound
	}
	if !pending.ExpiresAt.After(s.cfg.Now()) {
		_ = s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
		return s.resolveMCPAuthorization(ctx, sess, "MCP authorization expired")
	}
	status, err := s.cfg.VMCPBroker.CheckAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
	if err != nil {
		return nil, ErrNotFound
	}
	if status.Status == vmcpbroker.ConnectionPending {
		return nil, nil
	}
	if status.Status != vmcpbroker.ConnectionConnected {
		return nil, ErrNotFound
	}
	engine, env, err := s.engineAndEnvironmentFor(ctx, sess)
	if err != nil {
		return nil, fmt.Errorf("%w: continuation engine", ErrFailedPrecondition)
	}
	claimed, err := sess.ClaimMCPAuthorization()
	if err != nil {
		return nil, ErrNotFound
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return nil, fmt.Errorf("%w: persist authorization claim", ErrInternal)
	}
	s.recordMCPAuthorizationEvent(ctx, id, session.Event{Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: claimed.AuthorizationID, Backend: claimed.Backend, Call: claimed.Call.ID, ExpiresAt: claimed.ExpiresAt, Status: session.MCPAuthorizationConnected}})
	s.stopMCPAuthorizationExpiry(id)
	ctx = memory.WithWorkspace(ctx, sess.Workspace)
	prepared := engine.PrepareMCPAuthorizationContinuation(ctx, sess, env, claimed)
	if !s.register(id, prepared.Run(), sess) {
		s.repairMCPAuthorizationRegistration(ctx, sess)
		return nil, ErrNoActiveRun
	}
	return prepared.Start(), nil
}

// CancelMCPAuthorization resolves one exact pending authorization with paired
// errors. It deliberately does not call Runtime.Disconnect.
func (s *Service) CancelMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	if _, err := s.GetSession(ctx, id); err != nil {
		return nil, ErrNotFound
	}
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	if err := s.acquireLease(ctx, id); err != nil {
		return nil, err
	}
	sess, err := s.cfg.Store.Load(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return nil, ErrNotFound
	}
	// The Runtime's transaction may already be absent after a process-local
	// failure. The durable aggregate remains authoritative for the paired repair.
	_ = s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
	if !pending.ExpiresAt.After(s.cfg.Now()) {
		return s.resolveMCPAuthorization(ctx, sess, "MCP authorization expired")
	}
	return s.resolveMCPAuthorization(ctx, sess, "MCP authorization cancelled")
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
