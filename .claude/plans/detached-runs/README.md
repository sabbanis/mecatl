# detached-runs — task index

Plan: `docs/acceptance/detached-runs.md` (ADR 0321). Accumulator: `acc/detached-runs`.

A user connects mecatui to a remote mecated, submits a prompt, walks away (Ctrl+C),
and comes back later to find the run still going. 3 waves: server surface (1–2),
client surface (3–4), control + guardrails (5).

## Waves

- **Wave 1 (server surface):** tasks 01–02 — detached prompt + drain goroutine, control-only Converse stream.
- **Wave 2 (client surface):** tasks 03–04 — seamless reattach, Ctrl+C detach/cancel.
- **Wave 3 (control + guardrails):** task 05 — posture gating, deadline, concurrency bound.

Tasks run in dependency order; within a wave, independent tasks dispatch in parallel.
