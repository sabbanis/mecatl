# CLAUDE.md — Mecatl Studio

The web client for the mecatl harness: a Next.js app (App Router) serving the
Atrium workspace — Chats · Scheduled · Skills · Memory · Settings — against a
`mecated` daemon. See ADR 0228 (module + posture) and ADR 0229 (server-backed
chats).

## Commands

Run through the root Taskfile, not bare npm:

```sh
task build          # repo root first — studio's managed mode spawns ../bin/mecated
task studio:dev     # start Studio + its mecated supervisor (background; logs in studio/dev.log)
task studio:stop    # stop web server + controller + the mecated it supervises
task studio:test    # vitest run + the hermetic server-tier suite (builds first)
task studio:lint    # biome
task studio:typecheck
```

`npm run dev` = managed mode via `scripts/dev-local.mjs` (controller on :8788,
web on :3000). `npm run dev:web` = bare `next dev` (external mode or against an
already-running controller). Setting `MECATL_BASE_URL` selects external mode.
The hermetic suite (`npm run test:server`) builds Next first — a stale build is
the usual reason it fails mysteriously.

## Module shape

- `src/lib/protocol/` — the ONLY reader of raw daemon JSON: event decode +
  StreamEvent translation, session inventory/transcript decoders, schedule
  decode/encode. Generated TS proto bindings are deferred; this seam plus its
  vitest suite is the stopgap.
- `src/lib/harness/client.ts` — browser transport: fetch + SSE buffering +
  stream robustness (120s idle timeout, saw-result guard).
- `src/lib/server-proxy.ts` + `src/app/api/mecatl{,-control}/[...path]` — the
  server tier: origin trust, header allowlists, bearer + workspace injection,
  external-mode 409 policy.
- `scripts/local-controller.mjs` — managed-mode sidecar (supervises `mecated`,
  owns model-router/MCP-gateway config + OAuth); policy helpers in
  `src/lib/controller-security.mjs`.
- `src/features/agent/` — runtime-status provider + the daemon-backed hooks;
  `src/app/workspace/**` — the five surfaces.

## Rules that have teeth

Each rule is backed by a test; break the rule and its test names you.

1. **Daemon-only: an unreachable daemon renders offline, never demo data.**
   There are no fixtures to fall back to — do not add any.
   (`tests/rendered-html.test.mjs`: unreachable daemon → friendly 503.)
2. **The workspace is resolved, never hardcoded and never browser-supplied.**
   Managed: controller `/status`; external: `MECATL_WORKSPACE`; injected
   server-side into session/team/schedule creation.
   (hermetic: session creation carries the deployment workspace.)
3. **Credentials never cross the browser/controller boundary.** No key-paste
   UI anywhere; `mecated` reads `~/.config/mecatl/auth.yaml`. The proxy's
   header allowlist excludes `authorization` from the browser.
   (hermetic: bearer injected server-side.)
4. **Controller mutations are server-only.** They require the server-set
   `x-mecatl-studio-request` header, a loopback Host, and an allowlisted
   Origin. (hermetic: CSRF/DNS-rebinding truth table.)
5. **External mode owns nothing locally.** Every control write answers 409.
   (hermetic: control writes 409.)
6. **A failed turn renders as failed.** `result.stop === "error"` with no text
   must never become a quiet success — the run_result event always reaches the
   UI. (`src/lib/protocol/events.test.ts`.)
7. **Unknown event kinds are surfaced, never dropped.** A new daemon
   capability shows up as "not rendered yet". (`events.test.ts`.)
8. **The memory panel is read-only.** A value typed into the UI would land in
   turn-0 context bypassing injection scanning; the daemon has no write API by
   design. Do not add an editor.
9. **Session rows obey the store.** Eligibility comes from row capabilities
   (omitted = denied); a row is removed only by a complete inventory walk or a
   404; renames adopt the daemon's clamped echo.
   (`src/lib/protocol/sessions.test.ts` + `use-agent-sessions`.)
10. **Schedule PUT replaces the whole spec.** Fields the form cannot edit ride
    the row's `carried` spec and are re-encoded, or they are silently deleted.
    (`src/lib/protocol/schedules.test.ts`: carried round-trip.)
11. **Requests are protojson; responses are stdlib JSON.** Never echo a decoded
    response back as a request body. (`schedules.test.ts`: the asymmetry test.)
12. **Skills are project-scoped only.** The controller pins `--skills-dir` and
    never passes `--skills-conventional`.

## Gotchas

- `npm test` runs vitest in watch mode; CI and `task studio:test` use
  `npx vitest run` + `npm run test:server`.
- The controller restarts `mecated` on every config write; in-flight runs and
  session ids die with it. Surfaces warn before writes that restart.
- FireNow (`POST /v1/schedules/{name}/fire`) is synchronous — the request lasts
  the whole agent run.
- Live re-attach to a running session is impossible over HTTP today
  (`StreamSessionLive` is gRPC-only): show running state from the inventory,
  read the transcript at the end.
