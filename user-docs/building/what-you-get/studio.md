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
each one; right now everything except external-mode sign-in and the advanced chat
tiers is in the tree.
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

## Scheduled

Scheduled tasks live on the daemon; Studio's Scheduled surface lists them
with their fire history. Authoring supports the two real shapes — a cron
schedule (with timezone and an optional max-fires cap) or a one-shot (with
retry) — and mutating runs are an explicit opt-in in the form, so the
invalid mutating/plan pairing cannot be constructed. Editing round-trips the
schedule's carried spec (the daemon's update replaces the whole spec), and
each fire links its real transcript.

## Skills

The Skills surface lists the daemon's skills with provenance, browses folder
skills (including the SKILL.md inline), and — in managed mode — authors them
through the local controller: create a skill in two steps, upload a zip or a
folder, enable/disable (a disabled skill moves to a holding area rather than
being deleted), or delete. Skill names pass one shared validator on both the
browser and the controller. In external mode the list is read-only: skill
management belongs to the deployment.

## Memory and Settings

Memory is read-only by design: the daemon has no memory write API (a
hand-typed value would enter turn-0 context without injection scanning), so
Studio shows the memory table with honest disabled/empty states, per-entry
detail, the store footprint, and the consolidate action. Settings carries
Personalize (text size, interface scale, session-list side, notifications),
the agent identity card (name and avatar are browser-local cosmetics — the
agent learns your name in conversation), and the learning review page.

## Providers, model router, MCP gateway

In managed mode Studio administers the daemon's runtime configuration
through the local controller: add a provider (built-in kinds take a base-URL
override; custom gateways are validated), test a key, switch the active
provider, remove one, and edit the model router over the daemon's whole
model inventory. Provider credentials live in the daemon's auth file, owned
server-side — Studio shows status booleans and key-shape hints, and key
material never crosses to the browser. The MCP gateway URL is user-entered
but always validated, and egress is HTTPS-only (loopback HTTP sits behind an
operator env opt-in). In external mode all of this reads as owned by the
deployment. The About-this-daemon card reports the safe identity probe.
