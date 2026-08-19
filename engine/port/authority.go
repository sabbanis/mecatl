package port

import (
	"context"

	"github.com/stacklok/mecatl/engine/governance"
)

// AuthorityPrincipal identifies the authority under which a tool is requested.
// Definition is the resolved agent-definition identity, Instance identifies this
// concrete run, and Owner identifies the caller that owns it. They are distinct
// from the capability set and intentionally contain no credentials.
type AuthorityPrincipal struct {
	Definition string
	Instance   string
	Owner      string
}

// AuthorityRequest is the provider-neutral input to AuthorityEvaluator. The
// carried capability set is the complete local authority fact; evaluators do not
// look it up from mutable state. ToolName and DelegationDepth provide the action
// context, while Principal carries attribution without credentials or raw tool
// arguments.
type AuthorityRequest struct {
	CapabilitySet   governance.CapabilitySet
	ToolName        string
	DelegationDepth int
	Principal       AuthorityPrincipal
}

// AuthorityDecision is an evaluator's authorization result. A denied decision
// is a successful evaluation; an unavailable evaluator returns an error so the
// call site can fail closed and report that condition separately.
type AuthorityDecision struct {
	Allowed bool
	Reason  string
}

// AuthorityEvaluator authorizes one tool execution against a carried capability
// set. Implementations may only tighten the set's authority; they must not use
// external policy to grant a tool the set omits.
type AuthorityEvaluator interface {
	AuthorizeTool(context.Context, AuthorityRequest) (AuthorityDecision, error)
}
