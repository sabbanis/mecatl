# Project working MVP orchestration

Accumulator: `acc/project-working-mvp`

This plan implements the complete six-scenario working-source-only Projects MVP. The plan remains in-progress until external Studio evidence for AC5.4 is recorded; repository work, aggregate gates, and panel review still run before reporting that blocker.

## Dependency and acceptance coverage

| Task | Depends on | Acceptance criteria |
|---|---|---|
| `01-project-domain-store-sources` | — | Foundation only |
| `02-project-session-creation` | `01-project-domain-store-sources` | Captured-binding foundation only |
| `03-project-service-composition` | `02-project-session-creation` | Service/composition foundation only |
| `04-project-contract-wiring` | `03-project-service-composition` | Contract/transport foundation only |
| `05a-project-store-ownership` | `04-project-contract-wiring` | Ownership/CAS foundation for AC1.4 |
| `05b-project-session-transaction` | `05a-project-store-ownership` | Factory/rollback foundation for AC1.1 and AC2.5 |
| `05-project-lifecycle-acceptance` | `05a-project-store-ownership`, `05b-project-session-transaction` | AC1.1–AC1.8, AC2.1–AC2.6 |
| `06-project-binding-restart-fork` | `05-project-lifecycle-acceptance` | AC3.1–AC3.6 |
| `07-project-session-navigation` | `06-project-binding-restart-fork` | AC4.1–AC4.5 |
| `08-project-contract-transport-docs` | `07-project-session-navigation` | AC5.1–AC5.5 |
| `09-mecatui-projects-acceptance` | `08-project-contract-transport-docs` | AC6.1–AC6.8 |

The foundation tasks exist because ADR-0234 prohibits a partial Project release. All 38 numbered criteria are asserted by their integrated task; AC5.4 requires external Studio commit/workflow evidence and prevents landing when absent.

## Cross-cutting constraints

- Project domain/store/registry stay above `engine/agent` and `engine/port`; only inert Session provenance and exact metadata filtering cross the importable-engine surface.
- Maintain snapshot, event-source metadata, metadata pager, memstore, jsonlstore, Redis, and gRPC-driver compatibility. Backends without filtered paging fail honestly.
- Kubernetes is a fast-follow adapter/deployment proof, not a second design: retain seam-derived capability wiring, Redis CAS/filtering, replica-stable source identity, complete shared/remote Environment resolution, and fail-closed cross-replica reattachment.
- Generated contracts, API baselines/changelog where required, architecture/usage/design/user documentation and `llms.txt` are reconciled on the accumulator.
