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
	AuthorizationID string
	RouteID         string
	CallID          session.ToolCallID
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
	ctx = memory.WithWorkspace(ctx, sess.Workspace)
	run := engine.ResumeMCPAuthorization(ctx, sess, env)
	s.register(id, run, sess)
	return run, nil
}

// CancelMCPAuthorization resolves one exact pending authorization with paired
// errors. It deliberately does not call Runtime.Disconnect.
func (s *Service) CancelMCPAuthorization(ctx context.Context, id session.SessionID, control MCPAuthorizationControl) error {
	unlock := s.runEntryMu.lock(id)
	defer unlock()
	sess, err := s.GetSession(ctx, id)
	if err != nil {
		return ErrNotFound
	}
	pending, ok := matchingMCPAuthorization(sess, control)
	if !ok || s.cfg.VMCPBroker == nil {
		return ErrNotFound
	}
	if err := s.acquireLease(ctx, id); err != nil {
		return err
	}
	if err := s.cfg.VMCPBroker.CancelAuthorization(ctx, id, pending.RouteID, pending.AuthorizationID); err != nil {
		return ErrNotFound
	}
	results, err := sess.AbortMCPAuthorization("MCP authorization cancelled")
	if err != nil {
		return ErrNotFound
	}
	if err := sess.RecordToolResults(results); err != nil {
		return fmt.Errorf("%w: record cancelled authorization", ErrInternal)
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return fmt.Errorf("%w: persist cancelled authorization", ErrInternal)
	}
	return nil
}

func matchingMCPAuthorization(sess *session.Session, control MCPAuthorizationControl) (session.PendingMCPAuthorization, bool) {
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || pending.AuthorizationID != control.AuthorizationID || pending.RouteID != control.RouteID || pending.Call.ID != control.CallID {
		return session.PendingMCPAuthorization{}, false
	}
	return pending, true
}
