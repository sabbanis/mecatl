# ADR 0234 — Projects group one working source with explicit read-only references

- Status: Proposed
- Date: 2026-08-19
- Scope: project lifecycle and persistence; session labels and creation; deployment-specific source resolution; Studio/mecatui project UI; bounded reference-folder access; mecak8s source configuration.
- Supersedes: none
- Superseded by: none

## Context

Issue #620 asks for a user-created Project containing one or more folders: users must be able to create, rename, and remove Projects, and add or remove folders. The existing runtime has a materially narrower contract. A valid `tool.Environment` contains exactly one rooted `Workspace` and one optional command runner bound to that namespace (`engine/tool/environment.go`); filesystem mutation, Bash, worktree forks, and environment reattachment all rely on that identity. Making the ordinary workspace into a writable union of roots would alter the versioned read/edit/write protocol and fork/merge semantics decided in [ADR 0208](./0208-execution-environment.md), the runtime seam in [ADR 0211](./0211-execution-environment-runtime-seam.md), and durable environment reattachment in [ADR 0214](./0214-environment-persistence.md).

The word *project* also already has an established, different meaning: one workspace root whose trust admits project-tier instruction/configuration ingestion and the read-only child worktree shell. [ADR 0095](./0095-root-aware-project-trust.md) makes that a single root-aware positive decision. A new user-visible Project must not make every member folder trusted, nor make each member folder a source of `AGENTS.md`, rules, skills, souls, permissions, or agent definitions.

A local daemon and `mecak8s` expose different filesystem realities. A local daemon can validate a directory on its host. A Kubernetes deployment must instead resolve an operator-declared volume mount or other approved source inside its pod. Studio intentionally keeps host paths out of the browser. A public API that persists or accepts arbitrary paths cannot honestly serve all three deployments.

## Decision

### 1. A Project is an explicit persisted user grouping

Add a server-owned, durable Project model. A Project owns ordered source-membership records. **Project Folder** remains the user-facing name for a source attached to a Project—initially it is a directory, but its persistent identity is not a path and a later reference-only source may be an object-store prefix. A Project does not own, copy, move, or recursively merge source contents.

```text
Project
  ID
  Name
  WorkingFolderID
  CreatedAt
  UpdatedAt

ProjectFolder
  ID
  ProjectID
  SourceRef
  Label
  Role: WORKING | REFERENCE
  AddedAt
```

Every usable Project has exactly one `WORKING` folder. A Project may have zero or more `REFERENCE` folders. Creation through the normal UI/API requires a working folder; an incomplete draft Project is not part of v1.

Use **working folder** in user-facing text rather than *primary folder*. It means the one source resolved to the session's ordinary execution environment. A reference folder is an additional named source of read-only context, not another workspace.

Removing the working folder is rejected unless the request simultaneously designates another existing member as the working folder. Removing a reference folder removes only that membership. Renaming changes only Project metadata.

Deleting a Project removes its live grouping configuration, not any underlying source or session. A session keeps its durable Project ID and a Project-name-at-creation label. A deleted Project therefore renders as a former/unavailable grouping in historical session views rather than losing provenance or deleting history. Renaming a Project does not rewrite historical session labels; active views resolve the current name from the live Project record.

An optional archive/restore lifecycle is deliberately deferred. The data model must not preclude it, but v1 implements only the issue's requested delete operation.

### 2. Persist deployment-neutral source references, never a universal path

A Project Folder persists an opaque `SourceRef`, a safe display label, and its role. The wire API never requires a browser or remote client to provide an arbitrary filesystem path.

A composition-owned resolver lists candidate sources and resolves an approved source by reference. Its two required outcomes are:

- resolving a `WORKING` source yields one complete `tool.Environment`—a non-nil Workspace and, where supported, a command runner bound to the same namespace;
- resolving a `REFERENCE` source yields a bounded read-only reference-source capability, not a Workspace added to the session environment.

A reference source declares the operations it actually supports. Directory sources may support bounded list, read, and search. An object store may support only list and read; a source must never claim a generic text-search capability by unboundedly downloading its complete contents.

The resolver is deployment-specific:

| Deployment | Candidate selected by user | Resolver-owned target |
|---|---|---|
| local `mecated` | a validated local-directory candidate | canonical directory on the daemon host |
| Studio through local `mecated` | an opaque candidate returned by the daemon | canonical directory on the daemon host |
| `mecak8s` | an operator-declared source/mount ID | approved in-pod mounted directory or source |

A local CLI may accept a path as a convenience, but it validates and resolves it to a source reference before Project persistence. It is not a second remote path API.

Studio directory discovery, if enabled, is an operator-authorized server operation limited to configured browse roots. It must canonicalize and check containment at each step, reject symlink escapes, return opaque candidate IDs rather than raw paths, and never become an unrestricted host filesystem browser. These browse roots are a separate operator authority from `trustedWorkspaces`: choosing a source does not trust it to steer the agent.

