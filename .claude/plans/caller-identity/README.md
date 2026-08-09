# Plan: caller-identity

Acceptance plan: [`docs/acceptance/caller-identity.md`](../../../docs/acceptance/caller-identity.md)
ADR: [`docs/adr/0100-caller-identity-threading.md`](../../../docs/adr/0100-caller-identity-threading.md)
Accumulator: `acc/caller-identity` — epic issue #367.

Track A of the agent-identity model: accept a verified principal at the edge,
thread it everywhere, record who owns each session and schedule. No enforcement.

| Task | Scenario / ACs | blocked_by |
|---|---|---|
| `00-field-prep` | S0 — AC0.1–0.3 | — |
| `01-principal-context` | S2 — AC2.1, AC2.3 | 00 |
| `02-edge-accept` | S1 — AC1.1–1.7 | 01 |
| `03-session-owner` | S3 — AC3.1–3.5 | 01 |
| `04-system-principal-goroutines` | S2 — AC2.2 | 02, 03 |
| `05-event-actor` | S4 — AC4.1, 4.2, 4.5 | 03 |
| `06-schedule-owner` | S4 — AC4.3, 4.4, 4.6 | 05 |
| `07-docs-crosscutting` | cross-cutting deliverables | 04, 06 |

Waves: `[00]` → `[01]` → `[02, 03]` → `[04, 05]` → `[06]` → `[07]`.

Every numbered AC in the plan lands in exactly one task; none orphaned.
