---
id: 08-repair-docs-and-awaiting-close
title: Repair — IMPLEMENTATION-NOTES deliverable + awaiting-detached Close leak (panel-review)
blocked_by: []
status: done
branch: "plan-detached-runs/08-repair-docs-and-awaiting-close"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

Panel-review should-fixes:

1. **Missing deliverable (Spec + Standards axes):** the acceptance plan's
   Cross-cutting deliverables name "`docs/design/IMPLEMENTATION-NOTES.md`
   updated for the detached-run channel" — the file was never touched. Add the
   dense per-subsystem section covering: the detach channel (Prompt.detach →
   StartDetachedRunContent + drain goroutine ownership), the control-only
   Converse stream, the capability gate + posture refusal, the deadline +
   concurrency gate, the mecatui pointer/auto-branch/watch-reattach flow, and
   the Ctrl+C two-signal semantics. Lean — link the ADR, don't re-derive it.
   Run `task docs:llms` and commit llms.txt.

2. **Awaiting-detached-run Close leak (Medium):** `Service.Close`
   (internal/adapter/server/service.go:2385-2390) skips cancelling awaiting
   runs (the cross-process resume contract). A detached run parked awaiting
   therefore never closes its Events channel: the drain goroutine, the
   detachedGate slot, and the deadline timer outlive Close — contradicting
   ADR-0027 List 1 row 67's "joins on Service.Close". Fix per the panel's
   option (a): Close cancels awaiting runs whose runState is detached-owned
   (a `detached` flag on runState, distinct from the relay-awaiting skip) —
   safe because the drain's Persist-on-ask has already durably recorded the
   awaiting snapshot before the cancel. Add a test pinning it. Update the
   row-67 wording if the chosen fix changes the cleanup semantics.

3. **Low polish (architect):** route all `runStartDispatch` arms through
   `errToStatus` for one return shape (internal/adapter/server/grpc.go:430-500).

4. **Low doc note (standards):** one line in `docs/usage.md` — detached runs
   are gRPC-only (the HTTP/SSE surface has no detach arm in v1).

## Acceptance criteria

- AC8.1: `Service.Close` reaps an awaiting detached run's drain goroutine, gate
  slot, and deadline timer (test-pinned).
  - verify: `TestDetachedRun_Repair_CloseReapsAwaitingDetachedRun`
- AC8.2: `docs/design/IMPLEMENTATION-NOTES.md` gains the detached-run channel
  section; `docs/lint` (CheckCitations) green; llms.txt regenerated.
- AC8.3: all runStartDispatch arms return via errToStatus.
- AC8.4: docs/usage.md notes the gRPC-only limitation.
