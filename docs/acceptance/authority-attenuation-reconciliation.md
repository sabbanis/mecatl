# Authority attenuation on current main — acceptance plan

**Phase:** capability — in-process delegated authority
**Status:** draft, 2026-08-12. Successor to the pre-main-reconciliation authority draft.
**Issue:** [stacklok/mecatl#371](https://github.com/stacklok/mecatl/issues/371).
**ADR:** [ADR-0224](../adr/0224-authority-attenuation-on-current-main.md) — immutable local capability maxima for roots and delegation.
**Accumulator branch:** `acc/authority-attenuation-reconciliation` (off `main`).

This plan ports the authority model and its observable safety properties onto current `main`; it does not transplant the old patch. A session owner answers who may load a session. Its authority maximum answers which local harness capabilities that session and its descendants may use. The two checks stay separate and owner/lineage authorization happens before authority parsing, so malformed authority is not an ownership oracle.

A bound root snapshots its admitted capability surface. Every bound child derives only by narrowing:

```text
child maximum = parent maximum
              ∩ resolved definition ceiling
              ∩ call execution tightening
              ∩ live operator revocations
```

The persistent maximum never widens during supported creation, fork, recovery, rebuild, or resume paths. Live revocations are transient intersections, not saved replacements. Pre-feature records deliberately remain legacy under the adopted rollout posture; a claimed v1 record that lacks a valid bound fails closed.

## Why these scope cuts

- [ADR-0224](../adr/0224-authority-attenuation-on-current-main.md) — authority is local runtime attenuation, distinct from owner identity, credentials, and external authorization.
- [ADR-0214](../adr/0214-environment-persistence.md) — durable `EnvironmentRef` selects an execution environment; authority constrains compatible environment kind and execution posture before acquisition, but does not authenticate a local filesystem path.
- [ADR-0038](../adr/0038-event-sourced-rehydration.md) — an event fold needs explicit creation metadata for facts events do not carry.

## In scope — 7 scenarios, in implementation order

### Scenario 1 — a new root persists one canonical maximum

A client creates a new session from the current composed catalog and environment. The server records a single canonical authority maximum before the session can run. Session ownership remains a separate caller-separation decision, as described by [`architecture.md`](../architecture.md) and [ADR-0224](../adr/0224-authority-attenuation-on-current-main.md).

**Acceptance:**

- AC1.1: A newly created bound session persists one canonical authority value, version/provenance, and any safe resolved-definition identity before its first runnable state; no second authority representation can diverge from it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_NewRootPersistsCanonicalMaximum`
- AC1.2: The root maximum contains only canonical capability names and an execution profile that can restrict environment kind, filesystem, shell, direct write, isolation, delegation identities, and delegation depth; it contains no path, credential, token, header, catalog pointer, raw claim, or runner.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_CanonicalValueExcludesSensitiveRuntimeData`
- AC1.3: A malformed, unknown, or claimed-v1-but-missing authority bound is rejected before a run starts; a genuinely pre-feature record with no version and no bound is explicitly classified legacy.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_ClaimedV1MissingBoundFailsClosed`
- AC1.4: Completed, cancelled, and failed bound sessions retain the same persisted maximum through Reopen, Interrupt, and Recover.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_TerminalRecoveryPreservesMaximum`

---

### Scenario 2 — run entry cannot widen a bound root

A resumed session may rebuild its engine for provider, model, mode, learned-skill, or catalog changes. Its persisted maximum remains the ceiling, while an operator can transiently revoke capabilities. This follows the provider-fixed and rehydration rules in [`AGENTS.md`](../../AGENTS.md).

**Acceptance:**

- AC2.1: A rebuilt or rehydrated bound session exposes only `current composed catalog ∩ persisted maximum ∩ live revocations`; a newly published or learned tool is absent unless it was in the original maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_RebuildCannotGrantNewTool`
- AC2.2: A live operator revocation is rechecked before capability disclosure, ToolSearch hydration, and dispatch. It denies a queued/unstarted delegated call and removes the capability from a rebuilt catalog, but does not claim to cancel a tool already executing; it never replaces the persisted maximum with the transient narrowed value.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_LiveRevocationRecheckedBeforeDispatch`
- AC2.3: A legacy session retains the documented legacy behavior, while every v1 malformed record is rejected rather than reclassified as legacy.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_LegacyAndMalformedRecordsStayDistinct`
- AC2.4: The feature makes no compare-and-swap or malicious-store-writer claim; ordinary aggregate, creation, recovery, rebuild, and resume paths are the bounded guarantee.
  - verify: inspection — store-level stale-writer protection is explicitly deferred by ADR-0224

---

### Scenario 3 — authority constrains the actual execution environment before acquisition

The engine executes through immutable `tool.Environment`, whose `EnvironmentRef` identifies a durable environment. Authority checks static request/profile metadata first, derives the bound, and only then resolves or forks an environment, runner, provider, MCP manager, or child registry entry. [ADR-0214](../adr/0214-environment-persistence.md) supplies the environment persistence model.

**Acceptance:**

- AC3.1: A child request may use pure configuration resolution to identify a definition, provider/model selector, and static profile, but no provider, environment, command runner, MCP manager, background slot, or child registry entry is acquired until the final authority is derived.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_DerivesBeforeRuntimeAcquisition`
- AC3.2: A no-fs or shell-less selected environment cannot acquire filesystem or Bash capability through a child argument, model override, resume, or catalog rebuild.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_EnvironmentPostureCannotWiden`
- AC3.3: A read-only call persists direct-write disabled, so a later resume cannot turn that child into a direct-write child; `fork:true` copies conversation history and is not treated as execution isolation.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable`
- AC3.4: A persisted `EnvironmentRef` mismatch or incompatible authority profile is rejected before `EnvironmentResolver` or an environment forker acquires the resource.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_RejectsEnvironmentMismatchBeforeResolve`

---

### Scenario 4 — a derived child has only its parent’s capabilities

A bound parent invokes a managed `reviewer` definition that requests a broader tool set. The child is built from the three-way intersection and enforcement projects both advertised and callable surfaces. [`architecture.md`](../architecture.md) places `tool` in the domain and `engine/agent` in the application layer; the [`AGENTS.md` layering rule](../../AGENTS.md) prevents adapters from leaking into that derivation.

**Acceptance:**

- AC4.1: A child maximum equals parent maximum ∩ managed definition ceiling ∩ call execution tightening; a definition, model, profile, or requested tool cannot add a capability absent from the parent.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ChildIsMonotonicIntersection`
- AC4.2: An excluded or unrecognized capability is absent from advertised specs, lookup, dispatch, and progressive ToolSearch hydration; a stale or forged excluded call receives an authority denial before ordinary permission policy could allow it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ExcludedOrUnknownToolCannotBeDisclosedOrDispatched`
- AC4.3: A child cannot select a definition outside its admitted identities or exceed the remaining delegation depth.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_DefinitionAndDepthCannotWiden`
- AC4.4: Run-scoped protocol tools are available only when their exact name is authorized; an arbitrary `ExtraTools` entry cannot bypass the maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ExtraToolsRequireExactAuthorization`

---

### Scenario 5 — managed local definitions narrow children without making remote drivers managed

An operator places a definition with an optional `authority:` ceiling in the managed local definition directory. The same optional data crosses the agent-definition source interfaces without losing nil/present-empty/malformed distinctions. An ordinary remote driver remains `driver` provenance and cannot establish a managed authority ceiling. This keeps trust/provenance choices in composition, consistent with [`architecture.md`](../architecture.md).

**Acceptance:**

- AC5.1: A local operator-managed definition can narrow a named child, and the resolved definition identity is persisted as safe tier/name data rather than a path or secret-shaped field.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_ManagedLocalDefinitionNarrowsChild`
- AC5.2: Missing, present-empty, malformed, and valid `authority:` frontmatter remain distinct through discovery and source transport; malformed managed input does not silently become unrestricted.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_DefinitionCeilingPresenceIsPreserved`
- AC5.3: An ordinary remote driver definition retains `driver` provenance and its authority field cannot establish a managed ceiling; no project-trust setting promotes it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged`
- AC5.4: The optional agent-definition driver protocol field round-trips only the declared ceiling data.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_DriverCeilingRoundTrips`

---

### Scenario 6 — every delegation and fork path preserves the maximum

Subagent, Parallel, and Team-tool children derive before resource acquisition. A session-backed Team inherits the parent maximum. Direct server-created teams remain process-bound and non-resumable. A peer `ForkSession` branches the same bounded work and copies the source maximum. These paths preserve the delegation and owner-isolation rules in [`architecture.md`](../architecture.md).

**Acceptance:**

- AC6.1: Fresh, background, resumed, named, model-overridden, direct-write, and fork-history Subagent paths derive the same non-widening bound before child construction.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario6_SubagentVariantsCannotWiden`
- AC6.2: Parallel branches and Team-tool lead/member/synthesis runs derive from their parent maximum and cannot disclose or execute excluded tools.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario6_ParallelAndTeamCannotWiden`
- AC6.3: Direct server-created teams are explicitly process-bound and start with a zero-capability maximum: their live lead/member/synthesis catalogs neither disclose nor execute ordinary tools. A restart does not re-snapshot authority or resume them with the current catalog.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario6_DirectTeamsHaveZeroCapabilitiesAndAreNotResumable`
- AC6.4: `Service.ForkSession` authorizes the source owner before parsing or copying source authority. An admitted peer fork copies the source authority version, maximum, safe definition identity, owner, and applicable environment semantics; it never derives a fresh maximum from the current catalog.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario6_PeerForkAuthorizesBeforeCopyingSourceMaximum`

---

### Scenario 7 — persistence and event reconstruction preserve provenance honestly

Snapshot restoration restores a valid v1 maximum exactly. Event-stream reconstruction has no implicit creation event, so it distinguishes an explicitly legacy record from a v1 record with supplied authority metadata. [ADR-0038](../adr/0038-event-sourced-rehydration.md) defines the event-fold boundary.

**Acceptance:**

- AC7.1: Snapshot round-trip preserves authority version, canonical maximum, safe definition identity, owner, lineage, `EnvironmentRef`, and terminal state without introducing a second authority source of truth.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_SnapshotRoundTripPreservesBound`
- AC7.2: Event-only reconstruction of an explicitly legacy record remains legacy; supplied valid v1 creation metadata restores the exact maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldRespectsExplicitProvenance`
- AC7.3: An event host that claims v1 authority but omits or corrupts its authority metadata cannot fold the session as legacy or resume it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldClaimedV1FailsClosed`
- AC7.4: Caller ownership and parent-lineage authorization runs before authority parsing on child resume, so a foreign malformed child handle is absence-shaped rather than an authority-format oracle.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_OwnershipPrecedesAuthorityParsing`

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| External credentials, downstream token exchange, and gateway-visible agent identity | future identity integration | ADR-0224 |
| Authority scopes below exact tool names, including Bash subcommands and resource/action grammars | future authority vocabulary | ADR-0224 |
| CAS, storage MACs, or protection against direct/malicious snapshot mutation | cloud-native persistence work | ADR-0224 |
| A trusted remote managed-agent source | dedicated operator-control-plane feature | ADR-0224 |
| Durable direct server-created teams | dedicated direct-team persistence design | ADR-0224 |
| Explicit session reauthorization to add newly learned/published tools | future authority-management API | ADR-0224 |
| A new-root API that carries prior session history | future session-creation design | ADR-0224 |

## Sequencing recommendation

First define the canonical session-owned maximum and persistence provenance. Then split pure capability-description resolution from runtime acquisition and constrain the run-local catalog, ToolSearch, lookup, and dispatch. Add the managed local definition lane and its protocol mapping before covering all delegation variants. Finish with fork, event-fold, ownership-order, documentation, and compatibility proofs. Do not widen a core public API without updating its guarded API contract and `engine/CHANGELOG.md`.

## Named tests landing in this plan

- `TestADR_0224_AuthorityAttenuation_Scenario1_NewRootPersistsCanonicalMaximum`
- `TestADR_0224_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable`
- `TestADR_0224_AuthorityAttenuation_Scenario4_ExcludedOrUnknownToolCannotBeDisclosedOrDispatched`
- `TestADR_0224_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged`
- `TestADR_0224_AuthorityAttenuation_Scenario6_PeerForkAuthorizesBeforeCopyingSourceMaximum`
- `TestADR_0224_AuthorityAttenuation_Scenario7_OwnershipPrecedesAuthorityParsing`

## Definition of done

1. `task lint` and `task test` pass.
2. `task docs` regenerates `llms.txt` and passes the strict documentation gate.
3. `task api:check` passes; any intentional engine public API change has updated `engine/api/*.txt` and an `engine/CHANGELOG.md` note.
4. `task ac-trace-strict` resolves every acceptance proof once this plan is landed.
5. The named scenario tests pass offline with reference adapters; no test calls a live provider or network service.
6. `go run ./cmd/mecademo` still prints a complete offline session.

## Deferred decisions and known risks

- **Legacy sessions remain a temporary dual-regime rollout posture.** A future migration/removal decision must make authority uniform without treating a malformed v1 record as legacy.
- **Local workspace identity is not part of authority.** Workspace and `EnvironmentRef` select the resource; snapshot integrity is deferred.
- **Pure resolution needs a precise boundary.** A network-backed lookup may not be presented as pure if it acquires a runtime child resource.
- **Current tool inventory must be audited during implementation.** New built-ins, MCP tools, and dynamic protocol tools are excluded unless the canonical descriptor explicitly admits them.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, this plan is satisfied.
