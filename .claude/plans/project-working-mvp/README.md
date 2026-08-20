# Project working MVP orchestration

Accumulator: `acc/project-working-mvp`

This plan implements the complete six-scenario working-source-only Projects MVP. Tasks are dependency ordered and each acceptance criterion is assigned once. The plan cannot be marked `landed` until external Studio evidence for AC5.4 is recorded; repository work, aggregate gates, and panel review still run before reporting that blocker.

## Dependency and acceptance coverage

| Task | Depends on | Acceptance criteria |
|---|---|---|
| `01-project-domain-store-sources` | — | AC1.1–AC1.8 |
| `02-project-session-creation` | `01-project-domain-store-sources` | AC2.1–AC2.6 |
| `03-project-binding-restart-fork` | `02-project-session-creation` | AC3.1–AC3.6 |
| `04-project-session-navigation` | `03-project-binding-restart-fork` | AC4.1–AC4.5 |
| `05-project-contract-transport-docs` | `04-project-session-navigation` | AC5.1–AC5.5 |
| `06-mecatui-projects-acceptance` | `05-project-contract-transport-docs` | AC6.1–AC6.8 |

Coverage is complete and disjoint: 38 acceptance criteria total. Each task quotes its assigned criteria and `verify:` lines verbatim.

## Cross-cutting constraints

- ADR-0230 rollout correction and its combined captured-binding/Project-session release are owned by task 01; status promotion occurs only when that combined contract lands.
- Project domain/store/registry remain above `engine/agent` and `engine/port`; shared seams remain backend-neutral. Captured binding and the exact Project filter/projection are the only importable-engine surface additions.
- Snapshot, event-source metadata, pagers, memstore, jsonlstore, Redis, and gRPC-driver paths must remain compatible; unsupported Project filtering fails honestly.
- New server facades require ownership classification. Resource and restart-fidelity inventory updates belong in ADR-0027. Generated contracts, `llms.txt`, API baseline/changelog when applicable, architecture/usage/design/operator docs, and user docs are reconciled on the accumulator.
- Kubernetes is a fast-follow adapter/deployment proof, not a second Project design: preserve public APIs and seam-derived capability wiring for a replica-stable source identity, Redis CAS/filtering, a complete shared/remote Environment resolver, and cross-replica fail-closed reattachment.
- AC5.4 requires external Studio commit and green workflow evidence. Repository work may finish without it, but the acceptance plan remains in-progress and cannot be marked landed.
