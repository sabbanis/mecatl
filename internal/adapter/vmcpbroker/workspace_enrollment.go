package vmcpbroker

import (
	"context"
	"time"

	"github.com/stacklok/mecatl/engine/session"
)

// WorkspaceEnrollmentOutcome is a terminal all-or-nothing bundle outcome.
type WorkspaceEnrollmentOutcome string

// Terminal workspace-enrollment outcomes.
const (
	WorkspaceEnrollmentDenied    WorkspaceEnrollmentOutcome = "denied"
	WorkspaceEnrollmentCancelled WorkspaceEnrollmentOutcome = "cancelled"
	WorkspaceEnrollmentExpired   WorkspaceEnrollmentOutcome = "expired"
	WorkspaceEnrollmentFailed    WorkspaceEnrollmentOutcome = "failed"
)

// WorkspaceEnrollmentPresentation is safe client-facing bundle correlation.
type WorkspaceEnrollmentPresentation struct {
	ID         string
	Backends   []string
	Status     ConnectionStatus
	BrowserURL string
	ExpiresAt  time.Time
}

// WorkspaceEnrollmentBackends returns the deterministic configured consent order.
func (r *Runtime) WorkspaceEnrollmentBackends() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return append([]string(nil), r.protectedBackends...)
}

// ConnectWorkspaceServices starts or observes the one bundle-wide ToolHive
// consent chain. There is deliberately no backend selector.
func (r *Runtime) ConnectWorkspaceServices(ctx context.Context, id session.SessionID) (WorkspaceEnrollmentPresentation, error) {
	r.mu.RLock()
	backends := append([]string(nil), r.protectedBackends...)
	r.mu.RUnlock()
	if len(backends) == 0 {
		return WorkspaceEnrollmentPresentation{}, ErrInvalidControlTarget
	}
	result, err := r.Connect(ctx, id, backends[0])
	if err != nil {
		return WorkspaceEnrollmentPresentation{}, err
	}
	if result.Status == ConnectionConnected && !r.ProtectedCatalogueReady(id) {
		r.mu.Lock()
		for _, backend := range backends {
			delete(r.grants, controlTarget{sessionID: id, backendID: backend})
		}
		r.mu.Unlock()
		return WorkspaceEnrollmentPresentation{}, ErrInvalidControlTarget
	}
	presentation := WorkspaceEnrollmentPresentation{Backends: backends, Status: result.Status}
	if result.AuthorizationRequired != nil {
		presentation.ID = result.AuthorizationRequired.Handle
		presentation.BrowserURL = result.AuthorizationRequired.BrowserURL
		presentation.ExpiresAt = result.AuthorizationRequired.ExpiresAt
		r.mu.Lock()
		target := controlTarget{sessionID: id, backendID: backends[0]}
		transaction := r.transactions[target]
		transaction.backends = append([]string(nil), backends...)
		r.transactions[target] = transaction
		r.mu.Unlock()
	}
	return presentation, nil
}

// AbortWorkspaceEnrollment invalidates the complete bundle. No terminal outcome
// leaves a backend grant behind.
func (r *Runtime) AbortWorkspaceEnrollment(id session.SessionID, enrollmentID string, outcome WorkspaceEnrollmentOutcome) error {
	switch outcome {
	case WorkspaceEnrollmentDenied, WorkspaceEnrollmentCancelled, WorkspaceEnrollmentExpired, WorkspaceEnrollmentFailed:
	default:
		return ErrInvalidControlTarget
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || !r.openSessionLocked(id) || len(r.protectedBackends) == 0 {
		return ErrInvalidControlTarget
	}
	primary := controlTarget{sessionID: id, backendID: r.protectedBackends[0]}
	transaction, ok := r.transactions[primary]
	if !ok || transaction.handle != enrollmentID {
		return ErrInvalidControlTarget
	}
	if transaction.cancel != nil {
		transaction.cancel()
	}
	for _, backend := range r.protectedBackends {
		target := controlTarget{sessionID: id, backendID: backend}
		delete(r.transactions, target)
		delete(r.authorizations, target)
		delete(r.grants, target)
	}
	return nil
}

func (r *Runtime) failWorkspaceEnrollment(target controlTarget, transaction authorizationTransaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	pending, ok := r.transactions[target]
	if !ok || pending.handle != transaction.handle {
		return
	}
	for _, backend := range transaction.backends {
		candidate := controlTarget{sessionID: target.sessionID, backendID: backend}
		delete(r.transactions, candidate)
		delete(r.authorizations, candidate)
		delete(r.grants, candidate)
	}
}

// ProtectedCatalogueReady reports whether every configured backend has one grant.
// It never treats a partial set as ready.
func (r *Runtime) ProtectedCatalogueReady(id session.SessionID) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.closed || !r.openSessionLocked(id) || len(r.protectedBackends) == 0 {
		return false
	}
	for _, backend := range r.protectedBackends {
		if _, ok := r.grants[controlTarget{sessionID: id, backendID: backend}]; !ok {
			return false
		}
	}
	return true
}
