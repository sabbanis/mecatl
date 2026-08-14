---
sidebar_position: 11
title: Using Mecatl Studio
---

# Using Mecatl Studio

Mecatl Studio is the local **web** client for mecatl, alongside [mecatui](./mecatui.md) in the terminal. It runs on your machine, drives a `mecated` in your own checkout, and adds the surfaces that are awkward in a terminal: a chat transcript with tool-call and approval cards, and panels for the provider, MCP gateway, model routing, skills, memory, and scheduled tasks.

It is a client, not a second harness — it speaks the same HTTP/SSE API any external client uses, so nothing it shows is Studio-specific behavior.

## Starting it

Studio drives the `mecated` binary from this checkout, so build first:

```sh
task build
task studio:dev
```

That starts two processes — the web app on `http://localhost:3000` and a local controller on `127.0.0.1:8788` that spawns and supervises `mecated` — and opens a session whose workspace is the repo root. `task studio:stop` stops all three; `task studio:status` reports whether it is up.

## Choosing a provider

Studio picks a provider in this order, and shows the winner under **Provider**:

1. **An OpenRouter key you connect** in the Provider panel. An explicit choice always wins. The key stays in the controller's memory for the process lifetime — it is never written to disk.
2. **The ToolHive LLM gateway**, if `thv llm proxy` is listening on `127.0.0.1:14000`. Studio holds no credential for this path: the proxy injects a fresh token per request. Start it with `thv llm proxy start`.
3. **The offline mock**, so a fresh clone with no credentials still opens a working UI.

:::note
A reachable gateway is not the same as a usable one. Studio's readiness probe asks the gateway for its model list, which can succeed while individual models fail — if turns error out with a provider 500, check that the specific model you pinned is served by a backend that answers, not merely that it appears in the model list.
:::

## The panels

| Panel | What it does |
| --- | --- |
| **Model Router** | Define 2–8 semantic categories, each with a description and a model. A small classifier picks the category for every unpinned delegation. When an operator policy is imported, editing is locked so router edits cannot clobber aliases, slots, and guardrails. |
| **MCP Gateway** | Connect a remote MCP gateway by browser OAuth or an existing token. Sign-in is bounded to 10 minutes, so a closed popup fails cleanly instead of hanging. |
| **Skills** | Lists the skills discovered in the workspace's `.mecatl/skills`. Discovery is project-scoped by design and never widens to your user-global skills. |
| **Memory** | Read-only view of both stores: the cross-project user model (keys and descriptions, never values) and this workspace's project memory. Mecatl curates these through its own tool calls — see [Memory](./memory.md). |
| **Schedules** | The oversight surface for [scheduled tasks](./scheduled-tasks.md): what is armed, when it next fires, whether it can write, and pause / resume / run-now / delete. |

The memory panel is deliberately read-only. Mecatl's memory tool calls are injection-scanned; a value typed into a text box would reach the model's turn-0 context without passing that check. Ask the agent to remember or forget something instead.

## Working in a task

- **Approvals** appear inline as cards — allow once, allow always, or deny.
- **Plan mode** is the toggle next to the composer, for thinking before edits.
- **Model** can be pinned per task, or left on the server default.
- **CSV attachments** up to 256 KB ride along with a prompt and are fenced as untrusted data, not instructions.
- **Session routing** shows which model each delegation ran on and why the classifier chose it — including when no route was recorded.

A schedule that fires while you are watching shows up as its own `sched--` session, so unattended work is visible in the same place as your own.

## See also

- [Using mecatui](./mecatui.md) — the terminal client.
- [MCP client](./mcp-client.md) — how mecatl discovers and calls MCP servers.
- [Scheduled tasks](./scheduled-tasks.md) — the durable, exactly-once scheduler behind the Schedules panel.
