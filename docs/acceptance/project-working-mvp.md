# Project working MVP — acceptance plan

**Phase:** working-source-only Projects for Studio and mecatui  
**Status:** in-progress  
**Issue:** [stacklok/mecatl#620](https://github.com/stacklok/mecatl/issues/620)  
**ADR:** [ADR-0230](../adr/0230-project-working-and-reference-folders.md) — one working source, captured Session bindings, opaque source identity, and independently paged navigation.  
**External Studio evidence:** pending — replace with the Studio commit and green workflow URL before `landed`.

The smallest end-to-end slice that lets Studio and mecatui manage Projects and open durable
Sessions inside them. This phase deliberately makes a Project useful as a server-owned working
context and Session grouping before adding read-only references. It proves one complete
path: discover a safe working source, create and update a Project, create a Session from
it without sending a host path, list that Project's Sessions, and continue the Session
after Project edits or server restart.

## Why these scope cuts

- [ADR-0230](../adr/0230-project-working-and-reference-folders.md) keeps one honest
  `tool.Environment`; this plan does not build a writable union or make a reference into
  another Workspace.
- The first source registry exposes only the daemon's canonical launch root, and this
  capability is enabled only in the existing ownerless single-trusted-domain posture.
  That gives local Studio a complete path-free Project workflow without pretending that
  caller-owned metadata isolates multiple callers sharing one writable filesystem. Alternate
  roots and ownership-enforced deployments require an explicit source-audience policy and
  are the next working-source slice.
- References are omitted from the MVP request contract. Reference management, the shared
  broker, both reference tools, bounds, fencing, audit, and delegation propagation must
  land together later; this phase does not accept inert reference data that the agent
  cannot use.
- Project state remains above the loop, as required by ADR-0230. The loop receives an
  already-resolved Environment and does not gain a Project store dependency.
- Studio is an external client and owns its browser workflow test. Mecatui is the in-repo
  reference client and manual acceptance surface: its `/projects` UI must exercise the same
  generated gRPC contract without exposing protobuf types to `cmd/mecatui/ui`. The server's
  HTTP journey remains independently covered for transport parity.

## MVP contract decisions

These decisions close the implementation ambiguities needed for a fast first slice:

- A Project has `ID`, server-derived `Owner`, bounded `Name`, one required captured working
  source (`SourceRef` plus server-derived label), integer `Revision`, `CreatedAt`, and
  `UpdatedAt`. It has no public references field in this phase.
- Names are trimmed, valid UTF-8, contain no control characters, and contain 1–120 runes.
  Names need not be unique. Source labels are registry-owned and use the same display bound.
- Revisions start at 1. Whole-document Replace and Delete require the current revision.
  Every successful Replace increments it once; stale mutations conflict and change nothing.
  There is no PATCH, archive, restore, or collaborative membership.
- Project listing is owner-filtered and ordered by `(updated_at DESC, project_id ASC)` using
  an opaque keyset cursor. The server default is 50 rows and the hard maximum is 200.
  Pages are weakly consistent under concurrent mutation: each request has a correct filtered
  count and deterministic order, but a replaced row may move between pages.
- The source-registry contract is deployment-neutral and each built registry is immutable for
  its process lifetime: each adapter binds an opaque `SourceRef` to a private, stable
  authority identity and resolves it to a complete Environment without exposing its locator.
  For the local canonical-root adapter only, the ID is the base64url digest of a domain-separated SHA-256 over the physically canonical
  launch root. That local ID is stable across restart at the same binding, carries no path,
  and changes when the authority-defining root changes. Other deployments may mint identity
  from operator configuration; ordinary Kubernetes replica or mount-path changes must not
  change a SourceRef for the same backing authority. Labels may change without changing the
  ID, while Projects and Sessions retain the label they captured.
- The Project-store seam is backend-neutral and specifies create-only persistence, load,
  store-atomic revision CAS for Replace/Delete, owner-filtered keyset paging, and typed
  absence/conflict/unsupported errors. Files, directories, flock, and atomic rename are
  details of the local adapter; Redis transactions and remote drivers can satisfy the same
  contract without changing Project or transport semantics.
- The MVP is available only for `mecated --store-dir` in the ownerless single-trusted-domain
  posture. It stores Projects beneath that state root using confined files, cross-process
  locking, atomic replacement, and store-level revision CAS. The in-memory adapter is a
  conformance-test reference only. In-memory, Redis, remote-driver, mecak8s, and
  ownership-enforced deployments advertise Projects as unavailable in this phase; they do
  not silently create process-local Project state. Temporary Project-store failure fails
  Project operations but does not block an already-captured Session whose source still
  resolves.
- Stale revision maps to gRPC `ABORTED` and HTTP `409`. Missing and foreign-owned Projects
  are indistinguishable (`NOT_FOUND` / `404`). A malformed source ID is invalid argument;
  a captured source that is no longer registered is failed precondition.
- `GetServerCapabilities` / `GET /v1/capabilities` is the standalone, session-free
  bootstrap surface. `projects=true` means a Project store, at least one authorized working
  source, and the Project Session resolver/factory were all wired successfully at Build
  time. Capability is derived from those seams, never from a permanent backend-name
  allowlist; it is not a live health signal and does not flap on transient store/source
  faults. An older server returns unimplemented/404 and Studio treats Projects as
  unavailable. `ListProjectSources` / `GET /v1/project-sources` is a bounded, locator-free
  inventory and is likewise unavailable when the Project capability is false.
- `CreateSessionFromProject` is the only Project-backed creation surface. It accepts a
  Project ID plus the existing mode, limits, provider, model, and reasoning-effort choices.
  It accepts no workspace, profile, `SourceRef`, EnvironmentRef, or carryover session.
- The successful, authorized revisioned Project load is Session creation's linearization
  point. Creation captures that complete document once and performs no second live-Project
  check; a concurrent later Replace/Delete affects future Sessions only.

## In scope — 6 scenarios, in implementation order

### Scenario 1 — Studio discovers a safe source and manages a durable Project

Studio detects Project support, discovers the canonical working source, creates a Project,
reads it, replaces it with revision checking, pages its Projects, and deletes it. This follows
[ADR-0230 decisions 1–2](../adr/0230-project-working-and-reference-folders.md) and the
existing caller-ownership decision in [ADR-0212](../adr/0212-caller-ownership-enforcement.md).

**Acceptance:**

- AC1.1: session-free `GetServerCapabilities` and `GET /v1/capabilities` advertise Projects only when the Project-store, authorized-working-source, and Project-Session factory/resolver seams are all wired. The first implementation satisfies that only for an ownerless `mecated --store-dir` deployment with the canonical source; capability means Build-time configuration, not transient health. Older/unimplemented, in-memory, Redis, driver, mecak8s, and ownership-enforced deployments remain Project-disabled while their ordinary APIs stay usable, without hard-coding those backend names into the capability decision.
  - verify: `TestProjectWorkingMVP_Scenario1_CapabilityBootstrapMatrix`
- AC1.2: bounded source discovery returns only server-minted opaque IDs, bounded labels, and working eligibility. Public responses and model-visible values contain no physical path, URI, endpoint, EnvironmentRef, environment value, or credential; operator diagnostics may name a scrubbed physical failure under ADR-0230 but never credentials.
  - verify: `TestInvariant_project_source_discovery_is_locator_free`
- AC1.3: Create derives Owner from context and the working label from the registry, rejects invalid names and unknown/non-working source IDs, starts at revision 1, and permits multiple ownerless Projects to use the same canonical source; the endpoint is unavailable rather than sharing that writable source when ownership enforcement is active.
  - verify: `TestProjectWorkingMVP_Scenario1_CreateValidatedServerOwnedFields`
- AC1.4: Get, List, Replace, and Delete apply ownership before lookup, cursor formation, and counts; a foreign ID is absence-shaped and no-auth deployments retain one ownerless trusted domain.
  - verify: `TestInvariant_project_access_is_caller_separated`
- AC1.5: Replace is a whole-document CAS; two concurrent replacements at one revision yield exactly one success, one `ABORTED`/`409`, one revision increment, and no field from the losing write.
  - verify: `TestProjectWorkingMVP_Scenario1_ReplaceCAS`
- AC1.6: Delete requires the current revision, stale Delete changes nothing, and successful Delete removes only the Project document—not its registered source or Sessions.
  - verify: `TestProjectWorkingMVP_Scenario1_DeleteCASNonCascading`
- AC1.7: owner-filtered Project pages are bounded and deterministically keyset-ordered, return an opaque cursor, and compute count from the filtered set before page formation. Concurrent mutation is explicitly weakly consistent: each response is correct at query time, while a moved row may repeat or be skipped across requests.
  - verify: `TestProjectWorkingMVP_Scenario1_BoundedProjectPagination`
- AC1.8: the in-memory and durable local adapters pass one shared Project-store conformance suite for create-only, load, store-level CAS replace/delete, ownership queries, pagination, and cancellation. Durable-adapter-only proofs additionally cover cross-process contention, interrupted atomic writes, corrupt/truncated records, and reopen durability.
  - verify: `TestProjectWorkingMVP_Scenario1_ProjectStoreConformance`

---

### Scenario 2 — Studio creates an honest Session from one Project revision

Studio opens a Project and creates a Session without selecting a host path. The server
resolves the Project's source and publishes no Session resources until the fully-labelled
aggregate is durable. This implements [ADR-0230 decision 4](../adr/0230-project-working-and-reference-folders.md)
and preserves the execution-environment seams in [ADR-0211](../adr/0211-execution-environment-runtime-seam.md)
and [ADR-0214](../adr/0214-environment-persistence.md).

**Acceptance:**

- AC2.1: gRPC `CreateSessionFromProject` and `POST /v1/projects/{project_id}/sessions` accept only Project ID plus mode/limits/provider/model/reasoning choices; their wire shapes contain no workspace, profile, source, EnvironmentRef, path, reference, or carryover selector.
  - verify: `TestInvariant_project_session_creation_has_no_client_environment_selector`
- AC2.2: the successful authorized Project load is the linearization point: creation revalidates that captured revision's source, resolves one complete Environment, and captures one internally consistent binding. A later concurrent Replace/Delete does not invalidate that capture; creation never mixes fields or performs a second mutable-Project read.
  - verify: `TestProjectWorkingMVP_Scenario2_AtomicProjectCapture`
- AC2.3: before returning success, the Session snapshot contains matching owner, Project ID, name at creation, Project revision, working SourceRef, label at creation, exact EnvironmentRef, an explicitly empty internal References list, and the legacy workspace projection required by existing APIs; it registers no reference tools, and no path or backend locator appears in Project provenance.
  - verify: `TestProjectWorkingMVP_Scenario2_DurableCapturedBinding`
- AC2.4: unknown, forged, ineligible, or removed SourceRefs fail closed without redirect or launch-root fallback; Project authorization—not knowledge of a source ID—grants creation access.
  - verify: `TestInvariant_project_source_ref_is_not_authority`
- AC2.5: injected lookup, resolution, engine-build, Session-save, and registration failures leave no persisted Session, engine entry, environment override, runner, closer, or other per-session resource.
  - verify: `TestProjectWorkingMVP_Scenario2_FailureRollback`
- AC2.6: the existing workspace/profile `CreateSession` request and behavior remain compatible and cannot stamp Project provenance.
  - verify: `TestProjectWorkingMVP_Scenario2_LegacyCreateUnchanged`

---

### Scenario 3 — Captured Project Sessions stay honest across edits, forks, and restart

A caller renames, replaces, or deletes a Project after creating a Session. The old Session
keeps its creation-time association and exact working environment. Restart and fork use the
captured binding rather than rereading the live Project, as required by
[ADR-0230 decision 5](../adr/0230-project-working-and-reference-folders.md).

**Acceptance:**

- AC3.1: Project rename or replacement changes only future Session captures. The existing Session's internal aggregate retains the full creation-time binding, while public compact inventory retains only Project ID, Project name at creation, and working label at creation; no public detail surface exposes SourceRef or EnvironmentRef.
  - verify: `TestProjectWorkingMVP_Scenario3_ProjectEditsAreProspective`
- AC3.2: deleting a Project prevents new Project Sessions but does not delete, hide, rebind, rename, or make unusable an existing captured Session.
  - verify: `TestProjectWorkingMVP_Scenario3_ProjectDeletePreservesSessions`
- AC3.3: every Project Session run entry first validates the captured working SourceRef against the rebuilt Project source registry, then reattaches the persisted EnvironmentRef through the ordinary resolver. After a real service rebuild at the same canonical root, the exact compatible EnvironmentRef is restored without deriving a replacement, consulting the mutable/deleted Project document, or silently falling back.
  - verify: `TestInvariant_project_session_restart_uses_captured_binding`
- AC3.4: rebuilding with a different/absent canonical registration changes/removes the deterministic SourceRef, so the captured Session fails with failed precondition before model/tool execution; rebuilding again with the exact original canonical binding restores use without rewriting the snapshot. Same-process source removal is outside the immutable-registry MVP.
  - verify: `TestProjectWorkingMVP_Scenario3_SourceRevocationFailsClosed`
- AC3.5: `ForkSession` inherits the source Session's exact captured Project binding and EnvironmentRef without rereading the current Project, while ordinary non-Project forks remain unchanged.
  - verify: `TestProjectWorkingMVP_Scenario3_ForkInheritsCapturedBinding`
- AC3.6: pre-Project snapshots and event-source metadata decode with empty Project provenance and continue through their existing workspace/environment path.
  - verify: `TestProjectWorkingMVP_Scenario3_LegacySnapshotCompatibility`

---

### Scenario 4 — Project navigation is bounded and storage-filtered

Studio opens one Project and lazily requests only its Session children. Project roots and
Session pages remain independent; the server never assembles a complete tree. This implements
[ADR-0230 decision 9](../adr/0230-project-working-and-reference-folders.md).

**Acceptance:**

- AC4.1: bounded Session metadata requests accept one optional exact Project ID. A foreign, missing, or deleted live Project filter returns the same NotFound shape before querying Sessions; an authorized live Project applies ownership and Project filtering in the storage query before sort, cursor, limit, and total-count computation.
  - verify: `TestInvariant_project_session_filter_precedes_paging`
- AC4.2: a metadata backend that cannot perform Project-filtered paging reports unsupported; it never loads full Session snapshots or filters an already-formed global page. Scanning bounded compact metadata before forming the filtered page is allowed in v1.
  - verify: `TestProjectWorkingMVP_Scenario4_UnsupportedPagerFailsHonestly`
- AC4.3: compact Session inventory exposes only Project ID, Project name at creation, and working label at creation; the full binding, SourceRef, EnvironmentRef, owner internals, and physical locator remain absent.
  - verify: `TestProjectWorkingMVP_Scenario4_CompactProvenanceProjection`
- AC4.4: Project-filtered conformance places matching rows beyond an unfiltered first page and proves every returned row matches owner/Project, filtered total/count and cursor are correct, no matching row is skipped, and a cursor is bound to its original Project filter. Unassigned legacy Sessions appear only in ordinary inventory.
  - verify: `TestProjectWorkingMVP_Scenario4_FilteredSessionPagerConformance`
- AC4.5: after Project deletion, the Project is absent from Project pages while its captured Sessions remain visible in ordinary Session history with creation-time compact provenance.
  - verify: `TestProjectWorkingMVP_Scenario4_DeletedProjectHistory`

---

### Scenario 5 — The generated client contract supports Studio's complete MVP flow

A Studio-compatible client bootstraps without first creating a legacy path-bearing Session,
then uses only public APIs to detect support, manage a Project, create and reopen its Session,
recover from CAS conflicts, and inspect history. The same behavior is available over gRPC and
HTTP; external Studio evidence is recorded before this plan lands.

**Acceptance:**

- AC5.1: one offline transport-level journey calls the standalone capability endpoint, discovers the canonical source, creates/gets/lists/replaces a Project, creates and runs a Project Session, lists it by Project, deletes the Project, and still gets/continues the Session.
  - verify: `TestProjectWorkingMVP_Scenario5_EndToEndJourney`
- AC5.2: a table-driven gRPC/HTTP status matrix proves equivalent outcomes for foreign/missing Projects, invalid names/sources, stale Replace/Delete, unsupported deployment, unavailable captured source, paging errors, and successful Project Session creation.
  - verify: `TestProjectWorkingMVP_Scenario5_TransportParity`
- AC5.3: generated contracts expose standalone capability discovery and every operation/data projection needed by Studio; no Project workflow requires a filesystem path, generic `CreateSession`, or a full internal binding projection.
  - verify: `TestProjectWorkingMVP_Scenario5_StudioContractIsPathFree`
- AC5.4: an older server's unimplemented/404 bootstrap and a Project-disabled new server both cause the Studio integration to hide/disable Project UI while ordinary Session behavior remains usable; before landing, the plan Status records the external Studio repository commit and green journey workflow as evidence.
  - verify: demonstration — external Studio contract journey and CI evidence recorded in this plan before `landed`
- AC5.5: all producer-derived Project/source strings are valid UTF-8 at the protobuf boundary and locator-shaped failures are scrubbed from ordinary transport responses.
  - verify: `TestInvariant_project_proto_strings_and_errors_are_safe`

---

### Scenario 6 — Mecatui is the local Project acceptance client

An operator starts embedded or connected mecatui against the local durable deployment and
uses `/projects` to complete the same working-Project journey without a browser or raw API
client. The UI follows [ADR-0230's independently paged navigation](../adr/0230-project-working-and-reference-folders.md)
and the proto-free client boundary in [the architecture guide](../architecture.md).

**Acceptance:**

- AC6.1: mecatui discovers the standalone server capability and exposes `/projects` only when `projects=true`; an older, unimplemented, or Project-disabled server leaves ordinary chat usable and provides no misleading Project affordance.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiCapabilityGate`
- AC6.2: `cmd/mecatui/client` owns all generated-protobuf contact and maps Project/source/page/conflict responses into plain client types; `cmd/mecatui/ui` imports no generated proto or server/internal package.
  - verify: `TestInvariant_mecatui_projects_keep_proto_boundary`
- AC6.3: the create flow lists only server-advertised working sources and submits a name plus opaque SourceRef; it never asks for, derives, stores, or sends a filesystem path, workspace, profile, EnvironmentRef, or backend locator.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiCreatePathFree`
- AC6.4: opening a Project lazily loads that Project's filtered Session pages; the operator can create a Project Session and adopt it through the existing active-Session lifecycle, or continue an eligible existing Session without duplicating conversation/session state machinery.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiProjectSessions`
- AC6.5: rename/replace sends the displayed revision. An `ABORTED` conflict never overwrites or automatically retries; the UI preserves the operator's input and offers explicit Reload and Back actions before another mutation.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiConflictRecovery`
- AC6.6: delete requires explicit confirmation and the displayed revision. Success removes the Project view but does not claim its Sessions were deleted; those Sessions remain reachable from ordinary Session history.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiDeleteNonCascading`
- AC6.7: list, empty, loading, detail, create, edit, conflict, delete-confirmation, unsupported, and error states are keyboard-operable, width-safe, control-character-safe, and covered by stable View goldens; an action-loading state prevents duplicate mutations.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiViewStates`
- AC6.8: one offline in-process gRPC/teatest journey over the real mecatui client and server composition proves capability discovery, Project create/list/open/rename/conflict, Project Session create/continue, filtered navigation, and non-cascading delete; `docs/tui.md` and `docs/usage.md` give the copy-paste local `--store-dir` workflow used for manual acceptance.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiEndToEnd`

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| Ordered Project references in create/replace | Project references acceptance plan | [ADR-0230 decisions 1, 7–8](../adr/0230-project-working-and-reference-folders.md) |
| `ProjectReferenceList` / `ProjectReferenceRead`, broker, bounds, fencing, permissions, audit, and child propagation | same Project references plan; these ship together | [ADR-0230 decisions 7–8](../adr/0230-project-working-and-reference-folders.md) |
| Alternate local working roots and their no-steering posture | next working-source plan | [ADR-0230 decision 6](../adr/0230-project-working-and-reference-folders.md) |
| Ownership-enforced/multi-caller working sources and source-audience policy | same next working-source plan; never share the canonical writable root implicitly | [ADR-0230 context](../adr/0230-project-working-and-reference-folders.md) |
| Kubernetes mounts and mecak8s Project-store/source configuration | deployment follow-up | [ADR-0230 rollout](../adr/0230-project-working-and-reference-folders.md) |
| MCP, object-store, Git, HTTP, Google Document, personal, or searchable references | source-adapter follow-ups | [ADR-0230 decisions 2–3 and 7](../adr/0230-project-working-and-reference-folders.md) |
| User-managed source enrollment, organizations, sharing, ACLs, archive/restore | future tenancy/source-service decisions | [ADR-0230 context and decision 1](../adr/0230-project-working-and-reference-folders.md) |
| Conversation carryover into `CreateSessionFromProject` | separate workflow if Studio demonstrates the need | [ADR-0230 decision 4](../adr/0230-project-working-and-reference-folders.md) |
| Removal of paths from legacy compatibility APIs | separate redacted-projection design | [ADR-0230 decision 10](../adr/0230-project-working-and-reference-folders.md) |

## Kubernetes fast-follow boundary

The local implementation must leave the public Project API, Project-store contract, source
registry, captured Session binding, and capability decision unchanged for a mecak8s follow-up.
That follow-up supplies adapters and deployment proof rather than a second Project design:

1. a Redis Project store implementing the same create/load/CAS/page contract across replicas;
2. Redis Session metadata that applies owner and exact Project filtering before page formation;
3. operator-declared working-source registrations whose stable authority identity is identical
   across replicas and pod restarts and is independent of incidental container mount paths;
4. a resolver returning a complete Environment whose `EnvironmentRef` denotes shared or remote
   backing authority—Session leasing alone does not make pod-local storage shared or durable;
5. seam-derived `projects=true` wiring in mecak8s once the Project store, registry, and resolver
   are present; and
6. a cross-replica acceptance journey proving Project CAS, Session creation on one replica,
   reattachment on another, the same working contents after failover, and fail-closed source
   replacement without launch-root fallback.

Ownership-enforced Kubernetes deployments additionally require the deferred source-audience
policy; the first cut must not encode ownerless operation as the Project domain model.

## Cross-cutting deliverables

- Before orchestration, correct ADR-0230's rollout so `CreateSessionFromProject` and the
  captured Session binding cannot land in separate releases. Promote it to Accepted only
  when that combined contract lands; after acceptance it is frozen.
- Keep Project domain/store/registry behavior above the agent loop. Define backend-neutral
  Project-store and source-registry seams before implementing their local adapters; neither
  shared contract may mention files, flock, Redis, Kubernetes, mount paths, or the local
  root-digest algorithm. Add no Project-store or source-registry dependency to
  `engine/agent` or `engine/port`; only Session's inert captured binding and the exact
  Project-ID filter/metadata projection needed by bounded Session discovery cross the
  importable engine surface.
- Extend snapshot, event-source SessionMeta, metadata-pager, memstore, jsonlstore, Redis,
  and gRPC-driver compatibility paths as required for captured provenance and filtered
  paging. A backend that cannot filter advertises unsupported rather than degrading to an
  unbounded scan.
- Classify every new exported server facade in the ownership classification guard. Inventory
  the Project store and immutable source registry in ADR-0027 List 1, and any restart-lost
  state in List 2.
- Regenerate protobufs and generated clients. If the engine public surface changes, update
  the API baseline and add a classified `engine/CHANGELOG.md` entry.
- Update `docs/architecture.md`, `docs/design/IMPLEMENTATION-NOTES.md`, `docs/usage.md`,
  operator configuration/API documentation, and lean `user-docs/` guidance in the same PR.
  The external Studio repository adds its browser/client journey against the generated
  contract before declaring Studio support shipped.

## Sequencing recommendation

Scenario 1 establishes source discovery and the durable ownership/CAS store. Scenario 2
consumes those seams and must land with the Session binding rather than creating an
unlabelled intermediate Session. Scenario 3 closes restart and fork semantics before Studio
relies on reopening. Scenario 4 changes metadata paging only after the binding exists.
Scenario 5 is the aggregate transport gate. Scenario 6 may start its client mapping and View
states once Scenarios 1–2 freeze the generated contract, but its real-client journey lands
after Scenarios 3–5. Within a scenario, adapters and mecatui View states may be developed in
parallel behind shared conformance suites; neither UI should guess source IDs, conflict
semantics, or filtering before the corresponding contract lands.

## Named tests landing in this plan

- `TestInvariant_project_source_discovery_is_locator_free`
- `TestInvariant_project_access_is_caller_separated`
- `TestInvariant_project_session_creation_has_no_client_environment_selector`
- `TestInvariant_project_source_ref_is_not_authority`
- `TestInvariant_project_session_restart_uses_captured_binding`
- `TestInvariant_project_session_filter_precedes_paging`
- `TestInvariant_project_proto_strings_and_errors_are_safe`
- `TestInvariant_mecatui_projects_keep_proto_boundary`
- `TestProjectWorkingMVP_Scenario1_*` through `TestProjectWorkingMVP_Scenario6_*`

## Definition of done

1. `task lint` and `task test` pass for the root and engine modules under the race detector.
2. `task generate` leaves generated contracts and `llms.txt` clean.
3. `task api:check` passes, or `task api:update` plus a classified
   `engine/CHANGELOG.md` entry lands for intentional additive API changes.
4. `task docs` and `task site:build` pass with Project configuration and Studio/mecatui
   behavior documented; `task test:golden` leaves the mecatui Project Views green and clean.
5. `task ac-trace-strict` resolves every proof after this plan becomes `landed`.
6. The durable-adapter restart tests, aggregate gRPC/HTTP journey, and real-client mecatui
   teatest journey are offline and green; no live provider, network, or Kubernetes cluster is
   required.
7. The plan Status records a concrete external Studio commit/workflow proving bootstrap,
   capability-off compatibility, create/list/replace/conflict/delete, and Project Session
   open/continue against the generated contract.
8. The documented local `mecated --store-dir` plus mecatui `/projects` workflow manually
   demonstrates create, open, rename, conflict recovery, Project Session continuation, and
   non-cascading delete against the built binaries.
9. `go run ./cmd/mecademo` still prints a full offline Session.
10. `/panel-review` reports zero ship-blockers, including ownership, source-authority,
   persistence, API compatibility, and test adequacy.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, Studio has a stable,
path-free API and mecatui has a complete local acceptance UI for working-source Projects.
Alternate working sources and references remain separate, explicitly deferred capabilities
rather than hidden partial implementations.
