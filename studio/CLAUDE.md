# CLAUDE.md — Mecatl Studio

The web client for the mecatl harness: a Next.js app (App Router) serving the
Atrium workspace — Chats · Scheduled · Skills · Memory · Settings — against a
`mecated` daemon. See ADR 0347 (module + posture) and ADR 0348 (server-backed
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

Studio's own build stamp (Settings → Provider → About's `Studio` row, the
`/diagnostics` report's `client build:` line; `src/lib/studio-build.ts`) is
inlined at `next build` by `next.config.ts` (`NEXT_PUBLIC_STUDIO_BUILD` =
`MECATL_STUDIO_BUILD` when the build environment sets it, else
`<package.json version>+<short git sha>`, else `+dev` without a `.git`).
`next start` reports the stamp of the build it serves, not the running
checkout — a bug report wants the build.

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
  choice — as spawn flags via `GET|PUT /daemon-defaults`, and the runtime
  settings — learning mode/sensitivity as a second CLI-tier
  `--permission-config` file carrying the FULL merged `learning:` block,
  the steer opt-out and the soul flags (`--no-steer`, `--no-soul`,
  `--soul-strict`, `--soul-file`, the one-shot `--approve-soul`) as spawn
  flags — via `GET|PUT /runtime-settings` + `POST /soul/approve`); policy
  helpers in `src/lib/controller-security.mjs`, the flag grammars in
  `src/lib/controller-permissions.mjs`, `src/lib/daemon-defaults.mjs` and
  `src/lib/runtime-settings.mjs`; the controller's OWN project-trust
  registry probes — authority + identity anchor mirroring the daemon's
  `workspacetrust` — in the node-only `src/lib/controller-trust.mjs`
  (`/status.trust`, `POST /permissions/trust`, `POST /permissions/trust-once`).
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
   `/status` `workspace` are display-only labels. The one placement CHOICE
   Studio offers — "Switch worktree…" in the chat menu
   (`worktree-picker-dialog.tsx`) — travels as the daemon's OPAQUE
   `worktree_selector` from `GET /v1/worktrees?session_id=`, on ClearSession
   ("Start fresh there") or ForkSession ("Bring this conversation"), never a
   path; a stale selector (412 `placement_selector_*`) relists instead of
   erroring. Gated on `serverCapabilities.worktrees` AND the row's `fork`
   verdict; never offered on the draft, the mock tour or an AI-debug chat.
   (hermetic: session creation is forwarded verbatim; `worktrees.test.ts`,
   `create-body.test.ts`, `worktree-picker-dialog.test.tsx`, the Playwright
   worktree test.)
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
    409. The four tiers are the SDK's `ServerPosture` ladder and nothing
    else — every Studio copy (`POSTURES`, `POSTURE_TIERS`, the picker's
    `POSTURE_OPTIONS`) is pinned to it, in order.
    (`src/lib/controller-permissions.test.ts`,
    `permissions-section.test.tsx`, `posture-vocabulary.test.ts`, hermetic
    409 + CSRF rows, the Playwright external-mode Permissions test.) Project
    trust itself is the controller's OWN registry, never the daemon's:
    mecated never prompts, and Studio cannot reach the Go composition layer
    mecatui's pre-TUI prompt uses, so `src/lib/controller-trust.mjs`
    mirrors the daemon's two probes in JavaScript — `hasProjectAuthority`
    (authority.go: soul / any file under the six anchor dirs / a non-empty
    `permissions.allow` in `.mecatl/settings{,.local}.yaml` or
    `.claude/settings{,.local}.json`) and `trustAnchor` (anchor.go's
    transcript byte-for-byte; permission rules deliberately NOT folded) —
    re-read ONCE PER SPAWN in `startMecatl`, never per `/status` poll. A
    saved grant carries the anchor it was granted at; a spawn whose live
    anchor differs is DRIFTED and gets NO `--trust-project` (the daemon's
    own fail-safe arm) until the bodyless `POST /permissions/trust`
    re-accepts it; `POST /permissions/trust-once` is mecatui's "trust once"
    — in-memory, dies with the controller, rides every restart in between.
    Both grants are studio-header-gated and 409 in external mode, and reach
    the UI only through `useHarnessRuntime().trustProject` /
    `.trustProjectOnce` (busy label `trust`), which re-read `/status.trust`
    so the page shows the decision the NEW spawn got. The registry never
    reads or writes `trust.yaml` / `trustedWorkspaces:` — the daemon may
    trust a workspace Studio reads as untrusted, and the UI says so.
    The PROMPT itself is mecatui's pre-TUI "trust / trust once / no" as a
    workspace banner (`workspace-trust-banner.tsx`, mounted in the layout's
    banner band): it renders only when the controller reports admittable
    authority AND the spawn got no grant (`untrusted`, or a `drifted`
    remembered grant), never in external mode, never once the daemon's own
    `GET /v1/soul` reports a TRUSTED project soul (the one wire signal that
    the daemon admitted the project from a registry Studio cannot see), and
    not after "Not now" — which stores the LIVE anchor under
    `localStorage["mecatl.trust.dismissed:<workspace>"]`, so a changed
    authority set (a new anchor) re-prompts. Both grants confirm first
    (the daemon restarts; in-flight runs end) and the once-copy says the
    grant lasts until the CONTROLLER restarts. Settings → Permissions shows
    the decision as a "Project trust" row with "Forget trust" (the switch
    off) and, on drift, "Trust again" (the explicit grant — a plain save
    with the switch already on never re-stamps the anchor).
    (`src/lib/controller-trust.test.ts`, `use-harness-runtime.test.ts`,
    `harness/trust.test.ts`, `workspace-trust-banner.test.tsx`,
    `permissions-section.test.tsx`, hermetic 409 + CSRF rows for both grant
    routes and the external `trust: null`.)
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
    `DELETE /providers/{name}?scope=all` clears it); "Switch to offline
    mock" is the explicit `--mock`. `GET /daemon-defaults` is header-free
    read-only like `/status`; the PUT is not. External mode:
    `daemonDefaults: null`, both verbs 409. (`src/lib/daemon-defaults.test.ts`,
    `controller-security.test.ts`, `harness/daemon-defaults.test.ts`,
    `use-daemon-defaults.test.ts`, `daemon-defaults-card.test.tsx`,
    `provider-section.test.tsx`, hermetic 409 rows.) Provider REMOVAL has
    the TUI's two scopes, from each row's kebab: `?scope=credential`
    (`providers logout`, "Remove key (keep provider)") cuts ONLY the
    `api_key` line from the provider's auth.yaml block — an emptied entry
    becomes `name: {}` exactly as mecated's authfile writes it, and the
    block plus a custom provider's definition stay, so it lists as
    "configured, no key"; `?scope=all` (`providers remove`, the default)
    cuts the whole auth.yaml block AND a custom provider's settings.yaml
    definition, its saved model pair and the active choice. A custom
    provider's NON-secret DEFINITION (`providers add`: id, `api_flavor`,
    HTTPS `base_url`, `default_model`, `auth.method` `api_key`|`none`) is
    the one thing Studio WRITES into the user-global settings.yaml: `POST
    /providers/custom` (Add provider → Custom gateway → "Save definition";
    a keyless provider restarts at once, an `api_key` one waits for the
    hand-pasted key — rule 3 holds: there is no key field and none is
    accepted). Both the write and `?scope=all` on a name the imported
    operator settings file defines are refused 409 BEFORE anything is
    written (Studio never edits that file) and the UI withholds the buttons
    while it is active. Every edit is a conservative line-range rewrite
    (`provider-auth.mjs`), temp-file + rename, the file's existing mode
    preserved (0600 when created). (`provider-auth.test.ts`,
    `add-provider-dialog.test.tsx`, `provider-section.test.tsx`,
    `use-provider-management.test.ts`, hermetic 409 + header-gate rows.)
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
    rows, the Playwright diagnostics test.) The admin surface itself
    reaches the browser ONLY through the controller: it probes a free
    loopback port per spawn (the ready file names only `http_address`; one
    re-probe + re-spawn when the failed start says address-in-use —
    `src/lib/controller-perf.mjs`), `GET /perf` reports the LIVE origin,
    paths and knobs (`/status.perf` mirrors it), and `GET /perf/metrics` /
    `GET /perf/vars` relay the two TEXT endpoints (409 while off, 503 while
    no child runs; `/debug/pprof` and `/debug/flightrecorder` are NEVER
    relayed — `performance-card.tsx` shows them as loopback links that only
    resolve on the daemon's host, and says so). All three are
    studio-header-gated and 409 in external mode. `src/lib/prometheus-text.ts`
    turns the exposition into the Goroutines / Heap / RSS / GC-pause tiles
    and prints the `mecated perf-mcp print-config` snippet byte for byte.
    Passing `--metrics-addr=` when the switch is off means a managed daemon
    no longer opens mecated's default 127.0.0.1:9090 listener — that is
    deliberate, and the card's copy says it. (`controller-perf.test.ts`,
    `prometheus-text.test.ts`, `performance-card.test.tsx`, hermetic 409 +
    header-gate rows.)
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
19. **The chat status strip is mecatui's header bar, and it never shows an
    address.** Under every chat's title row, `chat-status-strip.tsx`
    renders session handle · effective model · mode · server with the
    daemon-reported posture badge. The handle is the documented BARE
    12-column literal (`src/lib/protocol/session-handle.ts` mirrors
    `client.SessionHandle` byte for byte; no `#`); a click copies the full
    id. The model is the snapshot's RESOLVED model (display name from the
    picker list, `/route` from `provider.route` — translated to
    `provider_route`, no longer silent — and the effective effort);
    "resolving model…" shows only while the detail read is pending on a
    live chat or the connection is connecting, and settles to the
    configured id or "model unavailable" (`use-agent-chat`'s
    `sessionDetailStatus`). A mode change made mid-run is HELD by
    `useSessionMode({ busy })` as `pendingMode` — the strip reads
    "(pending)", the pill stays enabled (`modeSwitchDeferred`) — and lands
    once the run ends; a run parked on an approval is still busy. The
    server segment is managed/external + deployment label only: the
    same-origin proxy hides the daemon URL (rule 3), so no host is ever
    rendered. On an AI-debug chat the strip turns amber with `DEBUG target
    <handle>` and the TUI's durable PRIVACY line (+ bound reporting
    servers), and chat-workspace withholds mode/model/effort/compact so no
    control can fork or rebind the binding. (`session-handle.test.ts`,
    `chat-status-strip.test.tsx`, `use-session-mode.test.ts`,
    `events.test.ts` provider.route, the Playwright status-strip test.)
