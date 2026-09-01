# ADR 0278 — Detached runs: connect-and-leave-running for mecatui ↔ remote mecated

- Status: Proposed
- Date: 2026-09-01
- Scope: the Converse bidi stream's detach mode, the control-only Converse stream, the drain goroutine, and the mecatui auto-reattach path.

## Context

When mecatui connects to a remote mecated (`mecatui connect ADDRESS`), Ctrl+C kills mecatui, which breaks the gRPC Converse stream, and the server cancels the run (`relayRun` calls `run.Cancel()` on the first Send error — `internal/adapter/server/grpc.go:582`). The user cannot "start a run, walk away, come back, pick it up."

The forces at play:

1. **The Converse bidi stream couples run-driving to run-observation.** The client stream is the run's sole event consumer; on client disconnect the relay cancels the run. This is correct for an embedded single-user model but prevents the "fire-and-forget + pick up later" workflow.

2. **Two existing code paths already drive runs with no client stream.** Scheduled fires (`internal/app/scheduler_fire.go:182-213`) drain `run.Events()` server-side with a cancel-detached ctx; the HTTP approve no-Flusher fallback (`internal/adapter/server/http.go:790-806`) spawns a goroutine draining the run to the durable log and returns an ack. The detached-run feature is the same pattern, applied to an interactive prompt.

3. **`WatchSessionEvents` (ADR 0250) already does durable replay-then-follow with cursors.** It is the attach mechanism — a reconnecting client replays from the last cursor, then follows live. No new RPC needed.

4. **The awaiting-approval resume path (`resumeFromAwaiting`, `service.go:4715`) already re-enters a dead run at a pending ask.** A detached run that parks awaiting while the client is disconnected is the same case — no new domain work.

5. **The user should not have to remember anything.** The tool persists the last-session pointer per server target and auto-branches on reconnection based on the session's state. Ctrl+C always detaches when the server supports it; double Ctrl+C cancels.

## Decision

1. **A `detach` field on the existing `Prompt` message makes the Converse stream optionally non-cancelling.** When `detach: true`, the server starts the run via the existing `StartRunContent` path, spawns a server-owned drain goroutine (the `scheduler_fire.go:199-213` pattern), sends an ack, and closes the stream cleanly. The run continues server-side; the durable event log records every event including the terminal `EvResult`. When `detach` is false (or absent — the proto3 default), the existing relay path is byte-identical. **Zero new RPCs, zero new messages, one new bool field.**

2. **A control-only Converse stream reuses the existing `Cancel` and `ResumeApproval` messages for cancel/approve without a prompt.** The Converse handler's first-frame rule is relaxed to also accept `cancel` or `resume_approval` as the first frame. `Cancel` and `ResumeApproval` gain a `session_id` field (additive) so a control-only stream can identify the session. The existing `prompt`/`retry` first-frame paths are byte-identical. **Zero new RPCs, zero new messages, two additive fields.**

3. **The drain goroutine is Service-owned and bounded.** It drains `run.Events()` through the existing `RunEventRecorder` with a cancel-detached ctx, breaks on terminal `EvResult`, and calls `FinishRun`. It joins on `Service.Close` (which cancels all in-flight runs). It is inventoried in [ADR-0027](./0027-cloud-native.md) List 1; List 2 needs no new row (a crashed detached run leaves a `running` snapshot handled by the existing `Abandon` seam + `startStaleSessionReconcile`).

4. **The client auto-reattaches with zero flags and zero session IDs to remember.** A persisted last-session pointer per server target (`~/.local/state/mecatui/sessions.yaml`, mirroring the `selectionStore` infrastructure) is read on `mecatui connect ADDRESS`. The tool auto-branches on session state: running → reattach via `WatchSessionEvents`; idle/terminal → resume; none → fresh. `--new` forces a fresh session. `--resume <id>` auto-branches too. **No new `--reattach` flag.**

5. **Ctrl+C always detaches when the server supports it; double Ctrl+C cancels.** The behavior is determined by the server's `ServerCapabilities.detached_runs` bit, not the user's mode awareness. The first Ctrl+C prints the one-line "run continues" message and quits without cancelling. The second Ctrl+C sends a control-only Converse `cancel` frame and exits. This reuses the existing two-signal handler shape. Embedded mode: Ctrl+C kills the process (the server dies with it) — unchanged.

6. **Detached runs are operator-tier gated and hardened.** `mecated --detached-runs` flag (default OFF). Posture gating: allowed under `strict`/`trusted`/`auto`; WARN or refuse under `yolo`. Permission asks park awaiting (no auto-approve). Mandatory wall-clock deadline (the "forgot to come back" bound). Server-wide concurrency gate (mirrors `childGate`).

## Consequences

- **The connect-and-leave-running workflow works.** The user runs `mecatui connect ADDRESS`, submits a prompt, presses Ctrl+C, and the run continues server-side. They come back later, run the same command, and the tool auto-reattaches.

- **The Converse stream's contract is relaxed, not broken.** The `detach` field is additive; older servers ignore it. The control-only first-frame relaxation is additive; existing `prompt`/`retry` paths are byte-identical.

- **The drain goroutine is a new Service-owned resource.** It is bounded (joins on `Service.Close`, cancels on terminal `EvResult`) and inventoried. A crashed detached run is a `running` snapshot handled by the existing `Abandon` seam — the same residual scheduled fires have.

- **The client startup path gains a new default.** The no-flag `mecatui connect ADDRESS` path now reads a persisted pointer and auto-branches. The `--resume`/`--resume-latest` flags keep their existing semantics; the no-flag default is the new path.

- **The two-signal handler's semantics shift for detached-capable servers.** First Ctrl+C = detach (run continues), second Ctrl+C = cancel + exit. This is the same "press again to force" pattern mecatui already uses, but the first signal's meaning changes from "graceful shutdown" to "detach."

## See also

- [ADR 0250 — Durable cursors and the session watch transport](./0250-durable-cursors-and-watch.md) — the attach mechanism.
- [ADR 0027 — Cloud-native arc](./0027-cloud-native.md) — the run-entry funnel, the awaiting-approval resume, the crash-orphan recovery, and the resource inventory this ADR adds to.
- [ADR 0075 — Fire-result delivery](./0075-fire-result-delivery.md) — the scheduled-fire drain pattern this ADR reuses.
- [`docs/architecture.md`](../architecture.md) — the living reference.
