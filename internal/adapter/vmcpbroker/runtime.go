// Package vmcpbroker owns the root-internal boundary for session-scoped vMCP
// tools. It deliberately projects only neutral ToolSpecs into the engine; the
// route used to execute a wrapper remains in this adapter.
package vmcpbroker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

// ErrClosed reports an operation on a closed runtime or session tool set.
var ErrClosed = errors.New("vmcpbroker: closed")

// ErrInvalidRoute reports invalid static broker catalogue input.
var ErrInvalidRoute = errors.New("vmcpbroker: invalid route")

// Route joins a neutral, model-facing tool specification to its private broker
// backend route. BackendID is consumed only by the injected broker caller; it
// is never copied into ToolSpec, a ToolCall, or a ToolResult.
type Route struct {
	BackendID string
	Tool      tool.ToolSpec
	ReadOnly  bool
}

// ToolDefinition is the neutral result of ToolHive's static tool discovery.
// ToolHive-specific values must be reduced to this form before they reach the
// Runtime catalogue.
type ToolDefinition struct {
	BackendID   string
	Name        string
	Description string
	Schema      json.RawMessage
	ReadOnly    bool
}

// CompileProfiles builds a deterministic immutable broker catalogue from the
// configured operator profiles and ToolHive's discovered tool definitions.
// It rejects a discovery result for a backend that the operator did not
// configure, preventing a backend route from being invented at execution time.
func CompileProfiles(profiles []permconfig.MCPServerProfile, discovered []ToolDefinition) ([]Route, error) {
	configured := make(map[string]struct{}, len(profiles))
	for _, profile := range profiles {
		configured[profile.Name] = struct{}{}
	}
	routes := make([]Route, 0, len(discovered))
	seen := make(map[string]struct{}, len(discovered))
	for _, definition := range discovered {
		if _, ok := configured[definition.BackendID]; !ok {
			return nil, fmt.Errorf("%w: unconfigured backend %q", ErrInvalidRoute, definition.BackendID)
		}
		if definition.Name == "" {
			return nil, fmt.Errorf("%w: tool name is required", ErrInvalidRoute)
		}
		if _, ok := seen[definition.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, definition.Name)
		}
		seen[definition.Name] = struct{}{}
		routes = append(routes, Route{
			BackendID: definition.BackendID,
			Tool: tool.ToolSpec{
				Name:        definition.Name,
				Description: definition.Description,
				Schema:      append(json.RawMessage(nil), definition.Schema...),
			},
			ReadOnly: definition.ReadOnly,
		})
	}
	sort.Slice(routes, func(i, j int) bool { return routes[i].Tool.Name < routes[j].Tool.Name })
	return routes, nil
}

// Caller is the broker-private execution seam. A production caller uses the
// embedded ToolHive streaming-HTTP client; it receives the route separately
// from the model-controlled arguments.
type Caller func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error)

// Runtime owns the stable catalogue and opens session-local executable wrappers.
type Runtime struct {
	mu     sync.RWMutex
	routes []Route
	caller Caller
	closed bool
}

// NewRuntime constructs a Runtime with an immutable copy of routes.
func NewRuntime(routes []Route, caller Caller) (*Runtime, error) {
	if caller == nil {
		return nil, fmt.Errorf("%w: caller is required", ErrInvalidRoute)
	}
	copied := make([]Route, len(routes))
	seen := make(map[string]struct{}, len(routes))
	for i, route := range routes {
		if route.BackendID == "" || route.Tool.Name == "" {
			return nil, fmt.Errorf("%w: backend id and tool name are required", ErrInvalidRoute)
		}
		if _, ok := seen[route.Tool.Name]; ok {
			return nil, fmt.Errorf("%w: duplicate tool %q", ErrInvalidRoute, route.Tool.Name)
		}
		seen[route.Tool.Name] = struct{}{}
		copied[i] = copyRoute(route)
	}
	sort.Slice(copied, func(i, j int) bool { return copied[i].Tool.Name < copied[j].Tool.Name })
	return &Runtime{routes: copied, caller: caller}, nil
}

// OpenSession returns new executable wrappers for one already-reserved canonical
// mecatl session ID. Reservation and persistence remain server responsibilities;
// this adapter never mints, rewrites, or exposes session IDs.
func (r *Runtime) OpenSession(id session.SessionID) (*SessionTools, error) {
	if id == "" {
		return nil, fmt.Errorf("%w: session id is required", ErrInvalidRoute)
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.closed {
		return nil, ErrClosed
	}
	opened := &SessionTools{}
	tools := make([]tool.Tool, len(r.routes))
	for i, route := range r.routes {
		tools[i] = &sessionTool{sessionID: id, route: route, caller: r.caller, owner: opened}
	}
	opened.tools = tools
	return opened, nil
}

// Close prevents new session wrappers. Existing wrappers are intentionally not
// closed here; their owning session closes them before Runtime shutdown.
func (r *Runtime) Close() error {
	r.mu.Lock()
	r.closed = true
	r.mu.Unlock()
	return nil
}

// SessionTools owns the wrappers for one session.
type SessionTools struct {
	mu     sync.RWMutex
	tools  []tool.Tool
	closed bool
}

// Tools returns a copy of the stable model-facing wrapper list.
func (s *SessionTools) Tools() []tool.Tool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]tool.Tool(nil), s.tools...)
}

// Close makes the session's wrappers unavailable. It is idempotent.
func (s *SessionTools) Close() error {
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	return nil
}

type sessionTool struct {
	sessionID session.SessionID
	route     Route
	caller    Caller
	owner     *SessionTools
}

func (t *sessionTool) Spec() tool.ToolSpec { return copyRoute(t.route).Tool }
func (t *sessionTool) ReadOnly() bool      { return t.route.ReadOnly }

func (t *sessionTool) Execute(ctx context.Context, call session.ToolCall, _ tool.Environment) (session.ToolResult, error) {
	t.owner.mu.RLock()
	closed := t.owner.closed
	t.owner.mu.RUnlock()
	if closed {
		return session.ToolResult{}, ErrClosed
	}
	if call.Name != t.route.Tool.Name {
		return session.NewToolError(call.ID, "broker tool call does not match wrapper"), nil
	}
	if err := ctx.Err(); err != nil {
		return session.ToolResult{}, err
	}
	return t.caller(ctx, t.sessionID, copyRoute(t.route), append(json.RawMessage(nil), call.Args...))
}

func copyRoute(in Route) Route {
	in.Tool.Schema = append(json.RawMessage(nil), in.Tool.Schema...)
	return in
}
