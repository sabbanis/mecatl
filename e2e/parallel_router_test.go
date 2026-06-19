//go:build e2e

package e2e_test

import (
	"os"
	"strings"
	"time"

	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/e2e/harness"
)

// parallelRouterSpecs covers the OPT-IN semantic model router (ADR 0031, extended to
// PARALLEL BRANCHES by issue #100) LIVE: a mecated spawned with --subagent-model-router
// and a models.router taxonomy must, on a real Parallel fan-out, classify each branch's
// task and mint that branch on the chosen category's model.
//
// OWN SPAWN: like modelRouterSpecs / teamRouterSpecs it owns its OWN mecated (NOT the
// shared suite target) because it needs the --subagent-model-router flag plus a router
// taxonomy, which the shared target is not started with. Local-only by construction.
//
// HOW THE ASSERTION WORKS. This spec asserts three observable facts that together prove
// the parallel family's routing actually FIRED and did not wedge:
//
//	(A) the build-once "subagent model router ACTIVE" INFO (logModelRouterFacts) — the
//	    router was wired, not silently OFF. The SAME routeTask closure that fact narrates
//	    is the one threaded into the Parallel tool's branch-routing path
//	    (ParallelTool.maybeRouteBranchModel → caps.routeTask), so an ACTIVE router IS the
//	    branch router.
//
//	(B) a Parallel call with two branches steering toward different categories actually
//	    RAN and JOINED — parallel.start (BranchCount=2) + per-branch starts + parallel.end
//	    fired, the Parallel result is non-error, and the run ended cleanly — i.e. each
//	    branch's classifier call plus the routed branch runs all executed against the live
//	    provider without wedging.
//
//	(C) the per-classification "subagent routed" INFO (category+model) appears in the log.
//	    This shared closure (engine/agent/dispatch.go) emits one such LevelInfo line on
//	    EVERY successful classification, and the Parallel tool routes each def-less branch
//	    through that exact closure. Because this spec drives ONLY a Parallel call (no
//	    Subagent calls), any "subagent routed" line MUST have come from a branch
//	    classification — a clean, family-specific "routing fired and selected a model"
//	    signal. (NB the message string is hardcoded "subagent routed" even for branch
//	    classifications — cosmetically inaccurate now that the closure is shared, but the
//	    line is the genuine per-branch routing diagnostic.)
//
// WHY THE "subagent routed" LINE IS A RELIABLE PROOF (and the classifier knob). The line
// fires only on a SUCCESSFUL classification: the classifier must emit the one-line JSON
// verdict, which RunModelRouter parses whole-output-single-object (modelrouter.go); a
// verdict-less/empty classifier turn is a clean fail-soft MISS that emits NO line. So the
// assertion is only as reliable as the CLASSIFIER MODEL. The classifier slot is therefore
// a SEPARATE knob (MECATL_E2E_ROUTER_CLASSIFIER_MODEL, default anthropic/claude-3.5-haiku
// — alias router-cat → slots.router) from the cheap category-target models: a small Claude
// that demonstrably emits the JSON verdict, NOT reused from the category lane (a prior
// openai/gpt-4.1-mini classifier returned near-empty completions and produced no line, the
// live flake this fixes). With a reliable classifier the line is a genuine end-to-end proof
// that the parallel routing path FIRED against a real provider. The DETERMINISTIC per-family
// routed-model proof is the offline internal/app test
// (TestParallelRoutesBranchesToCategoryModelsE2E reads each branch's Model off a mock
// observer); this live test proves the same path works against a real provider with a
// reliable classifier — kept FlakeAttempts(2) for residual provider jitter, not classifier
// emptiness.
//
// LIMITATION: the harness cannot observe a routed branch's model on the CLIENT WIRE. The
// routed classification (RoutedCategory/RoutedModel on session.ParallelPayload, carried
// on parallel.branch{branch_start}) has NO proto/client projection this slice — the
// deliberate follow-up the Subagent router test documents (see model_router_test.go and
// ADR 0031). So the "subagent routed" LOG line is the live per-classification signal;
// the full per-branch routed-model WIRE assertion lands with the proto/client
// RoutedModel fields (the offline internal/app tests already read each branch's Model
// off a mock observer).
func parallelRouterSpecs() {
	ginkgo.Describe("parallel model router", func() {
		ginkgo.It("routes parallel branches through the classifier and joins cleanly",
			ginkgo.FlakeAttempts(2), ginkgo.SpecTimeout(7*time.Minute),
			func(ctx ginkgo.SpecContext) {
				if !target.IsLocal() {
					ginkgo.Skip("remote target: cannot spawn with --subagent-model-router / a router taxonomy")
				}

				// The router taxonomy lives in the OPERATOR-TIER settings.yaml; write a
				// temp one and point mecated's config at it. Both categories map to real,
				// cheap OpenRouter-lane models so a routed branch actually runs.
				small := envOrDefault("MECATL_E2E_ROUTER_SMALL_MODEL", "openai/gpt-4.1-mini")
				large := envOrDefault("MECATL_E2E_ROUTER_LARGE_MODEL", "openai/gpt-4.1")
				// The CLASSIFIER slot is a SEPARATE knob from the category targets: it must
				// reliably emit the one-line JSON verdict on OpenRouter, or RunModelRouter
				// gets a verdict-less turn → fail-soft miss → NO "subagent routed" line (the
				// live flake — openai/gpt-4.1-mini returned near-empty completions as the
				// classifier). Default to a small Claude that demonstrably emits the JSON
				// verdict; the category targets stay cheap (they only run the routed branch).
				classifier := envOrDefault("MECATL_E2E_ROUTER_CLASSIFIER_MODEL", "anthropic/claude-3.5-haiku")
				dir, err := os.MkdirTemp("", "mecatl-parallel-router-e2e-*")
				gomega.Expect(err).NotTo(gomega.HaveOccurred())
				defer func() { _ = os.RemoveAll(dir) }()
				settings := dir + "/settings.yaml"
				cfg := "" +
					"models:\n" +
					"  aliases:\n" +
					"    small-cat: " + small + "\n" +
					"    large-cat: " + large + "\n" +
					"    router-cat: " + classifier + "\n" +
					"  slots:\n" +
					"    router: router-cat\n" +
					"  router:\n" +
					"    default-category: small\n" +
					"    categories:\n" +
					"      - name: small\n" +
					"        description: trivial single-step lookups and one-word replies\n" +
					"        model: small-cat\n" +
					"      - name: large\n" +
					"        description: deep multi-step reasoning and analysis\n" +
					"        model: large-cat\n"
				gomega.Expect(os.WriteFile(settings, []byte(cfg), 0o600)).To(gomega.Succeed())

				spawn, err := harness.NewLocalWith(
					"--permission-config", settings,
					"--subagent-model-router",
				)
				gomega.Expect(err).NotTo(gomega.HaveOccurred(), "spawn local mecated with --subagent-model-router")
				defer func() { _ = spawn.Close() }()

				drv := harness.NewDriver(spawn)
				logTail := func() string { return "\n--- mecated log tail ---\n" + spawn.LogTail(8192) }

				// (A) The build-once router fact must be present at startup — the same
				// closure it narrates is the one the Parallel tool consults per branch.
				startLog := spawn.LogTail(8192)
				gomega.Expect(startLog).To(gomega.ContainSubstring("subagent model router ACTIVE"),
					"the build-once router fact must narrate the active router"+logTail())

				// (B) Drive a Parallel fan-out with two branches whose tasks steer toward
				// different categories, joined with join="all" so both branches must
				// complete. Each branch is a routed path (no agent def pins a branch).
				res, runErr := drv.Run(ctx, harness.RunOpts{
					Scenario: "parallel-router-fanout", Timeout: 5 * time.Minute,
				}, `Use the tool named "Parallel" — not the Subagent tool — exactly once, with these arguments: tasks = ["A trivial single-step lookup: reply with the single word RED. Call no tool.", "A deep multi-step analysis task: reply with the single word BLUE. Call no tool."] and join = "all". Never call Subagent and call no other tool. When the Parallel tool returns, reply with the single word done.`)
				gomega.Expect(runErr).NotTo(gomega.HaveOccurred(), "parallel router fan-out transport error"+logTail())
				gomega.Expect(res.Result).NotTo(gomega.BeNil(), "parallel router fan-out produced no terminal result"+logTail())

				// The Parallel call ran with a 2-branch fan-out — each branch was started
				// (and, being def-less, classified).
				starts := res.ParallelMsgs(client.ParallelStart)
				gomega.Expect(starts).NotTo(gomega.BeEmpty(), "no parallel.start observed"+logTail())
				gomega.Expect(starts[0].BranchCount).To(gomega.Equal(2),
					"expected a 2-branch fan-out"+logTail())

				branchStarts := res.ParallelMsgs(client.ParallelBranchStart)
				branches := map[int]bool{}
				for _, b := range branchStarts {
					branches[b.BranchIndex] = true
				}
				gomega.Expect(len(branches)).To(gomega.BeNumerically(">=", 2),
					"expected >=2 distinct branch starts (each a routed branch)"+logTail())

				// The fan-out JOINED (join="all" requires both branches to finish) — each
				// branch's classifier call plus the routed branch run all executed.
				gomega.Expect(res.ParallelMsgs(client.ParallelEnd)).NotTo(gomega.BeEmpty(),
					"no parallel.end observed — the fan-out did not join"+logTail())

				calls := res.ToolCalls("Parallel")
				gomega.Expect(calls).NotTo(gomega.BeEmpty(), "no Parallel tool.call observed"+logTail())
				tr := res.ToolResult(calls[0].ID)
				gomega.Expect(tr).NotTo(gomega.BeNil(), "no Parallel tool result observed"+logTail())
				gomega.Expect(tr.IsError).To(gomega.BeFalse(), "Parallel tool result errored"+logTail())

				// The run ended cleanly: nothing wedged against the live provider.
				gomega.Expect(res.Stop()).To(gomega.Equal("end_turn"),
					"the run did not end cleanly (stop="+res.Stop()+") — a branch classifier or a routed branch may have wedged"+logTail())
				gomega.Expect(strings.TrimSpace(res.Result.Error)).To(gomega.BeEmpty(),
					"a clean routed parallel run carries no error"+logTail())

				// (C) Routing ACTUALLY FIRED for the parallel family. The shared routeTask
				// closure emits a "subagent routed" INFO (category+model) on every
				// successful classification; the Parallel tool routes each def-less branch
				// through it. Re-read the log tail AFTER res returns (these lines are
				// emitted MID-RUN per branch, not at startup). Only the Parallel call ran
				// here (no Subagent calls), so any such line is a branch classification.
				// >=1 is the robust floor (this run expects ~2 — both branches are
				// def-less/routed); the count is not over-tightened to avoid flaking on
				// live model behaviour.
				runLog := spawn.LogTail(65536)
				gomega.Expect(runLog).To(gomega.ContainSubstring("subagent routed"),
					"expected at least one per-classification 'subagent routed' INFO from a branch classification (routing did not fire)"+logTail())
			})
	})
}
