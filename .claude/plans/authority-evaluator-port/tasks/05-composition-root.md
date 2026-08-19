---
id: 05-composition-root
title: Mint complete roots and select evaluator posture
blocked_by: [04-delegation-derivation]
status: pending
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-evaluator-port
---

# Task brief

Compose a complete usable root authority set from the resolved catalog and wire
the evaluator deployment mode explicitly. The normal composition path must
support default and managed Subagent, Parallel, Team, server-created team, peer
fork, and scheduled fire derivation. Add explicit operator flag/config selection
for an absent/noop evaluator and active local evaluator, with a build-once
posture line. Preserve the engine module boundary. Do not add Cedar; task 06
owns that adapter.

## Acceptance criteria

- AC3.4: An absent evaluator is a deliberate deployment mode selected by an explicit flag and reported in the build-once posture line; it is never a silent default.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario3_AbsentEvaluatorIsExplicitAndAnnounced`
- AC6.1: A session created through the ordinary composition path can spawn a default read-only subagent, a named managed specialist, a Parallel branch, and a Team, and each child receives a non-empty derived set.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario6_ComposedRootCanDelegateOnEverySeam`
- AC6.2: Every field of a minted root set is populated explicitly at the mint site, and the minted root can consume one delegation hop.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario6_MintPopulatesEveryFieldExplicitly`, `TestADR_0228_AuthorityEvaluator_Scenario6_MintedRootCanDescend`
- AC6.3: A server-created team, a peer fork, and a scheduled fire each receive a set whose provenance is recorded and whose derivation point is documented; a fork copies its source's set and safe provenance without re-deriving.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario6_NonSpawnDerivationPointsAreExplicit`
- AC6.4: The composition posture line reports which evaluator adapter is active and whether enforcement is on.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario6_PostureLineReportsEvaluator`
