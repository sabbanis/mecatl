# Detached runs — acceptance plan

**Phase:** remote connect — leave it running
**Status:** landed, 2026-09-01. Synthesised from the design discussion on connect-and-leave-running for mecatui ↔ remote mecated.
**Issue:** [stacklok/mecatl#NNN](https://github.com/stacklok/mecatl/issues/NNN) (to be created).
**ADR:** [ADR-0278](../adr/0278-detached-runs.md) — pins the detach-on-Ctrl+C + control-only-Converse + WatchSessionEvents-reattach decisions.
**Accumulator branch:** `acc/detached-runs` (off `main`).

The smallest set of work that lets a user **connect mecatui to a remote mecated, submit a prompt, walk away (Ctrl+C), and come back later to find the run still going** — so "start a long task, close the laptop, check it tomorrow" works without the user remembering session IDs, flags, or which mode they're in.

**The e2e flow this plan delivers:** the operator runs `mecatui connect ADDRESS` → types a prompt → the run starts → they press Ctrl+C → mecatui exits, the run continues server-side → they come back later, run `mecatui connect ADDRESS` again → the tool auto-reattaches to the running session, replays what they missed, and follows live. If any link in that chain is missing, the feature is not usable and does not ship.

The doc is organized scenario-first because acceptance is about what the running harness can demonstrate, not which packages exist on disk.

## Why these scope cuts

- [ADR-0250](../adr/0250-durable-cursors-and-watch.md) — `WatchSessionEvents` already does durable replay-then-follow with cursors; it is the attach mechanism, not a new RPC.
- [ADR-0027](../adr/0027-cloud-native.md) Phase 2 — `resumeFromAwaiting` already re-enters a dead run at a pending ask; a detached run that parks awaiting is the same case.
- [ADR-0027](../adr/0027-cloud-native.md) Phase 6 — `Abandon` + `startStaleSessionReconcile` already settle a crash-orphaned `running` session; a crashed detached run is the same case.
- The Converse bidi stream already couples driving + observation; the fix is a `detach` field on the existing `Prompt` message, not a new RPC.
- The `Cancel` and `ResumeApproval` messages already exist as Converse control frames; a control-only Converse stream (first frame = cancel/approve, not prompt) reuses them with zero new messages.

## In scope — 5 scenarios, in 3 waves

Scenarios are grouped into 3 waves. Each is independently demoable; later waves assume earlier ones but don't change their acceptance criteria.

- **Wave 1 — server surface (Scenarios 1–2):** the server accepts a detached prompt, owns the drain goroutine, and the run survives client disconnect.
- **Wave 2 — client surface (Scenarios 3–4):** mecatui submits detached, detaches on Ctrl+C, and auto-reattaches on reconnect.
- **Wave 3 — control + guardrails (Scenario 5):** cancel/approve via control-only Converse, posture gating, deadline, concurrency bound.

Waves 1 + 2 deliver the full e2e for the operator's actual usage and are the ship-gate. Wave 3 extends it with control and hardening; it lands on the same accumulator but is sequenced last.

### Scenario 1 — Detached prompt on the existing Converse stream

The client sends a `Prompt` frame with `detach: true` on the Converse bidi stream. The server starts the run via the existing `StartRunContent` path, spawns a server-owned drain goroutine (the `scheduler_fire.go:199-213` pattern), sends a single ack event, and closes the stream cleanly. The run continues server-side; the durable event log records every event including the terminal `EvResult`.

**The drain goroutine is the one new piece.** It lives on the Service (analogous to how `heldLeases` / renewers live there), drains `run.Events()` through the existing `RunEventRecorder` with a cancel-detached ctx, breaks on terminal `EvResult`, and calls `FinishRun`. It is inventoried in [ADR-0027](../adr/0027-cloud-native.md) List 1.

**Work:**
- contracts (`contracts/proto/mecatl/v1/harness.proto`): add `bool detach = 4` to the existing `Prompt` message (additive; older servers ignore it → attached behavior, byte-identical).
- adapters (`internal/adapter/server/grpc.go`): the Converse handler, when `first.GetPrompt().GetDetach()` is true, calls `StartRunContent`, spawns the drain goroutine, sends an ack, and returns nil (stream closes). When `detach` is false: the existing relay path, byte-identical.
- adapters (`internal/adapter/server/service.go`): a `StartDetachedRunContent` method that wraps `startRunContent` + spawns the drain goroutine. Reuses `runPurposeChat` — a detached run is a normal chat run, just drained server-side.
- composition (`internal/app`): no change — `app.Build` already wires everything the drain needs (the `*server.Service`).
- docs: the drain goroutine is inventoried in [ADR-0027](../adr/0027-cloud-native.md) List 1 (owner: `Service`; scope: per detached run; cleanup: `FinishRun` on terminal / `Service.Close` cancels all in-flight runs). List 2 needs no new row — a crashed detached run leaves a `running` snapshot handled by the existing `Abandon` seam + `startStaleSessionReconcile`.

**Acceptance:**
- AC1.1: A `Prompt` with `detach: true` starts a run that continues after the Converse stream closes. The durable event log records the terminal `EvResult`.
  - verify: `TestDetachedRun_Scenario1_DetachedRunSurvivesStreamClose`
- AC1.2: A `Prompt` with `detach: false` (or absent) behaves exactly as today — the run is cancelled on stream break.
  - verify: `TestDetachedRun_Scenario1_AttachedRunCancelledOnStreamClose`
- AC1.3: The drain goroutine calls `FinishRun` on terminal `EvResult`, releasing the run from the registry.
  - verify: `TestDetachedRun_Scenario1_DrainGoroutineFinishesRun`
- AC1.4: `Service.Close` cancels all in-flight detached runs (the drain goroutine joins on close).
  - verify: `TestDetachedRun_Scenario1_ServiceCloseCancelsDetachedRuns`
- AC1.5: The drain goroutine uses a cancel-detached ctx for the durable log (a dead client never stops the log).
  - verify: `TestDetachedRun_Scenario1_DetachedLogSurvivesClientDisconnect`

---

### Scenario 2 — Control-only Converse stream (cancel/approve without a prompt)

A client that detached from a running session needs to cancel or approve without submitting a new prompt. The Converse handler currently requires the first frame to be `prompt` or `retry`. Relax it to also accept `cancel` or `resume_approval` as the first frame — a **control-only Converse stream**.

**Why this is better than new unary RPCs:** zero new proto RPCs, zero new messages — the `Cancel` and `ResumeApproval` messages already exist. The Converse bidi handler already has the `streamSender` gate, the `readControl` goroutine, the relay machinery — all reusable. A control-only stream is just a Converse stream that skips the run-start phase and goes straight to control.

**The `session_id` problem:** `Cancel` and `ResumeApproval` don't carry `session_id` themselves (it comes from the `Prompt`/`RetryStart` first frame today). For a control-only stream, we need the session id from somewhere. Add `string session_id = 1` to `Cancel` and to `ResumeApproval` (additive field; existing clients leave it empty and the server infers it from the run context as today).

**Work:**
- contracts (`contracts/proto/mecatl/v1/harness.proto`): add `string session_id = 1` to `Cancel` and to `ResumeApproval` (additive; existing clients unaffected).
- adapters (`internal/adapter/server/grpc.go`): the Converse handler's first-frame switch gains two arms: `first.GetCancel() != nil` → call `Service.Cancel(ctx, sessionID, expectedRunID)` directly, send an ack, return. `first.GetResumeApproval() != nil` → call `Service.ApproveRun(ctx, sessionID, askID, verdict, expectedRunID)`, relay the resumed run if it returns one (the rehydrate path), else ack and return.
- The HTTP side already has `POST /v1/sessions/{id}/cancel` and `/approve` as unary endpoints — no change needed there.

**Acceptance:**
- AC2.1: A Converse stream whose first frame is `cancel` with a valid `session_id` cancels the session's in-flight run and returns an ack.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyCancel`
- AC2.2: A Converse stream whose first frame is `resume_approval` with a valid `session_id` resolves the paused ask; if the run was dead (rehydrate path), the resumed run's events are relayed on the stream.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyApprove`
- AC2.3: A Converse stream whose first frame is `cancel` or `resume_approval` with an empty `session_id` is rejected with `InvalidArgument`.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyRequiresSessionID`
- AC2.4: A Converse stream whose first frame is `cancel` or `resume_approval` for a session with no in-flight run returns `FailedPrecondition` (the existing `ErrNoActiveRun` / `ErrSessionLeasedElsewhere` discipline).
  - verify: `TestDetachedRun_Scenario2_ControlOnlyNoActiveRun`
- AC2.5: The existing `prompt`/`retry` first-frame paths are byte-identical (no regression).
  - verify: `TestDetachedRun_Scenario2_ExistingFirstFramePathsUnchanged`

---

### Scenario 3 — Seamless reattach (the tool remembers, the user forgets)

The user runs `mecatui connect ADDRESS` with no flags. The tool reads a persisted last-session pointer for this server target, checks the session's state, and auto-branches: running → reattach via `WatchSessionEvents` (replay from cursor, then follow live); idle/terminal → resume as today; none → start fresh. The user never types a flag, never remembers a session ID.

**The persisted pointer** lives in `~/.local/state/mecatui/sessions.yaml` (a sibling to the existing `models.yaml`), keyed by connect target, storing `last_session` + `last_seen` + `state`. It reuses the exact `selectionStore` infrastructure: fail-soft read, atomic write, 0o600, O_NOFOLLOW symlink guard.

**The auto-branch** bypasses the existing `startupResumeEligible` conservative exclusion of `running` sessions — the no-flag default path goes through the persisted pointer → `GetSession` → state-branch, not through the session listing. The listing path is the fallback when no pointer exists, and there it lists `running` sessions with a "reattach" affordance (distinct from "continue").

**Work:**
- client (`cmd/mecatui/state.go`): a new `sessions.yaml` sibling to `models.yaml`, keyed by connect target, storing `last_session` + `last_seen` + `state`. Written on detach and on session switch. Read on `mecatui connect ADDRESS`.
- client (`cmd/mecatui/startup_resume.go`): the no-flag default path reads the persisted pointer, calls `GetSession(id)`, and branches on state. The `--resume <id>` flag also auto-branches (reattach if running, resume if idle/terminal). The `--resume-latest` flag's eligibility expands to include `running` sessions (reattach) when the server supports detached runs. A new `--new` flag forces a fresh session.
- client (`cmd/mecatui/client/`): a `WatchSessionEvents` wrapper + `WatchCmd`/`ReconnectWatchCmd` siblings to `LiveStreamCmd`/`ReconnectLiveCmd` that consume `WatchEnvelope`s (carrying `Event`, `Cursor`, `Phase`) and thread the cursor for reconnect.
- TUI (`cmd/mecatui/ui/`): new Model state fields (`watchCh`/`watchGen`/`watchStop`/`watchCursor`/`watchArmed`/`detached`) + a new `phaseFollowing` (read-only live view of a server-owned detached run). The `updateWatchMsg`/`armWatch`/`disarmWatch` reducers parallel `updateLiveMsg`/`armLiveFeed`.
- TUI (`cmd/mecatui/ui/sessions_surface.go`): `● running` badge for sessions in `StateRunning`; `enter` on a running row = reattach (same auto-branch).

**Acceptance:**
- AC3.1: `mecatui connect ADDRESS` with no flags, when a last-session pointer exists and the session is `running`, auto-reattaches via `WatchSessionEvents` (replay from cursor `""`, then follow live). The user sees `⟳ reattaching to running session…` during replay, then the live spinner.
  - verify: `TestDetachedRun_Scenario3_AutoReattachToRunningSession`
- AC3.2: `mecatui connect ADDRESS` with no flags, when a last-session pointer exists and the session is `idle`/`completed`/`cancelled`/`failed`, resumes as today (load transcript, enter idle phase).
  - verify: `TestDetachedRun_Scenario3_AutoResumeIdleSession`
- AC3.3: `mecatui connect ADDRESS` with no flags, when no last-session pointer exists, falls through to the existing `--resume-latest`-style session listing (now including `running` sessions as reattach candidates). If none exist, starts fresh.
  - verify: `TestDetachedRun_Scenario3_NoPointerFallsThroughToListing`
- AC3.4: `mecatui connect ADDRESS --new` forces a fresh session even if a running one exists.
  - verify: `TestDetachedRun_Scenario3_NewFlagForcesFresh`
- AC3.5: The persisted pointer is written on detach and on session switch, and read on connect. It is fail-soft (a corrupt/missing file degrades to the listing path).
  - verify: `TestDetachedRun_Scenario3_PointerPersistedAndRead`
- AC3.6: The `WatchSessionEvents` replay→live boundary marker (`WatchPhaseReplay` → `WatchPhaseLive`) drives a `⟳ replaying N events…` footer indicator during replay, then switches to the normal live spinner.
  - verify: `TestDetachedRun_Scenario3_ReplayToLiveIndicator`

---

### Scenario 4 — Ctrl+C detaches; double Ctrl+C cancels

The user presses Ctrl+C while watching a running detached session. The first Ctrl+C detaches (closes the watch stream, keeps the run, prints the one-line "run continues" message, quits). The second Ctrl+C cancels the run (sends a control-only Converse `cancel` frame) and exits. This reuses the existing two-signal handler shape: first signal = graceful (detach), second signal = force (cancel + exit).

**The behavior is determined by the server's capability**, not the user's mode awareness. When the server advertises `ServerCapabilities.detached_runs`, Ctrl+C always detaches. When it doesn't (older server, or `--detached-runs` off), Ctrl+C cancels the run (today's behavior). Embedded mode: Ctrl+C kills the process (the server dies with it) — today's behavior, unchanged.

**Work:**
- TUI (`cmd/mecatui/main.go`): the signal handler checks the capability bit + a running session. If detached-capable AND a run is active, the first Ctrl+C prints the one-line "run continues" message and quits without cancelling. The second Ctrl+C sends a control-only Converse `cancel` frame and exits. The existing two-signal hard-exit semantics are preserved.
- TUI (`cmd/mecatui/ui/`): the `endRun` path branches on `m.detached` — a detached run whose Converse stream closed does NOT call `endRun`; instead it transitions to `phaseFollowing` (the watch feed is already armed).
- client (`cmd/mecatui/client/`): the submit path forks on capability + connection mode. When `Deps.ConnectionMode == "connect"` AND the server advertises `detached_runs`, `submitPrompt` calls the detached Converse path (Prompt with `detach: true`) instead of the attached Converse path.
- contracts (`contracts/proto/mecatl/v1/harness.proto`): add `bool detached_runs = 26` to `ServerCapabilities`.
- server (`internal/adapter/server/`): the operator-tier gate `mecated --detached-runs` flag (default OFF). When off, the server ignores the `detach` field on the Prompt (treats it as false → attached behavior).

**Acceptance:**
- AC4.1: Ctrl+C on a detached-capable server with a running session detaches (closes the watch stream, keeps the run, prints the "run continues" message, quits). The run continues server-side.
  - verify: `TestDetachedRun_Scenario4_CtrlCDetaches`
- AC4.2: Double Ctrl+C on a detached-capable server with a running session cancels the run (sends a control-only Converse `cancel` frame) and exits.
  - verify: `TestDetachedRun_Scenario4_DoubleCtrlCCancels`
- AC4.3: Ctrl+C on a non-detached-capable server (older server, or `--detached-runs` off) cancels the run (today's behavior, byte-identical).
  - verify: `TestDetachedRun_Scenario4_CtrlCCancelsOnNonDetachedServer`
- AC4.4: Ctrl+C in embedded mode kills the process (the server dies with it) — today's behavior, unchanged.
  - verify: `TestDetachedRun_Scenario4_CtrlCKillsEmbedded`
- AC4.5: The `ServerCapabilities.detached_runs` bit is advertised by the server and gates the client's detach affordance. An older server without it → the existing Converse path, byte-identical.
  - verify: `TestDetachedRun_Scenario4_CapabilityGatesDetach`

---

### Scenario 5 — Security guardrails + hardening

A detached run executes tools with no client watching. The guardrails are: posture gating (detached runs allowed under strict/trusted/auto; WARN or refuse under yolo), permission asks park awaiting (no auto-approve), a mandatory wall-clock deadline (the "forgot to come back" bound), and a server-wide concurrency gate (prevents resource exhaustion).

**Work:**
- server (`internal/adapter/server/service.go`): the detached-run path applies the session's existing `Limits` (MaxTurns/MaxToolCalls) + an optional wall-clock deadline (a `time.AfterFunc` that calls `s.Cancel` on lapse, mirroring `scheduler_fire.go:169-179`).
- server (`internal/adapter/server/service.go`): a server-wide detached-run concurrency gate (a counting semaphore, mirroring `childGate`, `defaultMaxConcurrentChildren=8`) acquired at detached-run start, fail-fast when full. Operator-configurable cap (`--max-detached-runs`, default ~4).
- composition (`internal/app/posture.go`): detached runs are allowed under `strict`/`trusted`/`auto`. Under `yolo`, a detached run is a loud WARN or refused — detachment removes the last human checkpoint that `yolo` implicitly assumes is present.
- The `modelhook` `PreToolUse` enforcement is wired into the engine, not the stream. A `PreToolUse` Block fires on a detached run and stops it. Operator-tier-only guardrail config preserves — a project file cannot weaken it.

**Acceptance:**
- AC5.1: A detached run under `yolo` posture is refused (or WARNs loudly) — detachment removes the last human checkpoint.
  - verify: `TestDetachedRun_Scenario5_YoloDetachedRefused`
- AC5.2: A detached run that hits a main-session mutating ask parks awaiting (the existing `PauseForApproval` behavior). It does NOT auto-approve. A reconnecting client resolves the ask via the existing `resumeFromAwaiting` path.
  - verify: `TestDetachedRun_Scenario5_DetachedAskParksAwaiting`
- AC5.3: A detached run with a wall-clock deadline is cancelled on lapse (`s.Cancel` + persist the terminal snapshot).
  - verify: `TestDetachedRun_Scenario5_DeadlineCancelsDetachedRun`
- AC5.4: The server-wide detached-run concurrency gate refuses a new detached run when the cap is reached (fail-fast, ids only).
  - verify: `TestDetachedRun_Scenario5_ConcurrencyGateRefuses`
- AC5.5: The `modelhook` `PreToolUse` enforcement fires on a detached run and stops it (the block degrades to a terminal block headless).
  - verify: `TestDetachedRun_Scenario5_GuardrailBlocksDetachedRun`

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| Steer while detached | a later wave | [ADR-0232](../adr/0232-steer-while-running.md) — steer rides the Converse control frame; a detached run needs the unary path (a new `SteerRun` RPC or a control-only Converse `steer` frame) |
| Retry while detached | a later wave | [ADR-0239](../adr/0239-semantic-stream-retry.md) — `RetryStart` is a first-frame option; a detached retry is the same shape as a detached prompt |
| Server-crash auto-resume | never | [ADR-0027](../adr/0027-cloud-native.md) Phase 6 — a crashed detached run is a `running` snapshot handled by `Abandon` + `startStaleSessionReconcile`; the user retries. Same residual scheduled fires have. |
| Embedded-mode detach | never | The embedded server dies with mecatui; detach is meaningless there. |
| Auto-approve on detached runs | never | A detached run that hits a main-session mutating ask parks awaiting; auto-approve is explicitly NOT in v1. |

## Cross-cutting deliverables

- `task generate` for the proto changes (`Prompt.detach`, `Cancel.session_id`, `ResumeApproval.session_id`, `ServerCapabilities.detached_runs`).
- `task api:update` — no engine public-API change (the drain goroutine is Service/composition, not engine). The `Prompt.detach` field is a proto change, not an engine API change.
- `docs/architecture.md` + `docs/design/IMPLEMENTATION-NOTES.md` updated for the detached-run channel; `task docs` regenerates `llms.txt`.
- The outlives-a-call resource inventory ([ADR-0027](../adr/0027-cloud-native.md) **List 1**) gains the drain goroutine row. **List 2** needs no new row — a crashed detached run leaves a `running` snapshot handled by the existing `Abandon` seam + `startStaleSessionReconcile`.
- `user-docs/building/deployment/mecated.md` updated for the `--detached-runs` flag and the security note.

## Sequencing recommendation

Three waves on the same accumulator, in order.

**Wave 1 — server surface (Scenarios 1–2).** Scenario 1 (the detached prompt + drain goroutine) unblocks everything. Scenario 2 (the control-only Converse stream) is independent and can land in parallel.

**Wave 2 — client surface (Scenarios 3–4).** Depends on Wave 1's detached run existing. NOT optional: it is the only wave that makes the feature *usable* by the operator. The auto-reattach + Ctrl+C-detach is the actual product.

**Wave 3 — control + guardrails (Scenario 5).** The hardening wave: posture gating, deadline, concurrency bound. Sequenced last because it is additive to a working product.

## Named tests landing in this plan

`TestDetachedRun_Scenario1_*`, `TestDetachedRun_Scenario2_*`,
`TestDetachedRun_Scenario3_*`, `TestDetachedRun_Scenario4_*`,
`TestDetachedRun_Scenario5_*`.

## Definition of done

1. `task lint` and `task test` pass (both modules, `-race`).
2. `task docs` — `llms.txt` regenerated and the matlatl strict link gate green.
3. `task api:check` passes (no engine public-API change).
4. `task ac-trace-strict` — every AC's `verify:` proof resolves (this plan is `landed`).
5. The named tests are green and grep-locatable by their identifiers.
6. `go run ./cmd/mecademo` still prints a full offline session.
7. **The e2e is demoable:** `mecatui connect ADDRESS` → submit a prompt → Ctrl+C → the run continues server-side → `mecatui connect ADDRESS` again → auto-reattach, replay, follow live. If this is not green, the plan is NOT satisfied.

## Deferred decisions and known risks

- **The drain goroutine is the load-bearing server novelty.** It reuses the `scheduler_fire.go:199-213` pattern, but it is a new Service-owned goroutine whose lifecycle must be bounded (joins on `Service.Close`, cancels on terminal `EvResult`). The inventory row in [ADR-0027](../adr/0027-cloud-native.md) List 1 is the visible decision.
- **The control-only Converse stream is the load-bearing wire novelty.** Relaxing the first-frame rule is a small change, but it touches the `Converse` handler's most sensitive path (the run-start switch). The existing `prompt`/`retry` paths must be byte-identical.
- **The auto-reattach is the load-bearing UX novelty.** The persisted pointer + state-branch is a new startup path that bypasses the existing `startupResumeEligible` conservative exclusion. The `--resume`/`--resume-latest` flags keep their existing semantics; the no-flag default is the new path.
- **Server crash is the honest residual.** A crashed detached run leaves a `running` snapshot handled by `Abandon` + `startStaleSessionReconcile`; the user retries. This is the same residual scheduled fires have — stated, not papered over.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, this plan is satisfied.
