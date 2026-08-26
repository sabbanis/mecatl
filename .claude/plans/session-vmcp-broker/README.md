# Session-scoped vMCP broker plan tasks

Accumulator: `acc/session-vmcp-broker`

| Task | Depends on | Acceptance coverage |
| --- | --- | --- |
| 01-runtime-contract | — | AC1.6 |
| 01b-profile-auth-routes | 01 | AC1.6, AC2.7, AC3.4 |
| 02-session-tools | 01 | AC1.3, AC1.4, AC2.7 |
| 03-server-composition | 01b, 02 | AC1.1, AC1.2, AC1.5, AC4.5 |
| 04-oauth-transaction | 01b, 02 | AC2.1–AC2.4 |
| 05-callback-execution | 03, 04 | AC2.5, AC2.6 |
| 06-refresh-custody | 05 | AC3.1–AC3.4 |
| 07-teardown-lifecycle | 03, 06 | AC4.1–AC4.3, AC4.6, AC5.1, AC5.2 |
| 08-evidence-and-docs | 03, 07 | AC5.3, AC5.4 |

The acceptance plan intentionally has no AC4.4. Its named late-operation regression is retained as supporting coverage in task 07.
