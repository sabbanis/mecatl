# ADR 0234 — Projects group one working source with explicit read-only references

- Status: Proposed
- Date: 2026-08-19
- Scope: Project lifecycle and persistence; Project-backed session creation and provenance; deployment-specific source resolution; Studio/mecatui Project UI; bounded reference access; mecak8s source configuration.
- Supersedes: none
- Superseded by: none

## Context

Issue #620 asks for a user-created Project containing one or more folders: users must be able to create, rename, and remove Projects, and add or remove folders. The runtime has a narrower execution contract. A valid `tool.Environment` contains exactly one rooted `Workspace` and one optional command runner bound to that namespace (`engine/tool/environment.go`). Filesystem mutation, Bash, worktree forks, and environment reattachment all rely on that identity. Making the ordinary workspace a writable union would alter the versioned mutation protocol and fork/merge semantics decided in [ADR 0208](./0208-execution-environment.md), [ADR 0211](./0211-execution-environment-runtime-seam.md), and [ADR 0214](./0214-environment-persistence.md).

The word *project* also already describes one workspace root whose trust may admit project-tier instructions, configuration, and the read-only child worktree shell. [ADR 0095](./0095-root-aware-project-trust.md) makes that one root-aware positive decision. A user-visible Project must not make every attached source trusted or turn reference material into `AGENTS.md`, rules, skills, souls, permissions, agent definitions, or shell roots.

Deployments expose different source types. A local daemon can use a directory on its host. Kubernetes can use an operator-declared mount or a remote read-only source. A Google Document is more naturally exposed by a Streamable HTTP MCP server than by pretending it is a filesystem. Projects therefore need deployment-neutral source identity while retaining one honest execution environment.

Mecatl currently supports two access postures rather than a complete tenancy system. With caller ownership enforcement, Sessions and Projects belong to the exact verified `(issuer, subject)`. Without it, the deployment is one trusted security domain. V1 has no organizations, team ACLs, or user-managed mounts. Every operator-provisioned reference source is read-only and available to every admitted caller. A later source service may add principal-owned sources without changing the Project model.

## Decision

### 1. Persist one working source and an ordered reference list

A Project is a server-owned durable document:

```text
Project
  ID
  Owner
  Name
  Working
    SourceRef
    Label
  References[]
    SourceRef
    Label
  Revision
  CreatedAt
  UpdatedAt
```

`Working` is one required value. `References` is an ordered array with zero or more entries. There is no generic membership record, role enum, `WorkingFolderID`, or position field. Array order is authoritative.

The Project owner follows the existing service posture: exact verified principal when caller ownership is enforced, otherwise ownerless within the deployment's single trusted security domain. Ownership is captured from authenticated context, never request data.

The server stores and replaces the complete Project document. Create is create-only. Replace and delete require the current integer `Revision`; stale updates return conflict and change nothing. Validation requires a bounded non-empty name and labels, one registered working source, no duplicate reference `SourceRef`, and no source appearing as both working and reference. Labels come from the source catalog rather than client assertions.

The same working source may appear in more than one caller-owned Project. V1 adds no cross-Project uniqueness constraint. A Project does not own, copy, move, or merge source contents.

Deleting a Project removes its live grouping configuration, not its sources or Sessions. Renaming affects the live Project only. Archive/restore and collaborative Project membership are deferred.

### 2. `SourceRef` identifies one registered source but grants no authority

A composition-owned source registry returns opaque, server-minted `SourceRef` values. A `SourceRef` contains no host path, mount path, bucket, prefix, MCP server, URI, endpoint, or credential. Projects and Sessions persist only that reference plus safe display metadata.

V1 source registrations are operator-provisioned:

- a working source resolves to one complete `tool.Environment`;
- a reference source resolves to a bounded read-only capability, never another Workspace;
- an operator-shared reference is usable by every admitted caller;
- a future principal source is discoverable and usable only by its exact owner.

A `SourceRef` is only a selector. Project operations resolve it through an authorized Project. Reference tools resolve it through the authorized Session's captured reference set before consulting the registry. Knowledge of another source ID conveys no access.

