# Authority attenuation reconciliation plan state

Accumulator: `acc/authority-attenuation-reconciliation`

This is a local-only execution: task branches merge into the accumulator, but are never pushed and no PR is created. The acceptance contract is `docs/acceptance/authority-attenuation-reconciliation.md`.

| Task | Depends on | Covers |
|---|---|---|
| 01-authority-domain | — | AC1.1–1.4, AC7.1 |
| 02-root-event-fork | 01-authority-domain | AC2.3–2.4, AC6.4, AC7.2–7.4 |
| 03-catalog-environment | 01-authority-domain | AC2.1–2.2, AC3.1–3.4, AC4.1–4.4 |
| 04-managed-definitions | 01-authority-domain | AC5.1–5.4 |
| 05-delegation-docs | 02-root-event-fork, 03-catalog-environment, 04-managed-definitions | AC6.1–6.3 and living documentation |

## Current-tree reconciliation

The recovery work is now committed on the accumulator. Task branches are
reachable from it, which is the completion source of truth.

| Task | Accumulator commit | State |
|---|---|---|
| 01-authority-domain | `a0f683ab` | done |
| 02-root-event-fork | `06ed4665` | done |
| 03-catalog-environment | `65950f9e` | done |
| 04-managed-definitions | `a9dfa18f` | done |
| 05-delegation-docs | `65445985` + `f36b9b52` | done (followed by direct-team coordination correction `1967ae03`) |
