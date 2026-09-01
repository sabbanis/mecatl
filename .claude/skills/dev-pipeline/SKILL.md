---
name: dev-pipeline
description: >-
  Drives substantial issue/feature work as a multi-agent pipeline:
  architect plans → separate agent implements → review panel scrutinises →
  findings loop back → commit per iteration. Use only when the user explicitly
  selects the full development pipeline. Work-item context, issue numbers,
  estimates, and exploratory questions are not implementation authorization.
  NOT for advisory questions, lightweight work, acceptance-plan orchestration,
  trivial edits, or pure-docs/config tweaks.
---

# Dev Pipeline

A disciplined approach → implement → review → iterate → commit pipeline for
non-trivial issue and feature work. The value is **separation of concerns**:
the agent that plans is not the agent that implements, and neither judges its
own work — an independent review panel does, adversarially, before anything
lands.

Run this skill only after the user explicitly selects **full development pipeline**. A work-item ID, issue body, PRD, estimate, or exploratory question supplies context; it does not authorize implementation or delegation. For advisory questions, recommend a route and stop. For small changes, use the lightweight route instead: classify complexity, give a brief plan, obtain approval, edit directly, run focused verification, then offer broader gates.

## Route and complexity gate

Before any implementation, classify the request as advisory, lightweight, full
pipeline, or acceptance-plan orchestration. Do not automatically run an
implementation subagent, panel review, QA review, or full test suite.

The full pipeline earns its ceremony on multi-file, non-obvious, or unfamiliar
work. If a change is small, route it to lightweight work rather than silently
running this skill. Pause and ask before continuing if the hand-written diff is
roughly twice its estimate or reveals unexpected complexity.

### Lightweight route (small changes)

For small or mechanical changes, do not run this pipeline. Use this sequence:

1. classify complexity and give a brief plan;
2. obtain user approval for that plan;
3. edit directly (do not spawn an implementation subagent);
4. run formatting, touched-package compilation, focused tests, required
   generation, and relevant safety checks;
5. offer, but do not automatically run, broader gates or panel/QA review.

Require E2E coverage only when focused tests cannot prove the real wiring; manual
verification is acceptable for terminal-only behavior. Prefer structural fixes
over branch-by-branch implementation and duplicated tests.

### Full pipeline

Spawn an **architect** agent (`Plan` or `software-architect`, on a high-reasoning model) to
investigate the issue and produce a concrete, file-level implementation plan.
It reads code and writes a plan — it writes **no production code**. The plan is
a **checkable artifact**: later steps verify the diff *against* it, so capture
the requirements and the intended file-level changes explicitly. **Include the
docs the change makes stale** — design notes that track the issue as
planned/deferred and must flip to *shipped*, READMEs, capability lists, help
text, log strings — as named files in the plan, so they aren't an afterthought.
Surface the plan to the user before implementing if the approach is non-obvious
or has trade-offs worth a decision.

**Size and complexity-rate every implementation task.** The architect must tag
each task with: a **diff-size band** (S = a few lines in one file; M = one or
two files, tens of lines; L = multi-file, hundreds of lines), a **complexity
rating** (mechanical = direct translation of the plan; moderate = some design
choices within the plan's bounds; tricky = load-bearing decisions the plan
under-specifies), **dependencies/ordering** (which tasks must land first), and
**single-pass vs chunked** (can one agent do it in one drive, or must it be
broken across drives/agents). The orchestrator uses this tagging to pick the
implementer path in step 2.

### 2. Implement (build + test, no commit)
Delegate the plan to a **separate implementer agent** that executes it. The rigor
that matters is **plan ≠ review**: the plan is written by a separate architect
(step 1), and the review is run by fresh-context agents that see only the diff +
the plan, never the implementer's reasoning (step 3). That independence is what
makes the review meaningful.