20. **Workspace-services enrollment never keeps the consent URL, and opens
    its window on the click.** Where the daemon advertises
    `workspace_enrollment`, the TUI's "workspace services not connected"
    notice (`workspace-enrollment-notice.tsx`) sits above the live chat's
    composer with /tools-connect and /tools-cancel as buttons. Connect calls
    `window.open` SYNCHRONOUSLY on the click, BEFORE any await (popup-blocker
    safe), POSTs the BODYLESS connect (retry/cancel likewise — the daemon
    400s any body byte), points the window at the daemon's
    `presentation_url`, and observes every 3 s until the enrollment settles;
    that URL lives only in a ref while the enrollment is pending — never in
    React state, the hook's return value, the DOM or a log
    (`use-workspace-enrollment.test.tsx` serialises the state and asserts
    its absence). A stale id (412) on retry falls back to a fresh connect;
    cancel sends the exact id. The connector inventory
    (`mcp_connector_status`, read once per open) speaks a DIFFERENT
    vocabulary from the enrollment status — `completed` there is the
    connected state — and a 401/403/404/412 folds to "unknown" (notice
    shown) rather than an error. Hidden for a debug-target chat, the mock
    tour and the draft; dismissible per session. (`enrollment.test.ts`,
    `use-workspace-enrollment.test.tsx`,
    `workspace-enrollment-notice.test.tsx`, the Playwright enrollment test.)
