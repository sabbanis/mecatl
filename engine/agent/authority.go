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

// parallelChildAuthority consumes one delegation hop before a Parallel branch
// acquires its workspace or child engine.
func parallelChildAuthority(parent governance.Authority) (governance.Authority, error) {
	return parent.Descend()
}

// teamChildAuthority consumes one delegation hop before a Team lead or member
// acquires its session or child engine.
func teamChildAuthority(parent governance.Authority) (governance.Authority, error) {
	return parent.Descend()
}

// persistedChildAuthority rejects an absent persisted child bound. Resume must
// never fall back to the current authority, named definition, or defaults.
func persistedChildAuthority(raw string) (governance.Authority, error) {
	if raw == "" {
		return governance.Authority{}, fmt.Errorf("missing persisted child authority")
	}
	authority, err := governance.ParseAuthority(raw)
	if err != nil {
		return governance.Authority{}, fmt.Errorf("invalid persisted child authority: %w", err)
	}
	return authority, nil
}

// resumedChildAuthority narrows a persisted child bound with the current
// operator ceiling. The caller supplies only revocations; it is never a source
// of new authority.
func resumedChildAuthority(persisted, operatorCeiling governance.Authority) (governance.Authority, error) {
	return persisted.Intersect(operatorCeiling)
}

// effectiveResumedChildAuthority reads the immutable v1 bound from the persisted
// child. The current ceiling may only remove authority for this run; it is never
// written back to the child snapshot.
func effectiveResumedChildAuthority(childAuthority string, compatibilityOnly bool, operatorCeiling governance.Authority) (governance.Authority, error) {
	if compatibilityOnly {
		// Pre-v1 snapshots have no persisted bound. Retain the historical
		// compatibility behavior, but never use this path for a v1 snapshot.
		return operatorCeiling, nil
	}
	persisted, err := persistedChildAuthority(childAuthority)
	if err != nil {
		return governance.Authority{}, err
	}
	return resumedChildAuthority(persisted, operatorCeiling)
}
