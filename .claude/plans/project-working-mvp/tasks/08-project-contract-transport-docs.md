---
id: 08-project-contract-transport-docs
title: Generated Project contract, transport parity, and deployment documentation
blocked_by: [07-project-session-navigation]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Finalize protobuf/gRPC/HTTP public Project contract and offline end-to-end transport coverage. Regenerate generated clients, ensure all Project/source producer strings are valid UTF-8 and errors cannot disclose locators, and classify every new facade under ownership enforcement. Update architecture, implementation notes, usage, API/operator configuration, and lean user docs. Run required generators and API compatibility update if necessary. This task must preserve the future mecak8s contract unchanged: Redis Project CAS and filtered metadata, operator source identity independent of mounts, complete shared/remote Environment resolution, seam-derived capability wiring, and cross-replica failover proof belong to the fast-follow adapters, not a second design. AC5.4 is an external-evidence gate: do all in-repository work but do not manufacture a Studio commit or workflow URL and do not mark the plan landed without it.

## Acceptance criteria

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