`mecak8s` does not offer host-directory browsing. Its candidate list comes only from deployment/operator configuration, and source eligibility expresses whether a mounted source may be `WORKING`, `REFERENCE`, or both. A read-only mount cannot be chosen as a working source.

A future S3 source is a native `REFERENCE` adapter, not an S3 filesystem mount and never a working source. The Project persists only its opaque source ID; operator configuration resolves that ID to an allowlisted bucket and prefix. The adapter uses the Pod's workload identity and least-privilege `ListBucket`/`GetObject` access restricted to that prefix. It exposes no cloud credentials, arbitrary bucket/key selection, write operation, shell, or mount path to the model or browser. Object reads report version identity where the backend provides it, but do not claim the local Workspace compare-and-swap protocol. S3 search is deferred until an explicit bounded scan or operator-provided index design exists.

The agent remains storage-free under [ADR 0048](./0048-mecak8s.md): Project records belong in a managed backing store selected by composition, not in pod-local disk.

### 3. A session has one working environment and an optional Project label

Add additive Project ID and Project-name-at-creation labels to a Session snapshot. They are durable session metadata; the engine does not interpret Projects or load Project records.

`CreateSession` may accept `project_id`. The service resolves the Project's working source before creating the session, stamps the resulting environment identity using the existing environment rules, and stamps the Project labels. If a caller supplies both `project_id` and `workspace`, the workspace must be absent or exactly resolve to the Project's working source; a mismatch is `InvalidArgument`, never a silent override.

New-session Project membership is explicit and durable. Session lists and project trees use the stored Project ID as their authority. Legacy sessions without a Project label remain unassigned; an optional display-only path-based suggestion may assist a user in assigning them, but must never silently rewrite their membership. This avoids ambiguous nesting/overlap, supports Kubernetes sources that are not paths, and preserves historical grouping if a Project later changes.

The session resolves exactly one ordinary environment: the working folder. Existing Read, Edit, Write, Grep, Glob, Bash, worktree, conditional-mutation, and environment-rehydration behavior remains single-root. A Project does not create a union filesystem and does not change the normal tool capability set.

### 4. Reference sources are explicit, bounded, and model-visible

Reference folders are not inert metadata once exposed in the product. Implement their access as three separate Phase 2 read-only tools—`ProjectReferenceList`, `ProjectReferenceRead`, and `ProjectReferenceSearch`—rather than widening `Workspace` or adding a source selector to the ordinary filesystem tools. **Reference folder** remains the product term for an attached source; the capability boundary is deliberately source-oriented so it can represent a directory or a future S3 prefix without changing the session environment.

These tools are a sanctioned Project-specific per-session catalog delta. They are absent when the session has no Project, when its Project has only a working folder, or when no effective reference source can be resolved. List and Read register only when at least one effective reference source exists; Search registers only when at least one of them supports search. The project prompt fragment is absent under the same gate.

The ordinary Read, Grep, Glob, Edit, Write, and Bash tools remain exactly working-folder tools. A reference tool requires an explicit reference-source ID and exposes only its one bounded operation: List takes an optional path/prefix; Read requires a path; Search requires a query and accepts an optional path/prefix. The tools do not provide Edit, Write, Bash, a workspace root, an unconditional path escape, or a general mount point. A directory may advertise list/read/search; a native S3 source advertises list/read only until a separately designed bounded search or index exists. Include the Search tool in a session catalog only when at least one reference source supports search; a call against an individual non-searchable source fails closed. All returned data is fenced untrusted content. A reference source's `AGENTS.md`, rules, skills, soul, permissions, agent definitions, and other project-tier files are never discovered or ingested merely because it is a Project member.

At session start, add a trusted harness-authored system-prompt fragment that identifies:

- the Project name;
- the working-folder label and that ordinary filesystem/command tools operate only there;
- each available reference-folder ID, label, and supported operations; and
- the requirement to use the corresponding ProjectReference tool only for read-only consultation.

The fragment contains neither a bulk folder listing nor reference-file content. Automatic scanning/injection is rejected: it would spend context on irrelevant data, expose more information than the task requires, and blur untrusted source data with agent authority. A model-visible prompt assertion through the real engine factory is required when the reference tools ship, following [ADR 0070](./0070-model-visible-affordance-gate.md).

Before the reference tools exist, v1 does not present reference-folder management as usable agent context. The initial Project-management release may support only the working folder; the add/reference-folder UI and API ship with the bounded reader tools, or explicitly remain unavailable. This prevents a misleading "add context" affordance that has no runtime effect.

### 5. Keep project state server-owned and deployment-portable

Project CRUD and candidate resolution live above the agent loop. The Project store is a server-owned seam configured by composition, not an `engine/port` dependency: the loop consumes only its already-resolved `tool.Environment` and session labels. A local adapter may use a profile-scoped database; a Kubernetes adapter must use the managed state service appropriate to its deployment. The public API includes Project CRUD, candidate listing, and project-based session creation, while the UI's selected Project remains client navigation state—not a daemon-global "active Project" pointer.

