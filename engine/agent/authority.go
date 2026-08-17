package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// childAuthorityRequest describes only static execution posture. It deliberately
// excludes fork: copying history is not an execution-isolation grant.
type childAuthorityRequest struct {
	delegate    string
	filesystem  bool
	directWrite bool
}

// deriveChildAuthority intersects only ceilings and consumes one delegation hop.
// It is pure so callers can run it before selecting an engine, environment, or
// other runtime resource.
func deriveChildAuthority(parent, definition governance.Authority, request childAuthorityRequest) (governance.Authority, error) {
	effective, err := parent.Intersect(definition)
	if err != nil {
		return governance.NoneAuthority(), fmt.Errorf("invalid authority ceiling: %w", err)
	}
	if !request.directWrite {
		effective, err = effective.WithoutDirectWrite()
		if err != nil {
			return governance.NoneAuthority(), fmt.Errorf("attenuate direct-write: %w", err)
		}
	}
	if request.delegate != "" {
		requirement, err := governance.NewAuthority(governance.AuthoritySpec{
			Delegates:          []string{request.delegate},
			MaxDelegationDepth: 1,
		})
		if err != nil || !effective.Contains(requirement) {
			return governance.NoneAuthority(), fmt.Errorf("delegate %q is not authorized", request.delegate)
		}
	}
	if request.filesystem || request.directWrite {
		requirement, err := governance.NewAuthority(governance.AuthoritySpec{Profile: governance.AuthorityProfile{
			FileSystem: request.filesystem, DirectWrite: request.directWrite,
		}})
		if err != nil || !effective.Contains(requirement) {
			return governance.NoneAuthority(), fmt.Errorf("requested execution posture is not authorized")
		}
	}
	return effective.Descend()
}

// parallelChildAuthority gives each force-copied Parallel branch one attenuated
// hop; isolated writes are not direct writes into the parent workspace.
func parallelChildAuthority(parent governance.Authority) (governance.Authority, error) {
	return deriveChildAuthority(parent, governance.UnrestrictedAuthority(), childAuthorityRequest{filesystem: true})
}

// authorityToolSearch filters progressive hydration at execution time. ToolSearch
// is a catalog query rather than a separate runtime capability, so it must receive
// the same live maximum as disclosure and dispatch.
type authorityToolSearch struct {
	inner     tool.Tool
	authority func(context.Context) (governance.Authority, bool)
}

func (t authorityToolSearch) Spec() tool.ToolSpec { return t.inner.Spec() }
func (t authorityToolSearch) ReadOnly() bool      { return t.inner.ReadOnly() }

func (t authorityToolSearch) Execute(ctx context.Context, call session.ToolCall, env tool.Environment) (session.ToolResult, error) {
	authority, ok := t.authority(ctx)
	if !ok {
		return session.NewToolError(call.ID, "ToolSearch: denied by authority bound"), nil
	}
	result, err := t.inner.Execute(ctx, call, env)
	if err != nil || result.IsError {
		return result, err
	}
	var specs []json.RawMessage
	if err := json.Unmarshal([]byte(result.Content), &specs); err != nil {
		return session.NewToolError(call.ID, "ToolSearch: authority could not verify hydration results"), nil
	}
	filtered := specs[:0]
	for _, spec := range specs {
		var identity struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(spec, &identity); err != nil {
			return session.NewToolError(call.ID, "ToolSearch: authority could not verify hydration results"), nil
		}
		if authority.AllowsTool(identity.Name) {
			filtered = append(filtered, spec)
		}
	}
	body, err := json.Marshal(filtered)
	if err != nil {
		return session.NewToolError(call.ID, "ToolSearch: authority could not filter hydration results"), nil
	}
	return session.NewToolResult(call.ID, string(body)), nil
}
