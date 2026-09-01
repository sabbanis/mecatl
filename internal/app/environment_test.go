package app

import (
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memledger"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/team"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/osfs"
)

func testReadLedger() tool.ReadLedger { return memledger.New() }

func newTestSubagentTool(engine *agent.Engine, opts ...agent.SubagentOption) tool.Tool {
	opts = append(opts, agent.WithSubagentReadLedgerFactory(testReadLedger))
	return agent.NewSubagentTool(engine, opts...)
}

func newTestSupervisor(tm *team.Team, base tool.Environment, factory agent.MemberEngine, opts ...agent.SupervisorOption) *agent.Supervisor {
	opts = append(opts, agent.WithTeamReadLedgerFactory(testReadLedger))
	return agent.NewSupervisor(tm, base, factory, opts...)
}

func testEnvironment(ws tool.Workspace, runner tool.CommandRunner) tool.Environment {
	return tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindMem, ID: ws.Root()}, ws, memledger.New(), runner)
}

func memEnvironment(root string) tool.Environment {
	return testEnvironment(memfs.NewWorkspace(root), nil)
}

// osfsEnvironment builds an osfs Environment rooted at dir with an OPTIONAL
// bound command runner, failing the test on error. It is the Environment-seam
// analogue of osfsWSForTest for the app tests that drive an engine or
// delegation tool against a real on-disk workspace (issue #462).
func osfsEnvironment(t *testing.T, dir string, runner tool.CommandRunner) tool.Environment {
	t.Helper()
	ws, err := osfs.NewWorkspace(dir)
	if err != nil {
		t.Fatalf("osfs workspace %q: %v", dir, err)
	}
	return tool.MustEnvironment(session.EnvironmentRef{Kind: session.EnvKindLocal, ID: dir}, ws, memledger.New(), runner)
}
