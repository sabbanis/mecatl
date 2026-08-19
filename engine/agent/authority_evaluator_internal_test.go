package agent

import (
	"testing"

	"github.com/stacklok/mecatl/engine/governance"
)

func TestADR_0228_AuthorityEvaluator_Scenario3_ResourceReachDerivesFromToolNames(t *testing.T) {
	set := governance.CapabilitySet{Tools: []string{"mcp__github__list_issues", "Read"}}
	if !authorityAllowsMCPResources(set, "github") {
		t.Fatal("github resource reach must derive from its carried MCP tool name")
	}
	if authorityAllowsMCPResources(set, "slack") {
		t.Fatal("slack resource reach must not be granted by github's carried tool name")
	}
	if authorityAllowsMCPResources(governance.CapabilitySet{Tools: []string{"Read"}}, "github") {
		t.Fatal("a server resource reach must not have a separately authored grant")
	}
}
