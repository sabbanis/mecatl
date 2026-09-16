# CLAUDE.md — Mecatl Studio

The web client for the mecatl harness: a Next.js app (App Router) serving the
Atrium workspace — Chats · Scheduled · Skills · Memory · Settings — against a
`mecated` daemon. See ADR 0345 (module + posture) and ADR 0346 (server-backed
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

- `@stacklok-oss/mecatl-sdk` (source `../sdk/typescript`, a `file:` dependency
  — `task studio:install` and CI build it before `npm ci`) — the ONLY reader
  of the daemon wire. Studio consumes the daemon exclusively through the SDK's
  HTTP transport pointed at the same-origin `/api/mecatl` proxy; the SDK owns
  generated proto bindings, SSE run/watch decoding, and unknown-event forward
  compatibility. `src/lib/harness/` adapts SDK values to Studio's view models
  (`sdk.ts` builds the client). Controller calls are NOT in the SDK.
- `src/lib/server-proxy.ts` + `src/app/api/mecatl{,-control}/[...path]` — the
  server tier: origin trust, header allowlists, bearer injection (auth ONLY —
  daemon bodies and queries are forwarded verbatim), external-mode 409 policy.
- `scripts/local-controller.mjs` — managed-mode sidecar (supervises `mecated`,
  owns model-router/MCP-gateway config + OAuth, the permissions document
  — operator posture / project trust / shell-less mode — as mecated spawn
  flags via `GET|POST /permissions`, the session-store location via
  `POST /storage`, the retention policy via `POST /retention`, and the
  daemon defaults — default/subagent model per provider, reasoning effort,
  context window, prompt caching, base-URL overrides, ToolHive LLM gateway,
  aliases/slots, credentials-file path, plus the durable active-provider
  choice — as spawn flags via `GET|PUT /daemon-defaults`); policy helpers in
  `src/lib/controller-security.mjs`, the flag grammars in
  `src/lib/controller-permissions.mjs` and `src/lib/daemon-defaults.mjs`.
- `src/features/agent/` — runtime-status provider + the daemon-backed hooks;
  `src/app/workspace/**` — the five surfaces.

## Rules that have teeth

Each rule is backed by a test; break the rule and its test names you.

1. **Daemon-only: an unreachable daemon renders offline, never demo data.**
   There are no fixtures to fall back to — do not add any. The one sanctioned
   exception is the explicit, default-off, clearly-labeled Labs mock content
   (Settings → Labs → "Show mock features", `src/features/agent/mock-tour.ts`)
   — an opt-in demo the user turns on, never a fallback for an unreachable
   daemon.
   (`tests/rendered-html.test.mjs`: unreachable daemon → friendly 503.)
2. **Session placement is server-owned; Studio never sends a workspace.**
   The daemon binds every session to its deployment's environment (ADR 0291)
   and decodes `POST /v1/sessions` with unknown fields disallowed, so the
   proxy forwards create bodies verbatim — no `workspace` injection into
   session/team/schedule creation, no `?workspace=` on `/v1/commands` (it is
   keyed by `session_id`). `MECATL_WORKSPACE` (external) and the controller's
   `/status` `workspace` are display-only labels.
   (hermetic: session creation is forwarded verbatim.)
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
   must never become a quiet success — the SDK's terminal `result` event
   always reaches the UI.
7. **Unknown event kinds are surfaced, never dropped.** The SDK decodes a new
   daemon event kind as a typed unknown; Studio shows it as "not rendered
   yet".
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
13. **Posture, project trust and shell-less mode are spawn FLAGS, never a
    settings.yaml key.** Settings → Permissions saves a Studio-owned
    `permissions.json`; the controller turns it into `--posture <tier>`
    (ALWAYS passed, strict included, so Studio's tier out-ranks an imported
    operator settings file's `posture:` in both directions),
    `--trust-project` and `--no-shell`, and never `--headless` (mecated
    raises the trust floor for trusted+ on interactive roots — the page's
    "implied by the posture" claim depends on it). The daemon-wide posture is
    NOT the composer's per-session Mode; the EFFECTIVE tier is
    `serverCapabilities.posture` (capability-gated: absent on an older
    daemon). External mode: `permissions: null`, every `/permissions` verb
    409. (`src/lib/controller-permissions.test.ts`,
    `permissions-section.test.tsx`, hermetic 409 + CSRF rows.)
14. **The session store is a spawn FLAG too, never a settings.yaml key, and
    in-memory means NO flag.** Settings → Storage saves a Studio-owned
    `storage-settings.json` (seeded from `MECATL_STUDIO_STORE_DIR` /
    `MECATL_STUDIO_NO_STORE=1`); the controller turns a durable store into
    `--store-dir <absolute>` right after `--workspace` (relative paths resolve
    under the controller's workspace, the dir is created first) and an
    in-memory store into the ABSENCE of the flag (mecated has no `--no-store`).
    `/status.storage` reports the saved AND default location; external mode:
    `storage: null`, `POST /storage` 409. The card never invents a path an
    older controller did not report. (`src/lib/storage-settings.test.ts`,
    `store-location.test.ts`, `session-storage-section.test.tsx`, hermetic
    409 + CSRF rows.)
15. **Retention is spawn FLAGS too, and main-chat deletion needs the
    acknowledgement — in Studio AND in mecated.** Settings → Storage →
    Retention saves a Studio-owned `retention.json`; the controller turns
    each SET field into its mecated flag (`--main-retention`,
    `--child-retention`, `--schedule-fire-retention`, their count caps,
    `--child-gc-interval` for the sweep cadence, `--acknowledge-main-retention`)
    and a null field into NO flag (mecated's default stands). Durations are
    Go grammar — no `d`. A non-zero main age/count without
    `acknowledgeMainDeletion: true` is refused by the controller (400) before
    the restart mecated would fail; child/scheduled limits need no
    acknowledgement. No flags at all while an imported operator settings
    file is active (`managedBy: "operator-settings"`, `POST /retention` 400).
    The EFFECTIVE policy the card shows is the daemon's own
    `GET /v1/storage/health` (`policy`, `last/next_sweep_unix`), never the
    saved document. External mode: `retention: null`, `POST /retention` 409.
    (`src/lib/retention-settings.test.ts`, `harness/retention.test.ts`,
    `harness/storage.test.ts`, `retention-section.test.tsx`, hermetic 409 +
    CSRF rows.)
16. **Daemon defaults are spawn FLAGS, keyed per provider, and the active
    provider is durable.** Settings → Model provider → "Daemon defaults" (and
    the provider page's "Make daemon default" kebab, the Add dialog's "Save
    override") save a Studio-owned `daemon-defaults.json`; the controller
    turns it into `--default-model`/`--subagent-model` (the pair saved for
    the SPAWN kind only — mecated validates them against the current default
    provider fail-fast, so a stale pair must never ride a provider switch;
    never for `--mock`), `--reasoning-effort`, `--context-window-override`,
    the two LLM stream bounds `--llm-per-attempt-timeout` /
    `--llm-stream-idle-timeout` (Go durations, `"600s"`; emitted ONLY when
    they differ from mecated's own 300 s / 180 s — 0 is a real "disabled",
    never "unset"; `LLM_TIMEOUT_DEFAULTS` in `daemon-defaults.mjs`),
    `--no-prompt-cache`, `--anthropic-cache-ttl`, `--<kind>-base-url`,
    `--toolhive-llm=false`/`--toolhive-llm-base-url`/`--toolhive-llm-mode`,
    repeated `--model-alias`/`--model-slot` (the `router` slot stays the
    Model router page's), and `--api-key-file` (a `.yaml` INSIDE the mecatl
    config dir — the controller reads and rewrites that file for the
    provider routes, so the path is confined). A refused start rolls the
    previous document back and returns mecated's own refusal. `POST
    /providers/active` persists the choice (`MECATL_STUDIO_PROVIDER` still
    wins at boot; a saved kind that is no longer selectable is dropped, and
    `DELETE /providers/{name}` clears it); "Switch to offline mock" is the
    explicit `--mock`. `GET /daemon-defaults` is header-free read-only like
    `/status`; the PUT is not. External mode: `daemonDefaults: null`, both
    verbs 409. (`src/lib/daemon-defaults.test.ts`,
    `controller-security.test.ts`, `harness/daemon-defaults.test.ts`,
    `use-daemon-defaults.test.ts`, `daemon-defaults-card.test.tsx`,
    `provider-section.test.tsx`, hermetic 409 rows.)
17. **Diagnostics options are spawn FLAGS with ONE writer per flag, and the
    posture is not one of them.** Settings → Diagnostics reads the
    daemon-REPORTED `serverCapabilities.posture` and spells out the four
    defenses that tier switches on (`src/lib/posture.ts` mirrors mecatui's
    `/posture` sentence byte-for-byte); changing the tier stays the
    Permissions page's job (`--posture` has exactly one writer). The
    controller's DIAGNOSTICS document (`diagnostics-options.json`, `GET|POST
    /diagnostics-options`, a PARTIAL patch body, both verbs behind the studio
    header) becomes `--log-level`, an EXPLICIT `--metrics-addr` in both
    directions (`--metrics-addr=` while the admin listener is off — mecated's
    default is a fixed loopback port two managed daemons would fight over),
    `--perf-mcp` only with a real listener address, `--goroutine-warn-
    threshold`, `--product-metrics=false`/`--product-metrics-dry-run` (never
    `=true`: the controller's env opt-out — `DO_NOT_TRACK`,
    `MECATL_PRODUCT_METRICS` — stays the operator's and is reported as
    `productMetrics.source: "environment"`); `quiet` only gates the
    controller's stderr mirror and restarts nothing. The controller is
    also the daemon's LOG FILE (mecatui's embedded-server log, ported):
    mecated has no log-file flag, so the process holding its stderr appends
    it to `studio/.scratch/mecated.log` (0600, ONE rotated generation
    `mecated.log.1` at mecatui's 10 MiB bound, `src/lib/controller-log.mjs`)
    and a bounded in-memory ring; `GET /logs?lines=` serves the tail + file
    facts + `startupError`, `GET /logs/download` streams the file (both
    studio-header-gated, 409 in external mode). The content is
    model-influenced, so `daemon-log-card.tsx` renders it as plain text
    only. Names are deliberately
    distinct from the (separate) daemon-options document:
    `diagnosticsOptions`, `diagnosticsOptionArgs`. External mode: both verbs
    409. (`src/lib/controller-diagnostics-options.test.ts`,
    `src/lib/posture.test.ts`, `harness/diagnostics.test.ts`,
    `use-diagnostics-options.test.ts`, `posture-card.test.tsx`, hermetic 409
    rows, the Playwright diagnostics test.)
18. **Storage maintenance is DAEMON-owned, capability-gated, and the
    destructive step is typed-confirmed.** Settings → Storage ends in three
    cards that talk to mecated ONLY through the SDK's `client.storage`
    namespace (`src/lib/harness/storage.ts` — no controller document, no
    spawn flag, nothing to roll back): Storage health (`GET
    /v1/storage/health`, gated on `serverCapabilities.storage_health`, a
    note when absent), Optimize storage (`/v1/storage/migrations/*`: plan →
    apply → poll/cancel/resume, gated on `storage_migration`) and Clean up
    sessions (`/v1/storage/cleanup:plan` → `cleanup:apply` →
    `/v1/storage/cleanup/jobs/*`, gated on `storage_cleanup`); an ungated
    card renders nothing. A running job is polled every
    `JOB_POLL_INTERVAL_MS` (2 s) by `useStorageMaintenance`, stopped on a
    terminal state and on unmount, and health is re-read when it settles.
    Clean-up ticks every kind BUT `main` by default, applies with the PLAN's
    `confirmationToken` (never a client-minted one) behind `useTypedConfirm`,
    whose confirm enables only when the field equals `CLEAN UP` exactly, and
    a finished job with `deleted > 0` fires `notifySessionsChanged` so the
    sidebar re-walks now. Stable codes are framed in ONE place
    (`storage-maintenance-shared.tsx`): `cleanup_plan_stale` → "plan again"
    with a Re-plan button, `migration_conflict` → the job already running →
    Refresh health, `management_unauthorized` → read-only copy in either
    card; an unknown code shows the daemon's own message.
    (`harness/storage.test.ts`, `use-storage-maintenance.test.ts`,
    `use-typed-confirm.test.tsx`, the three `storage-*-card.test.tsx`,
    `sessions-changed.test.ts`, the Playwright storage test.)

## Gotchas

- `npm test` runs vitest in watch mode; CI and `task studio:test` use
  `npx vitest run` + `npm run test:server`.
- The controller restarts `mecated` on every config write; in-flight runs and
  session ids die with it. Surfaces warn before writes that restart. Startup
  rides the daemon's ready file (`--ready-file` + an ephemeral `--http-addr`
  + a mkfifo lifetime pipe — Node's stdio "pipe" is a socketpair mecated
  rejects); `/status` reports the ready doc's `apiMajor`/`features`/
  `deployment`.
- `package-lock.json` cannot be regenerated from scratch while the
  `file:../sdk/typescript` link is present: both npm 10 and npm 11 crash in
  arborist (`Cannot read properties of null (reading 'edgesOut')`) walking the
  SDK's pnpm-managed `node_modules`. Keep the committed lock and install
  INCREMENTALLY (`npx -y npm@10.9.4 install`); bump a transitive family that
  peer-pins itself to one exact version (tiptap) through `overrides`, never by
  deleting the lock. `npm audit fix` hits the same crash — bump by hand.
- FireNow (`POST /v1/schedules/{name}/fire`) is synchronous — the request lasts
  the whole agent run.
- Live re-attach to a running session rides the durable watch
  (`GET /v1/sessions/{id}/watch`, ADR 0250; gate on the
  `watch_session_events` feature): SSE `{event, cursor, phase}` envelopes —
  replay from the cursor (empty = the beginning), one event-less
  `phase: "live"` boundary frame, then live follow. The SDK's
  `session.attach()`/`activity()` own the envelope decoding; `use-agent-chat`
  attaches when the inventory reads running/awaiting and Studio is not itself
  driving the run.
  Residual: `POST /prompt` still cancels its run on client disconnect, so a
  reload of the DRIVING tab still ends the run — the watch covers runs
  driven elsewhere (schedules, other tabs/clients) and parked approvals.
- A tool call parked on an MCP browser sign-in (`authorization.required`)
  ENDS the prompt stream without a result; only the authorization controls
  move the run again (`GET …/mcp-authorizations/{id}/presentation`, and the
  BODYLESS `POST …/recheck` / `…/cancel` SSE relays — the daemon 400s any
  body byte; `mcp-authorization-fetch.ts` strips the SDK's `{}`). The
  takeover card (`authorization-panel.tsx`) fetches the URL only when opened
  or copied — it never rides an event — and after an open/copy
  `use-agent-chat` re-checks every 3 s (a 10 s first-event bound per
  control, one control stream at a time so exactly one adopts the
  continuation run; polling stops when the request resolves from any
  stream, on cancel, chat switch, or unmount). Cancel confirms first: it
  fails the parked tool call.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
