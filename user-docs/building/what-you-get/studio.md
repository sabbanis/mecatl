---
sidebar_position: 11
title: Using Studio
---

# Using Studio

Studio is mecatl's web workspace: a browser client for the daemon with five
surfaces on one rail — **Chats**, **Scheduled**, **Skills**, **Memory**, and
**Settings**. It is a client like `mecatui`: the daemon owns every record, and
Studio reads and writes the daemon's state rather than keeping its own.

:::note Landing in progress
Studio is landing as a stacked series of pull requests. This page grows with
each one; right now the module foundation, the server tier (proxy + managed-mode
controller), the typed protocol seam, the workspace shell, and the Chats
surface are in the tree; the remaining surfaces arrive next.
:::

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

In external mode there is no local controller: every local control surface
answers 409 as owned by the deployment.

Studio is **daemon-only** by design: when the daemon is unreachable it renders
an offline state that names the fix — never simulated content. The browser
never holds a daemon address or credential; Studio's own server tier pins
Host/Origin, injects the bearer and the session workspace server-side, and
allowlists headers in both directions. The decision record is ADR 0288
(`docs/adr/0288-studio-atrium-module.md` in the repo).

## Chats

Chats are the daemon's sessions — there is no separate Studio store. The
sidebar lists the daemon's session inventory bucketed by recency, with
capability-gated rename and delete. A new chat is a draft until you send:
the session is minted on first send, so abandoned drafts never litter the
daemon. The transcript streams live (text, reasoning, tool activity, and
delegation badges), failed turns surface as alerts instead of vanishing, and
permission asks render as three-way approvals (allow once / always / deny)
that withdraw if the daemon retracts them. @-mentions offer the daemon's
agent roster and slash commands its command list.
