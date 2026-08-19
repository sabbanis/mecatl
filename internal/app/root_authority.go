package app

import (
	"fmt"
	"strings"

	"github.com/stacklok/mecatl/engine/adapter/localauthority"
	"github.com/stacklok/mecatl/engine/adapter/noopauthority"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

const (
	rootAuthorityProvenance = "composed_root"
	rootAuthorityDefinition = "root"
	rootDelegationDepth     = 1
)

func authorityEvaluatorPostureLine(adapter string) string {
	return fmt.Sprintf("authority evaluator posture: adapter=%s enforcement=%t", adapter, adapter == "local")
}

func selectAuthorityEvaluator(mode string) (port.AuthorityEvaluator, string, error) {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", "local":
		return localauthority.New(), "local", nil
	case "noop":
		return noopauthority.New(), "noop", nil
	default:
		return nil, "", fmt.Errorf("unknown authority evaluator %q (supported: local, noop)", mode)
	}
}

func managedDefinitionAuthority(def tool.AgentDef) bool {
	return def.Origin == tool.AgentOriginExplicit
}

// mintRootAuthority establishes a complete root capability set from the catalog
// assembled for the session. Child derivation consumes this carried value later;
// it is not performed at the composition root.
func mintRootAuthority(catalog *tool.Catalog, _ session.SessionKind) session.Authority {
	tools := catalog.Tools()
	names := make([]string, len(tools))
	for i, registered := range tools {
		names[i] = registered.Spec().Name
	}
	_, fileSystem := catalog.Lookup("Read")
	_, directWrite := catalog.Lookup("Write")
	return session.Authority{
		CapabilitySet: governance.CapabilitySet{
			Tools:                    names,
			RemainingDelegationDepth: rootDelegationDepth,
			FileSystem:               fileSystem,
			DirectWrite:              directWrite,
		},
		Provenance:         rootAuthorityProvenance,
		DefinitionIdentity: rootAuthorityDefinition,
	}
}