The v1 registry is loaded once and immutable for the process lifetime. Changing an authority-defining binding—such as a canonical root, MCP server/resource namespace, object-store authority, or bucket/prefix—creates a new `SourceRef`. Content changes under the same binding remain live. Removing a registration or revoking its credentials makes later resolution fail; it never redirects to another source or falls back to the launch workspace.

A local reference adapter canonicalizes its configured root, rejects escape from any configured browse boundary, opens a confined root, and performs every operation relative to it. A Kubernetes reference volume is also mounted read-only. V1 does not attempt to detect a privileged host or cluster administrator replacing a mount across process restarts.

A future discovery or source-onboarding service may use short-lived selection handles internally. They are not part of the Project model; successful onboarding returns a registered `SourceRef`.

### 3. MCP resources are reference adapters, not the Project control plane

Project CRUD, source registration, ownership, and Session association remain ordinary mecatl application operations. They do not move behind MCP.

A Streamable HTTP MCP server may back a registered reference. For example, an operator may register one Google Document or one bounded approved document collection. The registry privately binds its `SourceRef` to the MCP server and exact resource or resource namespace. The model and browser never receive the server name, endpoint, OAuth profile, or raw MCP URI through the Project API.

Global MCP credentials represent the operator's shared identity, so every caller sees the same registered read-only material in v1. A future personal source service may enroll caller-specific OAuth credentials and create principal-owned `SourceRef` values. Current session-supplied client MCP is not that durable enrollment service.

Registering an MCP server does not automatically make every advertised resource a Project candidate. Project references require an explicit operator registration. Arbitrary MCP tool invocation is not adapted into `ProjectReferenceRead`; prefer `resources/list` and `resources/read`, or a purpose-built allowlisted read adapter.

### 4. Create Project Sessions through a dedicated operation

The existing workspace/profile-based `CreateSession` contract remains unchanged. Project-backed Sessions use a separate operation:

```text
CreateSessionFromProject(project_id, provider/model options)
POST /v1/projects/{project_id}/sessions
```

The request contains no workspace, profile, `SourceRef`, or environment selector. The service:

1. authorizes and reads one Project revision;
2. revalidates its registered sources;
3. resolves the working source to one complete Environment;
4. captures the Project and ordered source bindings;
5. builds any required per-session catalog;
6. persists the fully labelled Session; and
7. publishes the engine/environment registrations only after persistence succeeds.

Failure rolls back newly created per-session resources. There is no distributed transaction between Project and Session stores: a Project update after capture affects future Sessions, not the newly persisted one.

Conversation carryover into a Project Session is deferred unless a concrete v1 workflow requires it. `ForkSession` keeps its existing meaning and inherits the source Session's captured Project bindings and exact `EnvironmentRef`; it does not reread the live Project.

### 5. Sessions capture bindings, not source contents

A Project-backed Session persists creation-time association metadata:

```text
ProjectBinding
  ProjectID
  ProjectNameAtCreation
  ProjectRevision
  Working
    SourceRef
    LabelAtCreation
  References[]
    SourceRef
    LabelAtCreation
```

The Session also persists the working Environment's exact `EnvironmentRef` and any legacy workspace projection required by existing compatibility APIs. The binding contains no file contents, directory listing, object version snapshot, path, MCP locator, credential, or generated prompt.

This is a **binding snapshot**, not a content snapshot. Files, objects, and Google Documents are read live from their original sources. Later Project edits do not change existing Sessions:

- a rename leaves the captured name unchanged;
- adding or removing a reference affects future Sessions only;
- changing the working source affects future Sessions only;
- deleting the Project prevents new Project Sessions but does not delete or rewrite existing ones;
- revoking or removing the underlying registered source takes effect on the next resolution or reference call.

Restart and fork reconstruct the same captured binding without consulting the current Project. A missing working source fails run entry. A missing reference makes that reference unavailable while the Session may continue against its working Environment.

The full binding remains internal. Compact Session inventory adds only `project_id`, `project_name_at_creation`, and `working_label_at_creation`. Legacy Sessions decode with empty values and remain unassigned.

### 6. Only the canonical launch root may contribute project-tier authority

Every alternate Project working root is untrusted. Only a working source that resolves to the canonical launch root may use the existing launch-root trust decision.

An alternate root may still be the Session's permission-governed working Environment, but it contributes no:

