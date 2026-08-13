package agent

import (
	"fmt"

	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/tool"
)

// DeriveChildAuthority returns the capability envelope a child may receive.
// Each input is a ceiling, never a grant: the result is their intersection.
func DeriveChildAuthority(parent, definition, call governance.Authority) (governance.Authority, error) {
	effective, err := parent.Intersect(definition)
	if err != nil {
		return governance.Authority{}, err
	}
	return effective.Intersect(call)
}

// derivedChildAuthority intersects the caller's authority with an optional
// named-agent definition and the concrete child request. It runs before any
// child resource is acquired.
func childAuthorityFor(parent governance.Authority, ceiling *tool.AgentAuthorityCeiling, args subagentArgs) (governance.Authority, error) {
	if _, err := parent.Canonical(); err != nil {
		return governance.Authority{}, fmt.Errorf("invalid parent authority: %w", err)
	}
	if ceiling == nil {
		// An explicitly omitted definition ceiling inherits the caller's ceiling.
		return childAuthorityForDefined(parent, parent, args)
	}
	definition, err := governance.ParseAuthority(string(*ceiling))
	if err != nil {
		return governance.Authority{}, fmt.Errorf("invalid definition authority: %w", err)
	}
	return childAuthorityForDefined(parent, definition, args)
}

func childAuthorityForDefined(parent, definition governance.Authority, args subagentArgs) (governance.Authority, error) {
	effective, err := DeriveChildAuthority(parent, definition, governance.UnrestrictedAuthority())
	if err != nil {
		return governance.Authority{}, err
	}
	if args.Agent != "" {
		requirement, _ := governance.NewAuthority(governance.AuthoritySpec{Delegates: []string{args.Agent}, MaxDelegationDepth: 1})
		if !effective.Contains(requirement) {
			return governance.Authority{}, fmt.Errorf("subagent %q is not delegated by the effective authority", args.Agent)
		}
	}
	if args.Fork {
		requirement, _ := governance.NewAuthority(governance.AuthoritySpec{Profile: governance.AuthorityProfile{Isolated: true}})
		if !effective.Contains(requirement) {
			return governance.Authority{}, fmt.Errorf("fork is not delegated by the effective authority")
		}
	}
	if args.Mode == subagentModeReadWrite {
		requirement, _ := governance.NewAuthority(governance.AuthoritySpec{Profile: governance.AuthorityProfile{DirectWrite: true}})
		if !effective.Contains(requirement) {
			return governance.Authority{}, fmt.Errorf("read-write mode is not delegated by the effective authority")
		}
	}
	return effective.Descend()
}

// childEngineWithAuthority keeps child catalog construction on the existing
// NewEngine path, which applies the authority root restriction before use.
func childEngineWithAuthority(parent *Engine, authority governance.Authority) *Engine {
	deps := parent.deps
	deps.Authority = authority
	return NewEngine(deps)
}
