package vmcpbroker

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
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
	if result.Status == ConnectionConnected {
		if err := r.freezeProtectedCatalogue(ctx, id); err != nil {
			r.invalidateProtectedAdmission(id)
			return WorkspaceEnrollmentPresentation{}, err
		}
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

func (r *Runtime) freezeProtectedCatalogue(ctx context.Context, id session.SessionID) error {
	r.mu.RLock()
	opened := r.sessions[id]
	backends := append([]string(nil), r.protectedBackends...)
	static := append([]Route(nil), r.protectedStatic...)
	query := r.authenticatedQuery
	closed := r.closed
	r.mu.RUnlock()
	if closed || opened == nil || query == nil || len(backends) == 0 {
		return ErrInvalidControlTarget
	}
	opened.mu.RLock()
	frozen := opened.protectedFrozen
	opened.mu.RUnlock()
	if frozen {
		return nil
	}

	r.mu.RLock()
	grants := make(map[string]downstreamGrant, len(backends))
	for _, backend := range backends {
		grant, ok := r.grants[controlTarget{sessionID: id, backendID: backend}]
		if !ok || grant.authSession == "" {
			r.mu.RUnlock()
			return ErrInvalidControlTarget
		}
		grants[backend] = grant
	}
	r.mu.RUnlock()

	discovered := make(map[string][]Route, len(backends))
	candidateNames := make(map[string]struct{})
	for _, backend := range backends {
		capabilities, err := query(ctx, grants[backend].authSession, backend)
		if err != nil || capabilities.BackendID != backend {
			return ErrAuthenticatedDiscovery
		}
		for _, definition := range capabilities.Tools {
			route, err := routeFromAuthenticatedDefinition(backend, definition)
			if err != nil {
				return err
			}
			if _, duplicate := candidateNames[route.Tool.Name]; duplicate {
				return fmt.Errorf("%w: duplicate protected tool", ErrInvalidRoute)
			}
			candidateNames[route.Tool.Name] = struct{}{}
			discovered[backend] = append(discovered[backend], route)
		}
	}

	staticByBackend := make(map[string][]Route)
	for _, route := range static {
		if err := validateProtectedRoute(route); err != nil {
			return err
		}
		staticByBackend[route.BackendID] = append(staticByBackend[route.BackendID], copyRoute(route))
	}
	staged := make([]Route, 0)
	seen := make(map[string]struct{})
	r.mu.RLock()
	for _, route := range r.routes {
		seen[route.Tool.Name] = struct{}{}
	}
	r.mu.RUnlock()
	for _, backend := range backends {
		selected := discovered[backend]
		if reviewed := staticByBackend[backend]; len(reviewed) > 0 {
			selected = reviewed
		}
		for _, route := range selected {
			if _, collision := seen[route.Tool.Name]; collision {
				return fmt.Errorf("%w: protected tool collision", ErrInvalidRoute)
			}
			seen[route.Tool.Name] = struct{}{}
			staged = append(staged, route)
		}
	}
	sort.Slice(staged, func(i, j int) bool { return staged[i].Tool.Name < staged[j].Tool.Name })
	tools := make([]tool.Tool, len(staged))
	for i, route := range staged {
		base := &sessionTool{sessionID: id, route: route, caller: opened.caller, owner: opened}
		tools[i] = &protectedSessionTool{sessionTool: base}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed || r.sessions[id] != opened || !r.openSessionLocked(id) {
		return ErrInvalidControlTarget
	}
	for _, backend := range backends {
		if current, ok := r.grants[controlTarget{sessionID: id, backendID: backend}]; !ok || current != grants[backend] {
			return ErrInvalidControlTarget
		}
	}
	opened.mu.Lock()
	defer opened.mu.Unlock()
	if opened.closed {
		return ErrClosed
	}
	if opened.protectedFrozen {
		return nil
	}
	opened.tools = append(opened.tools, tools...)
	opened.protectedFrozen = true
	return nil
}

func routeFromAuthenticatedDefinition(backend string, definition ToolDefinition) (Route, error) {
	route := Route{BackendID: backend, AuthorizationLabel: backend, Protected: true, ReadOnly: definition.ReadOnly, Tool: tool.ToolSpec{
		Name: definition.Name, Description: definition.Description, Schema: append(json.RawMessage(nil), definition.Schema...),
	}}
	if definition.BackendID != backend {
		return Route{}, fmt.Errorf("%w: protected backend mismatch", ErrInvalidRoute)
	}
	if err := validateProtectedRoute(route); err != nil {
		return Route{}, err
	}
	return route, nil
}

func validateProtectedRoute(route Route) error {
	prefix := "mcp__" + route.BackendID + "__"
	name := strings.TrimPrefix(route.Tool.Name, prefix)
	if route.BackendID == "" || !route.Protected || name == route.Tool.Name || name == "" {
		return fmt.Errorf("%w: malformed protected tool identity", ErrInvalidRoute)
	}
	for _, char := range name {
		if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '_' || char == '-' || char == '.') {
			return fmt.Errorf("%w: malformed protected tool name", ErrInvalidRoute)
		}
	}
	if !utf8.ValidString(route.Tool.Description) || len(route.Tool.Description) > 64<<10 || len(route.Tool.Schema) > 1<<20 || !json.Valid(route.Tool.Schema) {
		return fmt.Errorf("%w: malformed protected tool definition", ErrInvalidRoute)
	}
	var schema map[string]any
	if err := json.Unmarshal(route.Tool.Schema, &schema); err != nil || schema == nil {
		return fmt.Errorf("%w: malformed protected tool schema", ErrInvalidRoute)
	}
	return nil
}

func (r *Runtime) invalidateProtectedAdmission(id session.SessionID) {
	r.mu.Lock()
	opened := r.sessions[id]
	for _, backend := range r.protectedBackends {
		target := controlTarget{sessionID: id, backendID: backend}
		delete(r.transactions, target)
		delete(r.authorizations, target)
		delete(r.grants, target)
	}
	r.mu.Unlock()
	if opened != nil {
		opened.mu.Lock()
		kept := opened.tools[:0]
		for _, wrapped := range opened.tools {
			if _, protected := wrapped.(*protectedSessionTool); !protected {
				kept = append(kept, wrapped)
			}
		}
		opened.tools = kept
		opened.protectedFrozen = false
		opened.mu.Unlock()
	}
}

// RejectProtectedCatalogue clears the complete process-local protected admission.
func (r *Runtime) RejectProtectedCatalogue(id session.SessionID) { r.invalidateProtectedAdmission(id) }

// WorkspaceEnrollmentRequired reports whether protected tools require admission.
func (r *Runtime) WorkspaceEnrollmentRequired() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return !r.closed && len(r.protectedBackends) > 0
}

// WorkspaceEnrollmentLive reports whether the exact safe pending correlation still
// has a process-local ToolHive transaction. It exposes no backend or OAuth data.
func (r *Runtime) WorkspaceEnrollmentLive(id session.SessionID, enrollmentID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.closed || enrollmentID == "" || len(r.protectedBackends) == 0 || !r.openSessionLocked(id) {
		return false
	}
	transaction, ok := r.transactions[controlTarget{sessionID: id, backendID: r.protectedBackends[0]}]
	return ok && transaction.handle == enrollmentID && transaction.expiresAt.After(r.now())
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
	opened := r.sessions[id]
	if r.closed || opened == nil || !r.openSessionLocked(id) || len(r.protectedBackends) == 0 {
		return false
	}
	opened.mu.RLock()
	frozen := opened.protectedFrozen
	opened.mu.RUnlock()
	if !frozen {
		return false
	}
	for _, backend := range r.protectedBackends {
		if _, ok := r.grants[controlTarget{sessionID: id, backendID: backend}]; !ok {
			return false
		}
	}
	return true
}
