// Package authorityconformance provides shared contract checks for
// port.AuthorityEvaluator adapters.
package authorityconformance

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
)

// Run verifies the common evaluator contract. Adapters may have different valid
// policy modes, but all must permit an in-set request and fail closed on a
// malformed one.
func Run(t *testing.T, newEvaluator func(t *testing.T) port.AuthorityEvaluator) {
	t.Helper()
	ctx := context.Background()
	valid := port.AuthorityRequest{
		CapabilitySet:   governance.CapabilitySet{Tools: []string{"Read"}, RemainingDelegationDepth: 1},
		ToolName:        "Read",
		Action:          "Read",
		DelegationDepth: 1,
		Principal:       port.AuthorityPrincipal{Definition: "definition", Instance: "instance", Owner: "owner"},
	}

	t.Run("permits a valid in-set request", func(t *testing.T) {
		decision, err := newEvaluator(t).AuthorizeTool(ctx, valid)
		if err != nil {
			t.Fatalf("AuthorizeTool: %v", err)
		}
		if !decision.Allowed {
			t.Fatalf("AuthorizeTool denied a valid in-set request: %+v", decision)
		}
	})

	t.Run("fails closed on a malformed request", func(t *testing.T) {
		malformed := valid
		malformed.ToolName = ""
		decision, err := newEvaluator(t).AuthorizeTool(ctx, malformed)
		if err != nil {
			t.Fatalf("AuthorizeTool malformed request: %v", err)
		}
		if decision.Allowed {
			t.Fatalf("AuthorizeTool allowed malformed request: %+v", decision)
		}
	})
}