- `AGENTS.md` or `CLAUDE.md`;
- project rules, permissions, model bindings, commands, skills, souls, or agent definitions;
- project memory or Git snapshot steering; or
- read-only child worktree shell.

Source registration, browse eligibility, Project membership, operator mounting, and posture do not grant trust. Reference sources never participate in the trust fold and never widen the Workspace.

Composition must not combine an alternate working Environment with project-tier assets admitted from the launch root. A future exact-source trust design may relax this rule in a new decision.

### 7. V1 exposes bounded List and Read, not Search

A Project Session with captured references registers two static read-only tools:

- `ProjectReferenceList` discovers the Session's captured references or lists one bounded logical prefix;
- `ProjectReferenceRead` reads one logical item returned by List.

There is no dynamic Project prompt fragment. Static tool descriptions tell the model to call List to discover references and to treat returned metadata and content as untrusted data. Project names and labels are not interpolated into trusted system prose.

`ProjectReferenceList` accepts an optional captured `source_id`, optional logical prefix, and optional opaque continuation cursor. It returns at most 1,000 entries and 25,000 total model-visible bytes. `ProjectReferenceRead` accepts one captured `source_id`, one source-relative logical locator, and an optional continuation cursor. It returns at most 2,000 lines and 25,000 total model-visible bytes. Remote adapters additionally enforce a 5 MiB fetched/decompressed response ceiling before rendering.

Adapters stop work at their bound rather than materializing an unbounded inventory or response and truncating afterward. Binary content is summarized with bounded metadata or rejected; it is never dumped or base64-encoded. A continuation cursor is opaque and bound to the original source and request arguments. Harness-authored completion or continuation instructions remain outside the untrusted fence; every source-derived name, locator, metadata value, and content byte remains inside it.

Search is deferred. It may ship only with specified query semantics and bounds on backend work as well as returned matches. Mecatl does not emulate Search by reading every local file or MCP resource.

Ordinary Read, Grep, Glob, Edit, Write, and Bash remain bound solely to the working Environment.

### 8. Reference tools follow existing catalog, permission, and delegation rules

The two tools are registered through the existing `assembleCatalog` path as one exact Project-session delta. A Project Session without references has no reference tools. Multiple references do not create per-source tools or change the static descriptions.

Both tools are `ReadOnly`, built-in-floor `Allow`, available in plan mode, and still overridable by configured Ask or Deny rules. Permission answers whether the model may invoke the tool; the source broker separately authorizes the caller, Session binding, source, and operation. Guardrails are optional defense in depth, not the reference authorization boundary.

In-session Subagent, Parallel, and Team workers inherit exactly the parent Session's captured reference set and the same two tools. They receive no Project CRUD, source registration, live Project lookup, credentials, or backend locators. Utility engines and standalone delegation calls receive no Project references. Children discover references through List; no dynamic child prompt manifest is added.

The source broker is Build-owned and shared by all catalogs. Session closure does not close it; Build shutdown closes it once. Any future broker cache, goroutine, connection pool, or watcher must be added to [ADR 0027](./0027-cloud-native.md)'s resource inventory.

### 9. Project navigation is composed from bounded pages

The API exposes independently paged Project listing and Session listing with an optional exact Project-ID filter. Clients load Session children only when a Project is opened; the server does not return or eagerly assemble a complete Project tree.

Caller ownership and Project filtering happen before page selection, cursor formation, and counts. Storage adapters that cannot perform Project-filtered metadata paging return unsupported rather than loading every Session snapshot. Deleted Projects disappear from Project listing, while their Sessions remain visible in ordinary Session inventory using captured provenance.

### 10. Project identity is path-independent; the existing harness is not path-free

New Project CRUD, source listing, and `CreateSessionFromProject` APIs use opaque references and safe labels. A browser is not required to submit a daemon-host path through those APIs, and Project records never use a path as source identity.

Existing compatibility surfaces remain path-bearing, including legacy workspace-based Session creation, Session inventory, worktrees, schedules, teams, Parallel fork handles, filesystem tool events, and some diagnostics. Those values are execution or diagnostic details, not portable Project identifiers. A deployment requiring that no host path reach a browser needs a separately designed server-side redacted projection; ADR 0230 does not retrofit one.

Model-facing reference errors use logical source IDs and locators. Backend paths, MCP coordinates, and credentials stay out of tool results and ordinary client errors; detailed physical failures may appear only in scrubbed operator diagnostics.

