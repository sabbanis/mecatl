# Authority attenuation — acceptance plan

**Phase:** capability — in-process delegated authority
**Status:** in-progress, 2026-08-12. Synthesized from issue #371, its handover, and the
reviewed authority algebra.
**Issue:** [stacklok/mecatl#371](https://github.com/stacklok/mecatl/issues/371).
**ADR:** [ADR-0105](../adr/0105-authority-attenuation.md).
**Accumulator branch:** `acc/authority-attenuation` (off `main`).

This plan proves local runtime attenuation, not credential issuance. Ownership answers
who may access a persisted child; authority answers what that running child may cause;
actor/definition identifies the chosen agent; workload identity identifies the process.
Caller separation supplies the first property. This plan supplies the second and binds it
to the third.

The invariant is deliberately algebraic:

```text
root authority    = compatibility root capability snapshot
child authority   = parent authority ∩ definition ceiling ∩ call tightening
resumed authority = persisted child bound ∩ current operator denies/revocations
```

v1 preserves the existing root catalog/policy/profile surface and requires no new
per-caller or tenant policy. The future enforced root equation is
`operator ceiling ∩ caller/tenant grant`; it is deliberately deferred. No term in the
implemented child/resume algebra may union with, replace, or widen an earlier term. A
named definition or model request may narrow only. The policy evaluator remains a second,
deny-dominant gate after the authority ceiling; `governance.Rule`, its scope/provenance,
and `Ask` behavior are not the durable authority value.

## Scope and constraints

- **Authority v1:** exact canonical `tool.ToolSpec.Name` values, named agent definitions,
  delegation depth, and immutable execution-mode/profile constraints. A v1 tool is
  all-or-nothing; Bash subcommands and a resource/action-family grammar are deferred.
  Every registered built-in, MCP, and delegation tool maps to its canonical name;
  missing, unknown, or differently classified mappings are excluded and denied. This
  does not create an outbound token, credential, raw claim, header, catalog pointer, or
  path locator.
- **Domain location:** `governance.Authority` is a structured immutable, session-free
  value with canonical serialization, validation, `Intersect`, `Contains`, and explicit
  empty/none behavior. `session` persists its canonical representation without a reverse
  dependency. Replacing the existing inert `session.Authority` is an intentional engine
  public-API change.
- **Enforcement point:** child authority is derived before catalog, engine, runner,
  workspace, MCP, provider, child registry, or background goroutine acquisition; the
  derived catalog omits excluded capabilities and dispatch also rejects a stale/malformed
  excluded call before permission policy could grant it.
- **Definition identity:** composition—not the filesystem adapter—adds an operator source
  and resolves `operator > explicitly configured non-operator > admitted project > user`.
  A lower-tier duplicate of an operator name is rejected/hidden with a diagnostic.
- **Persistence:** a snapshot stores only the canonical bound and resolved definition
  identity. Before #374 snapshot integrity, this protects ordinary application paths, not
  a malicious store writer. #374 will MAC this authority alongside workspace/profile.
- **No external claim:** a real deployment test proves the authenticated edge,
  composition, persistence, rehydration, and dispatch path. It does not claim that a
  remote MCP/HTTP service receives a child-specific credential or independently observes
  parent/child identity.

## Scenarios and acceptance criteria

### Scenario 1 — root authority snapshots the existing capability surface

At session creation, composition snapshots the already-effective root catalog, admitted
definition identities, delegation limit, and immutable profile. `Principal` remains
attribution and ownership data, never a grant. This compatibility root preserves current
deployments without a new policy file, survives terminal-state recovery, and is safe to
persist.

**Acceptance:**

1. **AC1.1 — Compatibility root snapshot.** A root session’s authority equals its
   already-effective composed catalog, admitted definition identities, delegation limit,
   and immutable profile. It introduces no caller/tenant policy or implicit grant, while
   making the existing root surface an explicit maximum for descendants.
   - verify: `TestAuthorityAttenuation_RootSnapshotsExistingCapabilitySurface`
2. **AC1.2 — Fail-closed value algebra.** `Authority` canonicalizes equivalent inputs;
   rejects malformed/unknown versions, fields, and canonical names; distinguishes none,
   empty, and unrestricted; and has no intersection/containment path that broadens an
   input. Monotonic/property tests cover tools, delegate names, depth, and profiles.
   - verify: `TestGovernanceAuthorityCanonicalizationAndIntersection`
3. **AC1.3 — Compatibility and legacy semantics.** A pre-v1 child snapshot with no
   authority follows the existing explicitly labeled legacy-resume behavior; it is not
   retroactively presented as an attenuated child and is outside the v1 persisted-child
   non-widening guarantee. Every new v1 child persists a bound before it can run. A future
   enforced caller/tenant mode is separately specified and not silently enabled by v1.
   - verify: `TestAuthorityAttenuation_LegacySnapshotIsExplicitlyCompatibilityOnly`
   - verify: `TestAuthorityAttenuation_NewChildPersistsBoundBeforeExecution`
4. **AC1.4 — Root enforcement and safe durability.** The root catalog/schema omits every
   capability excluded by its root ceiling, and a stale/malformed excluded root call is
   denied by authority before ordinary permission policy could allow it. Snapshot
   round-trip preserves the canonical root bound, and the *new authority and resolved
   definition-identity fields* contain no token, header, credential, raw grant claim, or
   path locator.
   - verify: `TestAuthorityAttenuation_RootCatalogAndDispatchEnforceCeiling`
   - verify: `TestAuthorityAttenuation_RootAuthorityRoundTripsWithoutSensitiveMaterial`
5. **AC1.5 — Terminal recovery.** Completed, cancelled, and failed root sessions retain
   their authority through Reopen, Interrupt, and Recover.
   - verify: `TestAuthorityAttenuation_RootAuthoritySurvivesTerminalRecovery`

### Scenario 2 — a child can only spend the parent’s authority

A parent constrained to `[Read, Grep, delegate:reviewer]` invokes a named `reviewer`
definition advertising `[Read, Grep, Bash]`. The child’s authority and exposed catalog
are `[Read, Grep]`; the definition does not manufacture `Bash`. The parent also cannot
name a definition absent from its delegate set or exceed its remaining depth.

**Acceptance:**

1. **AC2.1 — Child algebra.** Every child authority equals parent ∩ resolved definition
   ceiling ∩ explicit call tightening. A requested tool, agent, depth, mode, or profile
   outside its parent is refused or removed before child construction; no union/default
   fallback exists.
   - verify: `TestAuthorityAttenuation_ChildIsThreeWayIntersection`
2. **AC2.2 — Catalog is capability reduction, not permission grant.** Excluded tools do
   not appear in the child catalog/schema. A stale or malformed excluded tool call that
   nevertheless reaches dispatch is denied by authority before the ordinary permission
   evaluator can allow it. A remaining tool still follows existing deny/ask/allow policy.
   - verify: `TestAuthorityAttenuation_ExcludedToolIsAbsentAndDispatchDenied`
3. **AC2.3 — Delegate identity and depth attenuate.** A parent cannot select a named
   definition outside its delegate ceiling, cannot use a definition to add a delegate,
   and cannot make a child when the derived remaining depth is exhausted.
   - verify: `TestAuthorityAttenuation_DelegateAndDepthCannotWiden`
4. **AC2.4 — Immutable execution constraints attenuate.** Read-only/no-fs/isolated or
   otherwise prohibited profile constraints cannot become direct-write or a broader
   filesystem/workspace binding through `mode`, profile, fork, or any model argument.
   - verify: `TestAuthorityAttenuation_ProfileCannotEscalate`

### Scenario 3 — every delegation seam uses the same pre-acquisition derivation

The same constrained parent exercises foreground Subagent, `fork:true`, `background:true`,
direct-write Subagent, Parallel, Team lead/member, and the server `RunTeam` path. Each
path captures the derived bound before detachment/fork and before a potentially broader
handle exists. Cloned conversation/history is never authority input.

**Acceptance:**

1. **AC3.1 — Subagent variants.** Plain, named, forked, background, writable, and
   model-overridden Subagents obtain exactly the derived authority before session save,
   engine factory, runner/workspace selection, child registration, provider call, or
   goroutine start.
   - verify: `TestAuthorityAttenuation_AllSubagentVariantsDeriveBeforeAcquisition`
2. **AC3.2 — Parallel.** Every Parallel branch gets an independent derived child bound;
   neither a branch catalog nor a preserved fork can add a parent-excluded capability.
   - verify: `TestAuthorityAttenuation_ParallelBranchesCannotWiden`
3. **AC3.3 — Team.** Team-tool members and lead derive from their parent’s bound. Direct
   server-created `RunTeam` snapshots a compatibility root authority, then derives its
   lead, members, and synthesis from that root/call tightening. No team-specific default
   or shared engine bypasses either algebra.
   - verify: `TestAuthorityAttenuation_TeamLeadAndMembersCannotWiden`
   - verify: `TestAuthorityAttenuation_RunTeamDerivesCompatibilityRoot`
4. **AC3.4 — Pre-acquisition proof.** Instrumented factories/runners/workspaces/MCP and
   provider seams prove no broader resource was acquired before derivation rejects a
   widening request.
   - verify: `TestAuthorityAttenuation_WideningFailsBeforeResourceAcquisition`

### Scenario 4 — resume begins with the persisted child bound, never current definition

A read-only child is persisted, the service restarts, and its definition/default catalog
is changed to advertise `Bash`. The normal authenticated owner resumes it. The resumed
catalog stays bounded by the canonical child snapshot; a live operator deny can remove
`Grep`, but no changed definition, resume argument, or ambient configuration can add
`Bash`.

**Acceptance:**

1. **AC4.1 — Restart cannot widen.** A persisted child resumes from its stored bound,
   not a current definition/default explorer/ambient catalog. Broadened current
   definitions cannot add tools, delegates, depth, or profiles after restart.
   - verify: `TestAuthorityAttenuation_ResumeUsesPersistedChildBound`
2. **AC4.2 — Live operator tightening wins.** A current operator deny/revocation narrows
   the resumed bound; the resulting catalog and dispatch reject the revoked capability.
   There is no live operator allow path that broadens a persisted child.
   - verify: `TestAuthorityAttenuation_ResumeAppliesOperatorRevocationOnlyAsNarrowing`
3. **AC4.3 — Resume arguments cannot upgrade.** `resume:` and any new call mode/profile
   cannot replace the persisted child bound or re-home a child into direct-write/a
   different workspace.
   - verify: `TestAuthorityAttenuation_ResumeRequestCannotUpgradeAuthority`
4. **AC4.4 — Ownership remains separate.** A foreign caller or unknown child remains
   response- and side-effect-equivalent under caller separation; its authority is never
   inspected in a way that becomes an ownership oracle.
   - verify: `TestAuthorityAttenuation_ForeignResumeRemainsAbsent`
5. **AC4.5 — Persisted maximum cannot broaden.** Concurrent/stale saves cannot replace a
   newer persisted child bound, and parent-bound child identifiers prevent two parents
   with colliding tool-call IDs from overwriting each other’s authority/transcript. Live
   operator revocation is a non-persisted resume-time narrowing input; a stale save may
   not turn it into a durable grant or erase the immutable maximum.
   - verify: `TestAuthorityAttenuation_ChildBoundPersistenceIsParentBoundAndMonotonic`
   - verify: `TestAuthorityAttenuation_LiveRevocationIsNotPersistedAsGrant`

### Scenario 5 — an operator definition identity cannot be stolen by a project duplicate

An operator-owned `release-reviewer` permits `[Read, Grep, Glob]`. An admitted project
file advertises the same name plus `Bash`. The composition registry selects the operator
definition; the project duplicate is rejected/hidden with an operator diagnostic. A
non-colliding admitted-project definition retains current trust-gated behavior.

**Acceptance:**

1. **AC5.1 — Operator-first resolution.** Registry assembly uses the specified source
   order and retains the operator definition for an operator-owned collision regardless
   of a lower-tier project/user duplicate.
   - verify: `TestAuthorityAttenuation_OperatorDefinitionCannotBeShadowed`
2. **AC5.2 — Collision is visible but safe.** The lower-tier duplicate creates a concise
   diagnostic naming only definition name and source tier; it does not leak definition
   headers, credentials, paths, or raw content, and does not affect the selected catalog
   or definition ceiling.
   - verify: `TestAuthorityAttenuation_DefinitionCollisionProducesSafeDiagnostic`
3. **AC5.3 — One resolved definition feeds both decisions.** The identity/ceiling used
   to derive authority is the same resolved object used to build the child. No mutable
   second lookup can substitute a broadened definition.
   - verify: `TestAuthorityAttenuation_DefinitionResolutionIsSingleSource`

### Scenario 6 — the demonstration makes local attenuation observable without overclaiming

The offline demo uses a deterministic scripted/mock provider. It shows root
`[Read Grep delegate:reviewer]`, a reviewer advertising `[Read Grep Bash]`, the derived
child `[Read Grep]`, and normal exclusion/denial for `Bash("git status")`. After restart
and a broadened definition, the child remains `[Read Grep]`; an operator deny then
narrows it to `[Read]`. A collision trace shows the operator reviewer selected and the
project duplicate rejected.

**Acceptance:**

1. **AC6.1 — Offline journey.** `mecademo` produces the complete deterministic journey:
   derived-authority summary, absent/denied `Bash`, restart non-widening, operator live
   narrowing, and operator/project collision resolution.
   - verify: `TestMecademoAuthorityAttenuationJourney`
2. **AC6.2 — Honest projection.** The event/demo summary is concise and contains no
   credentials, headers, raw claims, or future delegation token. It identifies this as
   local runtime attenuation and does not claim remote service delegated identity.
   - verify: `TestAuthorityAttenuation_DemoProjectionIsSafeAndHonest`

### Scenario 7 — a deployed journey proves the real service and persistence path

A real mecak8s kind deployment authenticates through the existing in-cluster Dex/OIDC
fixture, uses its Redis StatefulSet, and drives deterministic scripted/mock LLM behavior
through real HTTP/gRPC ingress. A server/pod restart occurs between child creation and
resume. These are integration proofs run by `task e2e:k8s`, not in-process tests that
reuse the scenario names. The fixture extends caller-separation’s cluster work rather
than creating a second harness, authenticates ownership through Dex/OIDC, and configures
the ordinary root catalog/profile plus operator definition source; it adds no caller or
tenant authority policy.

**Acceptance:**

1. **AC7.1 — Deployed collision and spawn.** The authenticated root uses its ordinary
   configured `[Read, Grep, Glob, Subagent]` catalog and `release-reviewer`. A same-name
   project definition advertising `Bash` loses to the operator definition. The actual
   child schema/catalog lacks `Bash`, and a scripted attempt cannot execute it.
   - verify: `TestAuthorityAttenuation_DeploymentCollisionAndSpawnJourney` under `task e2e:k8s`
2. **AC7.2 — Deployed restart/resume.** Redis persists the child’s `[Read, Grep, Glob]`
   bound. After server restart and a broadened project/current definition, authenticated
   resume preserves the bound; an operator deny of `Grep` further narrows it to
   `[Read, Glob]`.
   - verify: `TestAuthorityAttenuation_DeploymentRestartResumeJourney` under `task e2e:k8s`
3. **AC7.3 — Boundary honesty.** The deployment report asserts local catalog/dispatch
   attenuation only; it does not assert an external MCP/HTTP service saw a child-specific
   credential, proof of possession, or independently verifiable delegation chain.
   - verify: `TestAuthorityAttenuation_DeploymentClaimsAreBounded`

## Out of scope

| Item | Deferred to |
|---|---|
| Token exchange, holder keys, audience-bound artifacts, external gateway enforcement | outbound identity/broker work |
| A broad `authorization_details` grammar, wildcard resource language, or `governance.Rule` reuse | future authority-policy design |
| A caller/tenant grant resolver and enforced root algebra (`operator ceiling ∩ caller grant`) | future caller/tenant authority phase |
| Workload/SPIFFE identity for pod/broker authentication | workload identity deployment work |
| Store-side tamper detection for authority/workspace/profile | #374 snapshot integrity |
| A live paid-model test | never; the journeys use deterministic mock/scripted LLM behavior |

## Sequencing recommendation

1. Implement and test `governance.Authority`, including serialization and monotonic
   algebra; update engine API surface and changelog deliberately.
2. Add compatibility-root snapshotting plus safe session/snapshot persistence.
3. Make operator-first definition assembly and one resolved-definition path.
4. Route a pre-acquisition derived bound through Subagent variants, then Parallel and
   both Team paths; filter catalog and add the dispatch backstop.
5. Implement persisted-child resume plus live operator narrowing and parent-bound
   persistence conflict protection.
6. Add the offline journey, then the real ingress/OIDC/Redis/restart journey; update
   architecture, usage, public user documentation, generated `llms.txt`, and the ADR.

## Definition of done

1. `task lint`, `task test`, and `task api:check` pass.
2. The intentional exported-engine change is recorded via `task api:update` and
   `engine/CHANGELOG.md` according to `engine/COMPATIBILITY.md`.
3. `task docs` regenerates `llms.txt` and passes the strict documentation check; changed
   user-facing behavior is covered in `user-docs/` and `task site:build` passes.
4. Every named acceptance proof is implemented, grep-locatable, and resolved by
   `task ac-trace-strict` when this plan is landed.
5. The offline demo and deterministic deployed journey pass without a live LLM or
   external token/credential assertion.
6. `/panel-review` reports no unaddressed ship blocker.

## Decision checkpoint

This is ready for `/plan-orchestrate authority-attenuation` once ADR 0105’s exact v1
vocabulary and compatibility-root migration behavior are approved. The implementation
must not substitute owner, actor, workload, or permission-rule semantics for the
authority ceiling described here.