21. **A refused credential is never "unreachable".** The liveness probe is
    typed (`HarnessStatus.status` / `.code`); `toHarnessError` reads the raw
    problem body off the SDK error's `cause` (the SDK collapses every 401
    into "Authentication failed" and narrows unregistered codes to
    "unknown"); and `offline-cause.ts` names the class: the proxy's 401
    `oidc_login_required` / `oidc_session_expired` (Studio refuses to dial
    the deployment anonymously), its 502 `oidc_idp_unavailable`, and a
    daemon 401/403 ("Credential rejected", with the MECATL_AUTH_TOKEN /
    audience / issuer remedy). Those render `auth-recovery-banner.tsx` at the
    point of failure — cause, remedy, Sign in / Sign in again (only when
    `/api/auth/oidc/status` reports `configured`; the popup opens on the
    click), "Open sign-in settings", Retry — and re-probe on the callback
    page's `mecatl-oidc` message and on window focus, so the connected flip
    (and `use-agent-chat`'s transcript rehydrate, the resume of the open
    chat) never waits for the 5 s poll. A chat-level 401 puts the same title
    + remedy on the error strip and re-probes at once. Everything else keeps
    "Mecatl is unreachable." There is ONE deployment (MECATL_BASE_URL): no
    saved-target list, and the daemon URL is never rendered (rule 3).
    (`offline-cause.test.ts`, `sdk-auth-errors.test.ts`,
    `auth-recovery-banner.test.tsx`, `runtime-status.auth.test.tsx`,
    `use-agent-chat.auth-failure.test.ts`, hermetic 401 relay row.)

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
