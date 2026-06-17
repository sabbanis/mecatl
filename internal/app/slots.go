package app

import (
	"context"
	"sort"
	"strings"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

// slots.go is the COMPOSITION-LAYER per-slot model resolver (ADR 0030, Phase 1+2):
// the "aliases as the spine" layer plus the `models.slots` map that binds named
// pipeline functions to aliases. It is a pure composition concern — engine/agent
// never sees a slot or an alias, only the already-resolved concrete model id.
//
// A SLOT is a named internal LLM call ("compaction", "ask-reviewer", "guardrail")
// or a semantic TIER ("cheap", "fast", "reasoning"). resolveSlotModel maps a slot
// name to a concrete model id THROUGH the existing alias machinery (lookupModelAlias),
// so the two never drift: a slot value is itself an alias or a literal id, resolved
// by the SAME grammar the agent-def `model:` path uses.
//
// THE BYTE-IDENTICAL GUARANTEE: when no slot is configured (cfg.ModelSlots empty/
// absent) resolveSlotModel returns ("", false) for every slot, and each of the three
// routed call sites keeps its EXACT pre-feature behaviour (the session model). The
// posture is FAIL-SOFT throughout: a typo'd slot key, an unknown/inherit alias, or
// any other miss WARNs and degrades to today's behaviour — a broken housekeeping
// slot must never wedge a compaction / ask-review / guardrail call.
//
// This slice routes exactly THREE internal lightweight calls to a slot: compaction
// (the tier-4 summary LLM call), ask-reviewer, and guardrail. Team synthesis is
// DEFERRED (it lacks a clean seam — the lead synthesis runs on the lead member's
// whole engine), and the project-tier override / the subagent router (ADR 0030
// Layer 3b and the project-merge-within-cap) are out of this slice.
//
// Phase 3 (ADR 0030 Layer 3) adds the `plan` slot — wired on the MODE axis, NOT the
// internal-call axis. Unlike the three call-slots above, `plan` does NOT route a
// lightweight housekeeping call: it re-resolves the SESSION model when the session's
// PermissionMode is ModePlan, re-resolved BETWEEN turns at the run-entry seam (the
// opusplan pattern). It reuses resolveSlotModel UNCHANGED — the resolution grammar is
// identical; only the consumer differs (the per-session engine factory in build.go,
// keyed on the session's mode, instead of a per-call deps builder). And it defaults to
// the `reasoning` tier, NOT `cheap`: a plan model is a STRONG-reasoning model, the one
// place a slot's default tier diverges from cheap.

// Slot names — the three routed internal lightweight calls (Layer 2). Each is the
// stable key an operator writes under `models.slots:` (or --model-slot).
const (
	// slotCompaction routes the CascadeCompactor's tier-4 summary LLM call.
	slotCompaction = "compaction"
	// slotAskReviewer routes the OPT-IN headless child-ask reviewer (issue #31).
	slotAskReviewer = "ask-reviewer"
	// slotGuardrail routes the LLM-backed guardrail content checker (issue #27).
	slotGuardrail = "guardrail"
	// slotSynthesis is DEFINED for completeness (team synthesis is the cheap tier's
	// natural fourth consumer) but is deliberately NOT wired this slice — the lead
	// synthesis runs on the lead member's whole engine and lacks a clean seam.
	slotSynthesis = "synthesis"
	// slotPlan routes the SESSION model when the session's PermissionMode is ModePlan
	// (ADR 0030 Layer 3, the opusplan pattern). It is the ONE slot wired on the MODE
	// axis rather than the internal-call axis: it is consumed by the per-session engine
	// factory (sessionEngineFactory in build.go), re-resolved between turns at the
	// run-entry seam when Session.Mode changes — NOT by a per-call deps builder. Its
	// default tier is `reasoning`, not `cheap` (slotDefaultTier) — a plan model is a
	// strong-reasoning model.
	slotPlan = "plan"
)

// Semantic TIER names — the alias spine (Layer 1). A slot with no explicit binding
// falls through to its default tier (slotDefaultTier), so binding `cheap` once routes
// every cheap-defaulted slot.
const (
	// slotCheap is the cheapest/fastest tier — the default for every housekeeping slot.
	slotCheap = "cheap"
	// slotFast is the low-latency mid tier.
	slotFast = "fast"
	// slotReasoning is the strong-reasoning tier.
	slotReasoning = "reasoning"
)

// knownSlotNames is the set of recognised keys (call-slots + tiers) accepted under
// `models.slots:` / --model-slot. A key outside this set is a typo (e.g. `compacton`
// or `chaep`): foldOperatorModelSlots WARNs and ignores it rather than silently
// binding a slot nobody reads. It is fail-soft validation, NOT a hard parse error —
// the strict-parse guard at the YAML layer (ModelsSection.UnmarshalYAML) rejects an
// unknown TOP key (`slotz:`), while a free-form INNER map key is validated here.
var knownSlotNames = map[string]struct{}{
	slotCompaction:  {},
	slotAskReviewer: {},
	slotGuardrail:   {},
	slotSynthesis:   {},
	slotPlan:        {},
	slotCheap:       {},
	slotFast:        {},
	slotReasoning:   {},
}

// slotDefaultTier maps a slot to the semantic tier it falls through to when it has no
// explicit binding. The three internal-call slots default to `cheap` (housekeeping
// runs on the cheapest model unless the operator says otherwise — the ADR's immediate
// token-savings win). The `plan` slot is the DELIBERATE divergence: it defaults to the
// `reasoning` tier, because a plan-mode model is a STRONG-reasoning model, not a cheap
// one (ADR 0030 Layer 3). A slot absent here has no default tier (an explicit binding
// is the only way to route it).
var slotDefaultTier = map[string]string{
	slotCompaction:  slotCheap,
	slotAskReviewer: slotCheap,
	slotGuardrail:   slotCheap,
	slotSynthesis:   slotCheap,
	slotPlan:        slotReasoning,
}

// resolveSlotModel resolves a slot name to a concrete provider model id, in the
// composition layer only (the domain/agent never sees a slot or an alias). The
// precedence, fail-soft at every miss:
//
//  1. an explicit cfg.ModelSlots[slotName] binding;
//  2. else the slot's default tier (slotDefaultTier[slotName]) when THAT tier is
//     bound in cfg.ModelSlots;
//  3. else ("", false) — NO slot configured, so the caller keeps today's EXACT
//     behaviour (the byte-identical guarantee).
//
// The chosen selector (an alias or a literal id) is resolved THROUGH the existing
// lookupModelAlias grammar — the SAME path the agent-def `model:` resolution uses,
// so the two cannot drift. A selector that is known AND resolves to a concrete id
// returns (id, true); a selector that is unknown OR resolves to inherit/"" returns
// ("", false) — FAIL-SOFT, never a wedged housekeeping call. parentModel is the
// session model the caller falls back to on a ("", false); it is accepted for
// symmetry with the other resolvers and to make the call sites read uniformly (the
// function itself never returns it).
//
// resolveSlotModel is SILENT by design (no diagnostics): it is called from the
// PER-ENGINE deps builders (engineDepsForProvider, the child factory,
// askAdjudicatorDeps, buildGuardrailsChecker — once per session AND per child), so a
// WARN here would re-fire N times for one misconfigured slot (the documented
// per-derivation-duplication trap). The one-time misconfig WARN lives in the
// build-once path instead (slotMisconfig, narrated by logSlotConfigFacts from Build).
func resolveSlotModel(cfg Config, slotName, parentModel string) (model string, configured bool) {
	_ = parentModel // the caller owns the fallback; named for call-site symmetry.
	sel := selectorForSlot(cfg, slotName)
	if sel == "" {
		return "", false // no slot configured: byte-identical default.
	}
	id, known := lookupModelAlias(cfg, sel)
	if known && id != "" {
		return id, true
	}
	return "", false // configured but unresolvable: fail-soft, degrade to inherit.
}

// selectorForSlot returns the trimmed selector a slot resolves through: the explicit
// cfg.ModelSlots[slotName] binding, else the slot's default tier binding, else "".
// It is the shared lookup behind resolveSlotModel and the build-once misconfig narration.
func selectorForSlot(cfg Config, slotName string) string {
	sel := strings.TrimSpace(cfg.ModelSlots[slotName])
	if sel == "" {
		if tier := slotDefaultTier[slotName]; tier != "" {
			sel = strings.TrimSpace(cfg.ModelSlots[tier])
		}
	}
	return sel
}

// foldOperatorModelSlots merges the OPERATOR-TIER `models:` YAML subtree (read by the
// permconfig resolver from the user-global + CLI tiers ONLY — never the project file,
// which is IGNORED with a WARN, mirroring guardrails/posture) onto cfg. It merges
// `models.slots` onto cfg.ModelSlots and `models.aliases` onto cfg.ModelAliases, with
// the CLI flags (--model-slot / --model-alias, already on cfg) WINNING over YAML
// (per-key: a CLI binding for a key is never overwritten by a YAML binding for the
// same key). A typo'd inner slot key (not in knownSlotNames) is WARNed and dropped.
// It is a no-op when no operator-tier models: block was configured. cfg is taken and
// returned by value (Build holds a local cfg).
func foldOperatorModelSlots(cfg Config) Config {
	res, ok := cfg.permResolver.(*permconfig.Resolver)
	if !ok || res == nil {
		return cfg
	}
	m := res.OperatorModelSlots()
	if m == nil {
		return cfg
	}
	// Aliases: YAML entries fill in any key the CLI did not set (CLI wins per key).
	if len(m.Aliases) > 0 {
		if cfg.ModelAliases == nil {
			cfg.ModelAliases = make(map[string]string, len(m.Aliases))
		}
		for k, v := range m.Aliases {
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			if _, cliSet := cfg.ModelAliases[k]; cliSet {
				continue // CLI --model-alias wins.
			}
			cfg.ModelAliases[k] = strings.TrimSpace(v)
		}
	}
	// Slots: same per-key CLI-wins fold, with fail-soft validation of the slot key.
	if len(m.Slots) > 0 {
		if cfg.ModelSlots == nil {
			cfg.ModelSlots = make(map[string]string, len(m.Slots))
		}
		for k, v := range m.Slots {
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			if _, known := knownSlotNames[k]; !known {
				cfg.diag().Log(context.Background(), port.LevelWarn,
					"models.slots: unknown slot key IGNORED (not a known call-slot or tier)",
					"slot", k, "known", knownSlotNamesList())
				continue
			}
			if _, cliSet := cfg.ModelSlots[k]; cliSet {
				continue // CLI --model-slot wins.
			}
			cfg.ModelSlots[k] = strings.TrimSpace(v)
		}
	}
	return cfg
}

// knownSlotNamesList renders the known slot/tier keys in a stable sorted order for
// the unknown-key WARN, so an operator who typo'd a slot sees exactly what is accepted.
func knownSlotNamesList() string {
	keys := make([]string, 0, len(knownSlotNames))
	for k := range knownSlotNames {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return strings.Join(keys, ", ")
}

// logSlotConfigFacts emits the build-once per-slot narration EXACTLY ONCE through
// cfg.diag(): an INFO "model slot ACTIVE" for each ROUTED slot that resolves, and the
// one-time WARN for each ROUTED slot that is CONFIGURED but unresolvable (selector set,
// yet it points at an unknown alias or one meaning inherit — so the slot degrades to
// the session model). It is called ONLY from Build (after the normalize block) — never
// the per-engine deps builders (the no-per-derivation-duplication rule, the same
// discipline as logBuildConfigFacts / narratePosture). resolveSlotModel itself is
// silent precisely so this is the ONE place a misconfigured slot warns (once), not N
// times across per-session/per-child engine builds. A slot that resolves keeps the
// "loop emits exactly THREE lines" invariant intact: this is a Build-level fact, not a
// loop line. When nothing is configured it logs nothing (byte-identical to pre-feature).
func logSlotConfigFacts(cfg Config) {
	if len(cfg.ModelSlots) == 0 {
		return
	}
	for _, slot := range []string{slotCompaction, slotAskReviewer, slotGuardrail, slotPlan} {
		model, ok := resolveSlotModel(cfg, slot, cfg.Model)
		// The three internal call-slots route a lightweight housekeeping call; the
		// plan slot (ADR 0030 Layer 3) instead re-resolves the SESSION model in plan
		// mode (the opusplan pattern) — narrate it distinctly so the INFO is honest.
		active := "model slot ACTIVE: this internal lightweight call runs on the slot model instead of the session model"
		if slot == slotPlan {
			active = "model slot ACTIVE: plan-mode turns run on the plan model instead of the session model (opusplan), re-resolved between turns on a mode change"
		}
		switch {
		case ok:
			cfg.diag().Log(context.Background(), port.LevelInfo, active, "slot", slot, "model", model)
		case selectorForSlot(cfg, slot) != "":
			// Configured (a selector exists) but unresolvable: WARN ONCE here so the
			// operator sees the typo at Build, while the runtime stays fail-soft.
			cfg.diag().Log(context.Background(), port.LevelWarn,
				"model slot points at an unknown alias or one meaning inherit; the slot is IGNORED and this call keeps the session model",
				"slot", slot, "selector", selectorForSlot(cfg, slot))
		}
	}
}

// modeNeedsEngine returns the composition predicate wired into
// server.Config.ModeNeedsEngine (ADR 0030 Layer 3): for a given session
// PermissionMode, does that mode resolve a model DIFFERING from the shared engine's
// model (cfg.Model)? It is true ONLY for ModePlan when the `plan` slot resolves to a
// concrete id that differs from cfg.Model — the only case where promoting a DEFAULT-FS
// session to a per-session factory engine actually changes anything.
//
// It returns NIL when no plan slot is configured (or it resolves to cfg.Model), so the
// Service never promotes a default-FS session and a mode flip is BYTE-IDENTICAL to
// pre-Phase-3 (the regression guard). The predicate is evaluated against the BUILD-TIME
// plan resolution — operator-tier config is fixed at Build, so this is sound and
// cheap (no per-call re-resolution). ModeDefault/ModeAccept always answer false (they
// keep the session model). The predicate intentionally compares against cfg.Model (the
// shared-engine model), because promotion only matters for a session that would
// otherwise ride the shared engine.
func modeNeedsEngine(cfg Config) func(mode session.PermissionMode) bool {
	planModel, configured := resolveSlotModel(cfg, slotPlan, cfg.Model)
	if !configured || planModel == "" || planModel == cfg.Model {
		// No active plan slot (or it resolves to the shared-engine model): a mode flip
		// never changes the model, so never promote — nil keeps the default-FS path
		// byte-identical.
		return nil
	}
	return func(mode session.PermissionMode) bool {
		return mode == session.ModePlan
	}
}