The project-session tree is built server-side from explicit session labels. Keep it pure and inject any repository/worktree inspection so it has deterministic contract tests and clients do not duplicate grouping rules. An unassigned/Home bucket keeps legacy and ungrouped sessions visible.

Project reference tools deliberately extend the catalog's otherwise-equal shared/per-session shape: a Project session with effective references must use a per-session assembly that registers exactly the available reference tools and the matching prompt fragment; every other tool family retains the existing parity rule. A Project with no effective references is catalog-identical to an ordinary filesystem session.

## Consequences

**Benefits:**

- Users can name and manage multi-folder bodies of work without changing the single-root execution model.
- Local, Studio, and Kubernetes deployments share one Project API while retaining different source-resolution and exposure rules.
- Reference material is available on demand, bounded, auditable, and cannot accidentally become writable workspace or authoritative project steering.
- A session's working environment, trust fold, fork behavior, and persisted environment identity remain coherent and compatible with the existing contracts.
- Explicit durable membership provides stable session grouping; it avoids unreliable longest-prefix inference and survives Project deletion.

**Costs and limits:**

- Project persistence needs at least two production adapters or a portable managed-store implementation; pod-local storage is not acceptable for `mecak8s`.
- Source candidate issuance, canonicalization, mount configuration, and reference-read bounds form a new security-sensitive surface and require focused security review and conformance tests.
- A remote reference adapter such as S3 adds workload-identity, bucket/prefix allowlist, egress, object-size/page/time limits, and object-version reporting requirements. It must never persist or project cloud credentials, and its consistency/version semantics are not Workspace CAS.
- Reference folders are not editable and do not provide shell access. Users needing to work in another repository start a session with that repository as the working folder or change the Project's working folder before session creation.
- Cross-Project source reuse requires an explicit policy. V1 should reject duplicate working-source ownership within one principal/scope to keep grouping unambiguous, while allowing a source to appear as a read-only reference in multiple Projects.
- Project deletion does not erase session data or source contents. The UI must make that distinction explicit.

## Rejected alternatives

### Writable multi-root Workspace

Rejected for v1. A union root would need a new namespace and version identity model for Read/Edit/Write, path disambiguation for every filesystem tool, a shell working-directory policy, and defined worktree/fork/merge behavior over multiple repositories. It would be a new execution-environment architecture, not Project CRUD.

### S3 filesystem mount or S3 working folder

Rejected. Mounting object storage as a filesystem would inherit filesystem semantics that object storage cannot honestly provide and would invite the normal Workspace, Bash, and mutation tools into an unbounded remote namespace. S3 stays a native, explicitly configured, read-only reference-source adapter; it does not become a working folder.

### Automatically inject all Project-folder content

Rejected. Folder size, relevance, token cost, sensitive data exposure, and instruction-injection risk make eager materialization inappropriate. The model receives a small trusted source manifest and retrieves bounded data deliberately.

### Treat every Project member as a trusted project root

Rejected. Membership is a user organization action, not an operator trust grant. Only the resolved working root participates in the existing root-aware trust decision; reference folders are untrusted data sources.

### Persist raw paths as the universal API contract

Rejected. It leaks host topology to browser clients, cannot represent a Kubernetes source safely, and confuses caller input with server authority. Paths may exist inside a local resolver implementation but are never the portable Project identity.

### A process- or profile-global active Project

Rejected. A multi-session daemon cannot safely let one caller's navigation selection redirect another session's environment. Project association belongs to the session; UI selection belongs to that UI client.

## Rollout

1. Add the Proposed Project record, server-owned store seam, source resolver seam, Project CRUD API, and session Project labels. Implement the initial working-folder-only experience.
2. Add local source candidates and a mecak8s operator-declared mount-source adapter. Add Studio's root-confined opaque directory browser only after security review.
3. Add server-owned project/session-tree grouping, then mecatui and Studio Project navigation.
4. Add the bounded `ProjectReferenceList`, `ProjectReferenceRead`, and capability-gated `ProjectReferenceSearch` tools, their model-visible prompt contract, and reference-folder UI/API in the same release.
5. Inventory every new long-lived Project store/cache/resolver resource in [ADR 0027](./0027-cloud-native.md) when implementation introduces it; update the living architecture and usage documentation when behavior ships.

## See also

- [ADR 0208 — execution environments and version-aware file mutation](./0208-execution-environment.md)
- [ADR 0211 — execution-environment runtime seam](./0211-execution-environment-runtime-seam.md)
- [ADR 0214 — environment persistence and reattachment](./0214-environment-persistence.md)
- [ADR 0095 — root-aware project trust](./0095-root-aware-project-trust.md)
- [ADR 0048 — mecak8s](./0048-mecak8s.md)
- [ADR 0070 — model-visible affordance gate](./0070-model-visible-affordance-gate.md)
- [ADR 0027 — cloud-native arc](./0027-cloud-native.md)
- [Documentation lifecycle](./0002-documentation-lifecycle.md)