**Delegate as ONE unit per task.** Hand the implementer the plan + the whole
task; do NOT relay file contents through the orchestrator, and do NOT spawn one
agent per file. Chunking is by **task-dependency boundary** (one delegate per
step-1 task), never by file — "ONE unit" means one task, not the whole issue. A
chunked-L task spawns one delegate per chunk (each gets its slice of the plan +
its predecessor's landed diff), not one delegate per file.

**The implementer path in mecatl:**
- **To land edits (one task)** → a **`Subagent` with `mode: "read-write"`**. The
  child runs with Edit/Write/Bash in its own isolated force-copy fork, and on a
  clean finish its diff is **auto-merged back into this workspace** (default-on,
  no flag). Hand it the plan + the task as `prompt`. This is the blessed
  "everything through sub-agents" single-task path — the implementer's edits land
  without you writing files yourself. (On a merge conflict the call returns an
  error naming a preserved fork; review that diff with Read and apply it yourself,
  or re-delegate a narrower task — don't blindly retry.)
- **For 2+ competing/independent implementations** → a **multi-branch `Parallel`**
  (fan-out, pick a winner). Reserve `Parallel` for genuine fan-out; a single-branch
  `Parallel` still auto-merges (back-compat) but the writable `Subagent` is the
  clearer single-task verb.
- **If you cannot delegate a write-capable agent** (no writable delegation
  available, or the change is tiny and delegation is overhead) → **implement
  directly yourself**, applying the plan with your own Edit/Write. A *read-only*
  `Subagent` (the default, `mode:"read-only"`) CANNOT land edits — its worktree is
  discarded; use it only to investigate and produce code as text. If the operator
  wants everything through sub-agents and only read-only delegation is available,
  **surface that gap** — don't silently self-implement.

The implementer:
- builds and runs the project's **offline** test suite (per `CLAUDE.md`),
- **writes tests at the level the change demands** — unit tests for logic, and
  an **end-to-end test through the project's real harness** (the agent loop,
  server, or CLI entry point) when the change adds a user-reachable capability.
  Match the repo's existing e2e convention; don't stop at unit tests when the
  harness supports driving the feature end-to-end. Assertions must be
  *meaningful* — a test that stays green when the behaviour is broken is worse
  than no test,
- **updates the docs the plan flagged as stale** in the same pass — code and
  its documentation land together, not in a follow-up,
- does **NOT** commit — leaves changes in the working tree for review.

### 3. Review (optional unless selected as part of this route)

Invoke the **`panel-review`** skill only when the user explicitly requests it or
has explicitly selected this full pipeline. A QA/test review is likewise part of
this route only when the user approved the full pipeline; it is not an automatic
follow-up to implementation. Scope both to correctness and stated-requirement
gaps, not style nits or speculative hardening.

### 4. Iterate (fix confirmed findings)
Feed the **cross-confirmed, actionable** findings — from both the code panel
and the QA test-adequacy review (its must-add coverage gaps) — back to the
implementation agent to fix. Hand it the findings + the diff, not the whole
transcript. Re-run build + offline tests as the **executable done-condition** —
don't accept "looks right" without green output. Re-review if the changes were
substantial.

**Cap the loop.** Stop when the panel is clean, when remaining findings are
explicitly accepted with the user, or after ~3 iterations — whichever comes
first. If it hasn't converged by then, surface the state to the user rather
than looping indefinitely.

### 5. Commit (only with explicit authorization)

Commit only when the user explicitly requests it or explicitly selected a full
pipeline whose consent includes commits. Use explicit paths and the project's
commit trailer; never infer commit permission from implementation approval.

## Standing rules (apply throughout)

- **Respect the route boundary.** Do not silently escalate from advisory to implementation, from lightweight to full pipeline, or from focused verification to broad review/gates. Ask before crossing a boundary.
- **Pause on scope drift.** If the hand-written diff is roughly twice its estimate or reveals unexpected complexity, stop and ask whether to reclassify the work.
- **Prefer the smallest sufficient proof.** Require E2E coverage only when focused tests cannot prove the real wiring; manual verification is acceptable for terminal-only behavior.
- **Keep the change focused.** Prefer structural fixes over branch-by-branch implementation and duplicated tests. Keep comments and narrow ADRs concise and avoid repeating rationale.
- **Outward-facing GitHub writes are the user's call.** Filing or closing
  issues, opening PRs, posting comments, and similar actions always require
  confirmation. Do not infer commit permission from implementation approval.
- **Sync the docs as part of the change** when the selected route includes
  implementation; do not invent unrelated cleanup.
- **Tests are sufficient, not maximal.** Require E2E coverage only when
  focused tests cannot prove the real wiring; manual verification is acceptable
  for terminal-only behavior. Do not automatically run QA review or the full
  suite outside an explicitly selected full pipeline.
- **One purpose per Bash call.** Never bundle a destructive op (`rm`, `mv`)
  with read-only exploration; keep each approval prompt easy to reason about.
- **Stage explicit paths** — never `git add -A`.

## Notes

- Steps 1–4 are agent fan-outs; if multi-agent orchestration is available
  (the Workflow tool), the approach→implement→review→iterate sequence maps
  cleanly onto a pipeline. Otherwise drive it with sequential `Agent` calls.
- The review step is deliberately a *separate* skill (`panel-review`) so it can
  be run standalone too.
