package mcpbrokergrpc

import (
	"context"
	"crypto/sha256"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	brokerv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/broker/v1"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/mcpbroker"
)

type lifecycleOperation uint8

const (
	lifecycleNone lifecycleOperation = iota
	lifecycleAbort
	lifecycleClose
)

type executeReceipt struct {
	digest   [sha256.Size]byte
	bytes    int
	started  bool
	done     chan struct{}
	response *brokerv1.ExecuteResponse
	err      error
}

type sessionOwner struct {
	principal session.Principal
	pending   int
	handles   int
	expiresAt time.Time
	retiring  bool
}

type serverAttachment struct {
	attachment      mcpbroker.Attachment
	principal       *session.Principal
	logicalID       session.SessionID
	binding         string
	tools           map[string]tool.Tool
	active          int
	expiresAt       time.Time
	changed         chan struct{}
	receipts        map[session.ToolCallID]*executeReceipt
	receiptBytes    int
	running         lifecycleOperation
	runningDone     chan struct{}
	terminal        lifecycleOperation
	terminalOutcome mcpbroker.CloseOutcome
}

func (s *Server) bindSession(ctx context.Context, id session.SessionID) (*session.Principal, bool, error) {
	if !mcpbroker.ValidLogicalSessionID(id) {
		return nil, false, invalid("session_id is invalid")
	}
	principal := session.PrincipalFromContext(ctx)
	if principal == nil {
		return nil, false, nil // Direct adapter calls are test-only; the network boundary always installs a principal.
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	owner := s.owners[id]
	if owner != nil && owner.retiring {
		return nil, false, reasonStatus(codes.Unavailable, "broker session is being retired", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_STATE_UNAVAILABLE, "")
	}
	if owner != nil && !principal.SameIdentity(&owner.principal) {
		return nil, false, status.Error(codes.PermissionDenied, "broker session is not available")
	}
	created := false
	if owner == nil {
		if len(s.owners) >= s.cfg.MaxOwners {
			return nil, false, reasonStatus(codes.ResourceExhausted, "broker session capacity reached", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_CAPACITY_REACHED, "")
		}
		owner = &sessionOwner{principal: *principal, expiresAt: time.Now().Add(s.cfg.OwnerRetention)}
		s.owners[id] = owner
		created = true
	}
	owner.pending++
	return principal.Clone(), created, nil
}

func (s *Server) authorizeSession(ctx context.Context, id session.SessionID) error {
	principal := session.PrincipalFromContext(ctx)
	if principal == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	owner := s.owners[id]
	if owner == nil || !principal.SameIdentity(&owner.principal) {
		return status.Error(codes.PermissionDenied, "broker session is not available")
	}
	return nil
}

func (s *Server) removeOwnerLocked(id session.SessionID) {
	delete(s.owners, id)
}

func (s *Server) finishSessionBind(id session.SessionID, attached, newlyCreated bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	owner := s.owners[id]
	if owner == nil {
		return
	}
	owner.pending--
	if attached {
		owner.handles++
	}
	if newlyCreated && !attached && owner.pending == 0 && owner.handles == 0 {
		s.removeOwnerLocked(id)
	}
	// Ownership is deliberately retained after the last handle closes. The
	// logical session's absolute retention, delete, or shutdown reclaims it.
}

func authorizeHandle(ctx context.Context, attachment *serverAttachment) error {
	if attachment == nil || attachment.principal == nil {
		return nil
	}
	principal := session.PrincipalFromContext(ctx)
	if principal == nil || !principal.SameIdentity(attachment.principal) {
		return status.Error(codes.PermissionDenied, "broker attachment is not available")
	}
	return nil
}

func (s *Server) checkIncarnation(got string, allowEmpty bool) error {
	s.mu.Lock()
	closed := s.closed
	s.mu.Unlock()
	if closed {
		return reasonStatus(codes.Unavailable, "broker state unavailable", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_STATE_UNAVAILABLE, "")
	}
	if got == "" && allowEmpty {
		return nil
	}
	if got == "" || got != s.incarnation {
		return reasonStatus(codes.FailedPrecondition, "broker incarnation mismatch", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_INCARNATION_LOST, "")
	}
	return nil
}

func signalAttachment(a *serverAttachment) {
	close(a.changed)
	a.changed = make(chan struct{})
}

func (s *Server) get(ctx context.Context, incarnation, handle string) (*serverAttachment, func(), error) {
	if err := s.checkIncarnation(incarnation, false); err != nil {
		return nil, nil, err
	}
	if handle == "" {
		return nil, nil, invalid("handle is required")
	}
	s.mu.Lock()
	a := s.handles[handle]
	if err := authorizeHandle(ctx, a); err != nil {
		s.mu.Unlock()
		return nil, nil, err
	}
	if a == nil || s.closed || !time.Now().Before(a.expiresAt) || a.running != lifecycleNone || a.terminal != lifecycleNone {
		s.mu.Unlock()
		return nil, nil, reasonStatus(codes.FailedPrecondition, "attachment handle unavailable", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_STATE_UNAVAILABLE, "")
	}
	a.active++
	signalAttachment(a)
	s.mu.Unlock()
	return a, func() {
		s.mu.Lock()
		a.active--
		s.releaseClosedReceiptsLocked(a)
		signalAttachment(a)
		s.mu.Unlock()
	}, nil
}

func (s *Server) beginLifecycle(ctx context.Context, incarnation, handle string, operation lifecycleOperation) (*serverAttachment, mcpbroker.CloseOutcome, bool, error) {
	if err := s.checkIncarnation(incarnation, false); err != nil {
		return nil, "", false, err
	}
	if handle == "" {
		return nil, "", false, invalid("handle is required")
	}
	for {
		s.mu.Lock()
		a := s.handles[handle]
		if err := authorizeHandle(ctx, a); err != nil {
			s.mu.Unlock()
			return nil, "", false, err
		}
		if a == nil || s.closed || !time.Now().Before(a.expiresAt) {
			s.mu.Unlock()
			return nil, "", false, reasonStatus(codes.FailedPrecondition, "attachment handle unavailable", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_STATE_UNAVAILABLE, "")
		}
		if a.terminal != lifecycleNone {
			if a.terminal != operation {
				s.mu.Unlock()
				return nil, "", false, reasonStatus(codes.FailedPrecondition, "attachment handle unavailable", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_STATE_UNAVAILABLE, "")
			}
			outcome := a.terminalOutcome
			s.mu.Unlock()
			return nil, outcome, true, nil
		}
		if a.running != lifecycleNone || a.active != 0 {
			done := a.changed
			s.mu.Unlock()
			select {
			case <-done:
				continue
			case <-ctx.Done():
				return nil, "", false, status.FromContextError(ctx.Err()).Err()
			}
		}
		if s.pendingControls >= s.cfg.MaxPendingControls {
			s.mu.Unlock()
			return nil, "", false, reasonStatus(codes.ResourceExhausted, "broker control capacity reached", brokerv1.BrokerErrorReason_BROKER_ERROR_REASON_CAPACITY_REACHED, "")
		}
		a.running = operation
		s.pendingControls++
		a.runningDone = make(chan struct{})
		a.active++
		signalAttachment(a)
		s.mu.Unlock()
		return a, "", false, nil
	}
}

func (s *Server) releaseOwnerHandleLocked(id session.SessionID) {
	owner := s.owners[id]
	if owner == nil || owner.handles == 0 {
		return
	}
	owner.handles--
}

func releaseReceiptsLocked(attachment *serverAttachment) {
	clear(attachment.receipts)
	attachment.receiptBytes = 0
}

func (s *Server) releaseClosedReceiptsLocked(attachment *serverAttachment) {
	if s.closed && attachment.active == 0 {
		releaseReceiptsLocked(attachment)
	}
}

func (s *Server) finishLifecycle(a *serverAttachment, operation lifecycleOperation, outcome mcpbroker.CloseOutcome, terminal bool) {
	s.mu.Lock()
	if terminal {
		s.releaseOwnerHandleLocked(a.logicalID)
	}
	a.active--
	s.releaseClosedReceiptsLocked(a)
	if terminal {
		a.terminal = operation
		a.terminalOutcome = outcome
	}
	if a.running != lifecycleNone {
		s.pendingControls--
	}
	a.running = lifecycleNone
	done := a.runningDone
	a.runningDone = nil
	close(done)
	signalAttachment(a)
	s.mu.Unlock()
}

func (s *Server) sweep() {
	defer close(s.done)
	ticker := time.NewTicker(s.cfg.SweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case now := <-ticker.C:
			s.mu.Lock()
			var expired []*serverAttachment
			type ownerRetirement struct {
				id    session.SessionID
				owner *sessionOwner
			}
			var retirements []ownerRetirement
			for handle, attachment := range s.handles {
				if attachment.active == 0 && !now.Before(attachment.expiresAt) {
					releaseReceiptsLocked(attachment)
					delete(s.handles, handle)
					if attachment.terminal == lifecycleNone {
						s.releaseOwnerHandleLocked(attachment.logicalID)
						expired = append(expired, attachment)
					}
				}
			}
			for id, owner := range s.owners {
				if owner.pending == 0 && owner.handles == 0 && !owner.retiring && !now.Before(owner.expiresAt) {
					owner.retiring = true
					retirements = append(retirements, ownerRetirement{id: id, owner: owner})
				}
			}
			s.mu.Unlock()
			for _, attachment := range expired {
				s.closeAttachment(attachment)
			}
			for _, retirement := range retirements {
				s.retireOwner(retirement.id, retirement.owner)
			}
		}
	}
}

func (s *Server) retireOwner(id session.SessionID, owner *sessionOwner) {
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.CleanupTimeout)
	_, err := s.service.DeleteSession(ctx, id)
	cancel()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.owners[id] != owner {
		return
	}
	if err == nil {
		s.removeOwnerLocked(id)
		return
	}
	owner.retiring = false
	owner.expiresAt = time.Now().Add(s.cfg.SweepInterval)
}

func (s *Server) closeAttachment(attachment *serverAttachment) {
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.CleanupTimeout)
	defer cancel()
	_, _ = attachment.attachment.Close(ctx)
}
