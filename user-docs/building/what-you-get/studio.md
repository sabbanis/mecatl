---
sidebar_position: 11
title: Using Studio
---

# Using Studio

Studio is mecatl's web workspace: a browser client for the daemon with five
surfaces on one rail — **Chats**, **Scheduled**, **Skills**, **Memory**, and
**Settings**. It is a client like `mecatui`: the daemon owns every record, and
Studio reads and writes the daemon's state rather than keeping its own.

## Starting it

Managed mode (the default) supervises a `mecated` from your checkout:

```sh
task build        # produces bin/mecated
task studio:dev   # controller + web server; open http://localhost:3000
```

The controller spawns `mecated` on a random loopback port with a generated
bearer token, resolves the workspace to the repo root, and restarts the daemon
when you change its configuration. `task studio:stop` tears everything down.

External mode points Studio at a daemon you run elsewhere:

```sh
MECATL_BASE_URL=https://mecated.internal:8081 \
MECATL_AUTH_TOKEN=... \
MECATL_WORKSPACE=/srv/workspace \
npm run start
```

In external mode there is no local controller: provider, model-router, and
MCP-gateway settings show as owned by the deployment.

Studio is **daemon-only**. If the daemon is unreachable you get an offline
banner naming the fix — never simulated content.

Studio talks to the daemon through the [TypeScript SDK](../../reference/typescript-sdk-api/core.md)
(`@stacklok-oss/mecatl-sdk`) over a same-origin proxy that holds the bearer
token on the server; the browser never sees a daemon address or credential.

## What each surface does

- **Chats** — the daemon's session store, live. The sidebar is the session
  inventory (a chat renamed or deleted here is renamed or deleted for every
  client); opening a chat reads its authoritative transcript; a new chat
  creates its daemon session on the first message. Streaming shows tool calls,
  reasoning, delegation badges when the run hands work to subagents or teams,
  and permission asks with three-way verdicts (allow once / always / deny). A
  failed run renders as failed, with a retry. When a scheduled task reports
  back into the chat it started from, the note renders as a **Scheduled task**
  card: the schedule name (linked to its detail page), the fire id, how the
  fire ended, and its outcome text as plain text. A hidden tab gets a browser
  notification for each completed fire once notifications are enabled under
  Settings → Appearance.
- **Scheduled** — the schedule registry: create and edit schedules (cron with
  timezone, or one-shot), pause/resume/fire, and audit each schedule's fire
  history down to the per-fire session transcript. The list shows each
  schedule's trigger in plain English, its next and last run, and how many
  times it has fired (against its cap, when the spec sets one); the detail
  page repeats the count under **Runs**. A text filter narrows the list by
  name, schedule, or prompt: press `/` to jump to it, Esc to clear it.
  Write-capable schedules require an explicit opt-in; the default posture is
  read-only plan mode.
- **Skills** — the daemon's resolved skill inventory (name, summary,
  provenance). Read-only today; authoring is a follow-up.
- **Memory** — the user model: durable facts the agent has stored about you.
  Read-only by design — the agent curates memory through injection-scanned
  tool calls, so Studio never offers an editor.
- **Settings** — appearance and notifications, plus (managed mode) the
  provider status, the semantic model router, and the MCP gateway connection
  (bearer token or OAuth). Credentials are never typed into Studio: `mecated`
  reads them from `~/.config/mecatl/auth.yaml`. The **Daemon defaults** card
  on the Model provider page sets what `mecated` starts with — the active
  provider's default and subagent model, the reasoning-effort tier, a
  context-window override, provider-side prompt caching (and the Anthropic
  cache TTL), and under Advanced the per-provider base-URL overrides, the
  ToolHive LLM gateway, model aliases and slots, and the credentials-file
  path. Each save restarts the daemon with the matching `mecated` flags
  (`--default-model`, `--subagent-model`, `--reasoning-effort`,
  `--context-window-override`, `--no-prompt-cache`, `--anthropic-cache-ttl`,
  `--<provider>-base-url`, `--toolhive-llm*`, `--model-alias`,
  `--model-slot`, `--api-key-file`); a default model the daemon does not
  list is refused at startup and the previous defaults are restored. The
  active provider chosen with "Set as active" or "Switch to offline mock"
  is remembered across Studio restarts unless `MECATL_STUDIO_PROVIDER` is
  set.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `MECATL_BASE_URL` | External daemon base URL; presence selects external mode |
| `MECATL_AUTH_TOKEN` | Bearer for the external daemon (server-side only) |
| `MECATL_WORKSPACE` | Display-only label of the deployment's workspace in external mode; the daemon assigns session placement itself |
| `MECATL_STUDIO_PUBLIC_ORIGIN` | Comma-separated origins Studio is served from (CSRF gate) |
| `MECATL_STUDIO_ORIGINS` | Controller's Origin allowlist (managed mode) |
| `MECATL_STUDIO_PROVIDER` | Managed provider: `mock`, `toolhive`, or any provider named in `auth.yaml`; when set it overrides the provider remembered from Settings |
| `MECATL_ALLOW_INSECURE_LOOPBACK_MCP` | `1` permits a loopback-HTTP MCP gateway |

## Limits worth knowing

- Re-attaching live to a run Studio did not start (a scheduled fire delivering
  into a chat, another client's run) rides the daemon's session watch, which
  Studio attaches once its 20-second inventory poll reports the run. A run
  shorter than that interval shows only after it ends: Studio then re-reads
  the transcript, so the delivered note still appears without reopening the
  chat.
- Config writes in managed mode restart the daemon, which ends in-flight runs.
- There is no cost display: the daemon accounts tokens, not currency.
