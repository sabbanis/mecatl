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
each one; right now the module foundation (toolchain, CI, and the shared UI
kit) is in the tree, and the surfaces arrive next.
:::

Studio is **daemon-only** by design: when the daemon is unreachable it renders
an offline state that names the fix — never simulated content. The decision
record is ADR 0288 (`docs/adr/0288-studio-atrium-module.md` in the repo).
