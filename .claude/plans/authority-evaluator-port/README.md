# Authority evaluator port

Accumulator: `acc/authority-evaluator-port`

This plan implements `docs/acceptance/authority-evaluator-port.md` for #371.
Tasks follow the dependency order needed to keep the engine module independent of
Cedar and to make the evaluator enforce one carried, durable capability set.

| Task | Scope | Depends on |
|---|---|---|
| 01-authority-domain | Pure authority value and neutral evaluator port | — |
| 02-session-persistence | Durable session authority payload and restoration | 01-authority-domain |
| 03-execution-evaluator | Local/noop adapters and single execute chokepoint | 01-authority-domain, 02-session-persistence |
| 04-composition-root | Managed definition tier, authority root minting, and evaluator posture | 03-execution-evaluator |
| 05-delegation-derivation | Child derivation, ceilings, per-call tightening, and resume containment | 04-composition-root |
| 06-cedar-adapter | Opt-in Cedar adapter and static operator policy | 03-execution-evaluator, 05-delegation-derivation |
| 07-vertical-docs | Vertical proofs and ADR/living/user documentation | 05-delegation-derivation, 06-cedar-adapter |
