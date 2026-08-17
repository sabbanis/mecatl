package agent

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestADR_0226_AuthorityAttenuation_Scenario4_ExtraToolsRequireExactAuthorization(t *testing.T) {
	t.Parallel()

	allowed := &fakeOverlayTool{name: "allowed"}
	excluded := &fakeOverlayTool{name: "excluded"}
	extraAllowed := &fakeOverlayTool{name: "extra_allowed"}
	extraExcluded := &fakeOverlayTool{name: "extra_excluded"}
	engine := authorityTestEngine(allowed, excluded)
	sess := session.New("bound", session.ModeDefault, "/ws", session.Limits{}, time.Now())
	const bound = `{"v":1,"kind":"restricted","tools":["allowed","extra_allowed"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	if err := sess.BindAuthority(bound, ""); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}

	run := engine.startRun(context.Background(), sess, RunRequest{ExtraTools: []tool.Tool{extraAllowed, extraExcluded}}, func(context.Context, *Run) {})
	req := engine.buildRequest(context.Background(), run, sess, testEnvironment(memfs.NewWorkspace("/ws"), nil))
	if got := authorityToolNames(req.Tools); !sameAuthorityToolNames(got, []string{"allowed", "extra_allowed"}) {
		t.Fatalf("advertised tools = %v, want [allowed extra_allowed]", got)
	}
	if _, ok := engine.lookupTool(run, "extra_excluded"); ok {
		t.Fatal("lookupTool resolved unauthorized ExtraTool")
	}
	if _, ok := engine.lookupTool(run, "extra_allowed"); !ok {
		t.Fatal("lookupTool did not resolve exactly authorized ExtraTool")
	}
}

func TestAuthorityAttenuation_LegacySessionPreservesCatalogAndExtraTools(t *testing.T) {
	t.Parallel()

	allowed := &fakeOverlayTool{name: "allowed"}
	excluded := &fakeOverlayTool{name: "excluded"}
	extra := &fakeOverlayTool{name: "extra"}
	engine := authorityTestEngine(allowed, excluded)
	sess := session.New("legacy", session.ModeDefault, "/ws", session.Limits{}, time.Now())
	run := engine.startRun(context.Background(), sess, RunRequest{ExtraTools: []tool.Tool{extra}}, func(context.Context, *Run) {})
	req := engine.buildRequest(context.Background(), run, sess, testEnvironment(memfs.NewWorkspace("/ws"), nil))
	if got := authorityToolNames(req.Tools); !sameAuthorityToolNames(got, []string{"allowed", "excluded", "extra"}) {
		t.Fatalf("advertised tools = %v, want [allowed excluded extra]", got)
	}
}

func authorityTestEngine(tools ...tool.Tool) *Engine {
	catalog := tool.NewCatalog()
	for _, candidate := range tools {
		catalog.MustRegister(candidate)
	}
	return NewEngine(Deps{
		LLM:     mockllm.New(),
		Catalog: catalog,
		Policy:  permpolicy.NewPolicy(permpolicy.AllowAllFloorRules(), nil),
		Model:   "test",
	})
}

func authorityToolNames(specs []tool.ToolSpec) []string {
	names := make([]string, 0, len(specs))
	for _, spec := range specs {
		names = append(names, spec.Name)
	}
	return names
}

func sameAuthorityToolNames(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := make(map[string]bool, len(got))
	for _, name := range got {
		seen[name] = true
	}
	for _, name := range want {
		if !seen[name] {
			return false
		}
	}
	return true
}