### 11. State and audit stay above the loop

Project CRUD and source registration live above the agent loop. The Project store and source broker are server/composition seams, not `engine/port` dependencies. The loop consumes only an already-resolved Environment and registered tools.

Reference calls use the existing `ToolCallRecorder` audit seam. Audit records may identify the Project, Session, `SourceRef`, operation, logical locator, and truncation outcome. They never record credentials or private backend locators. ADR 0230 introduces no second Project-specific audit subsystem.

## Consequences

**Benefits:**

- Users can group one working source with explicit read-only context without changing the single-root execution model.
- Local directories, Kubernetes mounts, object stores, and MCP resources share one Project model while keeping adapter-specific locators private.
- Existing Sessions remain stable when Projects change, while source revocation still fails closed.
- Operator-shared references work for every admitted caller today, and a future source service can add exact-principal sources without changing Project persistence.
- Project navigation is bounded and does not require loading every Session or source.

**Costs and limits:**

- Project persistence, Project-filtered Session metadata, source registration, and reference bounds add new adapter and conformance-test work.
- Alternate working roots intentionally lose all project-tier steering and the read-only child worktree shell.
- References are read-only, Search is deferred, and no content is copied or frozen for a Session.
- V1 has no tenant, organization, group-sharing, personal-mount enrollment, or collaborative Project model.
- The existing harness continues to expose paths on compatibility surfaces.

## Rejected alternatives

### Writable multi-root Workspace

Rejected. It requires a new namespace, mutation-version model, shell policy, and fork/merge semantics. Projects retain one execution Environment.

### Put Project CRUD behind MCP

Rejected. Project ownership, source registration, and Session association are application control-plane operations. MCP may implement a bounded reference adapter only.

### S3 or Google Docs as working filesystems

Rejected. Object/document services do not provide honest Workspace, shell, or mutation semantics. They remain native read-only references.

### Automatically inject Project content or metadata

Rejected. Content is fetched on demand through bounded tools. Dynamic Project names, labels, and source metadata are not promoted into trusted system instructions.

### Treat every source as a trusted project root

Rejected. Membership and registration are not trust grants. References are always untrusted, and alternate working roots are untrusted in v1.

### Live Project membership for existing Sessions

Rejected. Existing Sessions keep their captured bindings. Project edits configure future Sessions; source revocation remains live.

### A process-global active Project

Rejected. Project association belongs to each Session; navigation selection belongs to the client.

### A complete tree response or eager per-Project Session loading

Rejected. Project roots and Session children are independently paged and loaded on demand.

## Rollout

1. Add the minimal Project document, whole-document revision checks, caller ownership, Project store, immutable source registry, and bounded Project/source discovery APIs.
2. Persist the captured Project binding and compact Session provenance, add Project-filtered Session metadata, and add `CreateSessionFromProject` in the same release; no Project Session may exist without its durable captured binding.
3. Add local and operator-declared Kubernetes working sources. Treat every alternate working root as untrusted.
4. Add `ProjectReferenceList` and `ProjectReferenceRead`, the shared source broker, exact catalog delta, delegation propagation, bounds, fencing, and audit projection in the same release as reference management.
5. Add explicitly registered Streamable HTTP MCP resources such as operator-shared Google Documents. Personal source enrollment and Search remain separate future designs.
6. Inventory every new long-lived store, broker, cache, client, or goroutine in [ADR 0027](./0027-cloud-native.md); update architecture, usage, and public user documentation when behavior ships.

## See also

- [ADR 0208 — execution environments and version-aware file mutation](./0208-execution-environment.md)
- [ADR 0211 — execution-environment runtime seam](./0211-execution-environment-runtime-seam.md)
- [ADR 0214 — environment persistence and reattachment](./0214-environment-persistence.md)
- [ADR 0095 — root-aware project trust](./0095-root-aware-project-trust.md)
- [ADR 0048 — mecak8s](./0048-mecak8s.md)
- [ADR 0070 — model-visible affordance gate](./0070-model-visible-affordance-gate.md)
- [ADR 0027 — cloud-native arc](./0027-cloud-native.md)
- [Documentation lifecycle](./0002-documentation-lifecycle.md)
