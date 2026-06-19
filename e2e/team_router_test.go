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

// teamRouterSpecs covers the OPT-IN semantic model router (ADR 0031, extended to
// TEAM MEMBERS by issue #100) LIVE: a mecated spawned with --subagent-model-router and
// a models.router taxonomy must, on a real Team delegation with PLAIN (undefined)
// members, classify each member's task and mint that member on the chosen category's
// model.
//
// OWN SPAWN: like modelRouterSpecs / modelSlotSpecs it owns its OWN mecated (NOT the
// shared suite target) because it needs the --subagent-model-router flag plus a router
// taxonomy, which the shared target is not started with. Local-only by construction.
//
// HOW THE ASSERTION WORKS. This spec asserts three observable facts that together prove
// the team family's routing actually FIRED and did not wedge:
//
//	(A) the build-once "subagent model router ACTIVE" INFO (logModelRouterFacts) — the
//	    router was wired, not silently OFF. The SAME routeTask closure that fact narrates
//	    is the one threaded into the team supervisor's member-routing path
//	    (Supervisor.maybeRouteMember → caps.routeTask), so an ACTIVE router IS the team
//	    router.
//
//	(B) a Team delegation with two undefined members actually RAN — team.start + team.end
//	    fired and the run ended cleanly — i.e. each member's classifier call plus the
//	    routed member runs all executed against the live provider without wedging.
//
//	(C) the per-classification "subagent routed" INFO (category+model) appears in the log.
//	    This shared closure (engine/agent/dispatch.go) emits one such LevelInfo line on
//	    EVERY successful classification, and the team supervisor routes its plain members
//	    through that exact closure. Because this spec drives ONLY a Team call (no Subagent
//	    calls), any "subagent routed" line MUST have come from a team-member
//	    classification — a clean, family-specific "routing fired and selected a model"
//	    signal. (NB the message string is hardcoded "subagent routed" even for team
//	    classifications — cosmetically inaccurate now that the closure is shared, but the
//	    line is the genuine per-member routing diagnostic.)
//
// WHY THE "subagent routed" LINE IS A RELIABLE PROOF (and the classifier knob). The line
// fires only on a SUCCESSFUL classification: the classifier must emit the one-line JSON
// verdict, which RunModelRouter parses whole-output-single-object (modelrouter.go); a
// verdict-less/empty classifier turn is a clean fail-soft MISS that emits NO line. So the
// assertion is only as reliable as the CLASSIFIER MODEL. The classifier slot is therefore
// a SEPARATE knob (MECATL_E2E_ROUTER_CLASSIFIER_MODEL, default google/gemini-2.5-flash
// — alias router-cat → slots.router) from the cheap category-target models: a small reliable model
// that demonstrably emits the JSON verdict, NOT reused from the category lane (a prior
// openai/gpt-4.1-mini classifier returned near-empty completions and produced no line, the
// live flake this fixes). With a reliable classifier the line is a genuine end-to-end proof
// that the team routing path FIRED against a real provider. The DETERMINISTIC per-family
// routed-model proof is the offline internal/app test
// (TestTeamRoutesMembersToCategoryModelsE2E reads each member's Model off a mock observer);
// this live test proves the same path works against a real provider with a reliable
// classifier — kept FlakeAttempts(2) for residual provider jitter, not classifier emptiness.
//
// LIMITATION: the harness cannot observe a routed member's model on the CLIENT WIRE. The
// routed classification (RoutedCategory/RoutedModel on session.TeamPayload) is a
// session-struct field with NO proto/client projection this slice — the deliberate
// follow-up the Subagent router test documents (see model_router_test.go and ADR 0031).
// So the "subagent routed" LOG line is the live per-classification signal; the full
// per-member routed-model WIRE assertion lands with the proto/client RoutedModel fields
// (the offline internal/app tests already read each member's Model off a mock observer).
func teamRouterSpecs() {
	ginkgo.Describe("team model router", func() {
		ginkgo.It("routes plain team members through the classifier and ends cleanly",
			ginkgo.FlakeAttempts(2), ginkgo.SpecTimeout(9*time.Minute),
			func(ctx ginkgo.SpecContext) {
				if !target.IsLocal() {
					ginkgo.Skip("remote target: cannot spawn with --subagent-model-router / a router taxonomy")
				}

				// The router taxonomy lives in the OPERATOR-TIER settings.yaml; write a
				// temp one and point mecated's config at it. Both categories map to real,
				// cheap OpenRouter-lane models so a routed member actually runs.
				small := envOrDefault("MECATL_E2E_ROUTER_SMALL_MODEL", "openai/gpt-4.1-mini")
				large := envOrDefault("MECATL_E2E_ROUTER_LARGE_MODEL", "openai/gpt-4.1")
				// The CLASSIFIER slot is a SEPARATE knob from the category targets: it must
				// reliably emit the one-line JSON verdict on OpenRouter, or RunModelRouter
				// gets a verdict-less turn → fail-soft miss → NO "subagent routed" line (the
				// live flake — openai/gpt-4.1-mini returned near-empty completions as the
				// classifier). Default to a cheap model that demonstrably emits the JSON
				// verdict; the category targets stay cheap (they only run the routed member).
				classifier := envOrDefault("MECATL_E2E_ROUTER_CLASSIFIER_MODEL", "google/gemini-2.5-flash")
				dir, err := os.MkdirTemp("", "mecatl-team-router-e2e-*")
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
				// closure it narrates is the one the team supervisor consults per member.
				startLog := spawn.LogTail(8192)
				gomega.Expect(startLog).To(gomega.ContainSubstring("subagent model router ACTIVE"),
					"the build-once router fact must narrate the active router"+logTail())

				// (B) Drive a Team delegation with two PLAIN (undefined) members whose
				// tasks steer toward different categories. Plain members are the routed
				// path (a member with an agent def pins its own model and is NOT routed).
				res, runErr := drv.Run(ctx, harness.RunOpts{
					Scenario: "team-router-delegation", Timeout: 7 * time.Minute,
				}, `Call the Team tool exactly once, with goal = "Produce a two-line fruit report. Worker alpha must call RecordFinding exactly once recording the word apple. Worker beta must call RecordFinding exactly once recording the word banana. The lead waits for both findings and then writes the two-line report." and members = [ {"name": "lead", "role": "Coordinate: create one task for alpha and one for beta, wait for both findings, then synthesise the two-line fruit report."}, {"name": "alpha", "role": "A trivial single-step lookup: call RecordFinding exactly once recording the word apple, then message the lead that you are done."}, {"name": "beta", "role": "A deep multi-step analysis task: call RecordFinding exactly once recording the word banana, then message the lead that you are done."} ]. Call no other tool. When the Team tool returns, reply with the single word done.`)
				gomega.Expect(runErr).NotTo(gomega.HaveOccurred(), "team router delegation transport error"+logTail())
				gomega.Expect(res.Result).NotTo(gomega.BeNil(), "team router delegation produced no terminal result"+logTail())

				// The Team call ran and the event family fired (team.start + team.end) —
				// each member was enrolled (and, being plain, classified) and the round
				// completed.
				calls := res.ToolCalls("Team")
				gomega.Expect(len(calls)).To(gomega.BeNumerically(">=", 1),
					"expected at least one Team call (the routed delegation)"+logTail())
				gomega.Expect(res.TeamMsgs(client.TeamStart)).NotTo(gomega.BeEmpty(),
					"no team.start observed — the team never enrolled its members"+logTail())
				gomega.Expect(res.TeamMsgs(client.TeamEnd)).NotTo(gomega.BeEmpty(),
					"no team.end observed — the team never completed"+logTail())

				// The run ended cleanly: each member's classifier call plus the routed
				// member runs all executed against the live provider without wedging.
				gomega.Expect(res.Stop()).To(gomega.Equal("end_turn"),
					"the run did not end cleanly (stop="+res.Stop()+") — a member classifier or a routed member may have wedged"+logTail())
				gomega.Expect(strings.TrimSpace(res.Result.Error)).To(gomega.BeEmpty(),
					"a clean routed team run carries no error"+logTail())

				// (C) Routing ACTUALLY FIRED for the team family. The shared routeTask
				// closure emits a "subagent routed" INFO (category+model) on every
				// successful classification; the supervisor routes each plain member
				// through it. Re-read the log tail AFTER res returns (these lines are
				// emitted MID-RUN per member, not at startup). Only the Team call ran here
				// (no Subagent calls), so any such line is a team-member classification.
				// >=1 is the robust floor (this run expects ~3 — lead+alpha+beta are all
				// undefined/routed); the count is not over-tightened to avoid flaking on
				// live model behaviour.
				runLog := spawn.LogTail(65536)
				gomega.Expect(runLog).To(gomega.ContainSubstring("subagent routed"),
					"expected at least one per-classification 'subagent routed' INFO from a team-member classification (routing did not fire)"+logTail())
			})
	})
}
