package server

import (
	"context"
	"fmt"

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

// MCPAuthorizationPresentation returns a live browser URL only after loading
// and authorizing the owner session. Invalid/foreign/stale controls collapse to
// ErrNotFound before the Runtime is consulted.
func (s *Service) MCPAuthorizationPresentation(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (string, error) {
	sess, err := s.GetSession(ctx, id)
	if err != nil {
		return "", ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return "", ErrNotFound
	}
	if !pending.ExpiresAt.After(s.cfg.Now()) {
		return "", ErrNotFound
	}
	status, err := s.cfg.VMCPBroker.CheckAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID)
	if err != nil || status.Status != vmcpbroker.ConnectionPending {
		return "", ErrNotFound
	}
	return status.BrowserURL, nil
}

// RecheckMCPAuthorization observes the broker transaction. Pending is inert;
// only a connected observation claims and launches the stored continuation.
func (s *Service) RecheckMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	sess, err := s.GetSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return nil, ErrNotFound
	}
	if err := s.acquireLease(ctx, id); err != nil {
		return nil, err
	}
	if !pending.ExpiresAt.After(s.cfg.Now()) {
		if err := s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID); err != nil {
			return nil, ErrNotFound
		}
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
	ctx = memory.WithWorkspace(ctx, sess.Workspace)
	run := engine.ContinueMCPAuthorization(ctx, sess, env, claimed)
	s.register(id, run, sess)
	return run, nil
}

// CancelMCPAuthorization resolves one exact pending authorization with paired
// errors. It deliberately does not call Runtime.Disconnect.
func (s *Service) CancelMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) (*agent.Run, error) {
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	sess, err := s.GetSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return nil, ErrNotFound
	}
	if err := s.acquireLease(ctx, id); err != nil {
		return nil, err
	}
	if err := s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID); err != nil {
		return nil, ErrNotFound
	}
	return s.resolveMCPAuthorization(ctx, sess, "MCP authorization cancelled")
}

func (s *Service) resolveMCPAuthorization(ctx context.Context, sess *session.Session, reason string) (*agent.Run, error) {
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
	engine, env, err := s.engineAndEnvironmentFor(ctx, sess)
	if err != nil {
		return nil, fmt.Errorf("%w: continuation engine", ErrFailedPrecondition)
	}
	run := engine.ContinueAfterMCPAuthorization(memory.WithWorkspace(ctx, sess.Workspace), sess, env)
	s.register(sess.ID, run, sess)
	return run, nil
}

func matchingMCPAuthorization(sess *session.Session, control MCPAuthorizationControl) (session.PendingMCPAuthorization, bool) {
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || control.SessionID != sess.ID || pending.AuthorizationID != control.AuthorizationID {
		return session.PendingMCPAuthorization{}, false
	}
	return pending, true
}
