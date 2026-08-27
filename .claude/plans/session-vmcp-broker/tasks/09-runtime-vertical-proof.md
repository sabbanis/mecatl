---
id: 09-runtime-vertical-proof
title: Runtime-owned embedded vMCP vertical proof
blocked_by: [08-evidence-and-docs]
status: done
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Turn the successful scratch vMCP smoke topology into a durable, hermetic regression proof for the **actual** `internal/adapter/vmcpbroker.Runtime` boundary. Do not add a command, public listener, mecated/mecak8s wiring, or external-network test. Reuse the real embedded ToolHive authserver/vMCP composition and a local fake streaming-HTTP MCP backend. The test must construct the Runtime through the supported ToolHive/runtime path, reserve/open one session, complete its downstream Connect/callback flow, and execute the already-mounted session tool through the Runtime-owned session-local transport. It must prove the tool flows through the embedded authenticated vMCP, that the static model-facing tool identity remains unchanged, and that no credential is placed into model-facing arguments/results/events. Keep the public docs-server scratch driver manual-only under `.scratch`; it is evidence, never `task test` input.

If a small root-internal composition helper is necessary to avoid duplicating the Stage 0 ToolHive assembly, keep all ToolHive imports confined to vmcpbroker implementation files, preserve the engine boundary, and make it usable only by a future composition root. Do not widen `engine/` or `engine/port`.

## Acceptance criteria

- AC5.4 regression proof: a hermetic test mirrors the manual vertical shape using a fake backend: real embedded ToolHive authserver + incoming authentication + vMCP + actual `vmcpbroker.Runtime` session transport; it authenticates, lists/mounts the stable route, and successfully calls the fake documentation tool through the Runtime path.
  - verify: `TestSessionVMCPBroker_RuntimeOwnsEmbeddedVMCPVertical`
- Regression isolation: the test is entirely offline and needs no emitted token/code/verifier/state in tool specs, tool calls/results, events, or assertion failures.
  - verify: `TestInvariant_vmcp_broker_runtime_vertical_secrets_do_not_escape`
- The external docs server remains an explicit manual smoke only, documented separately; it is not called by `task test`.
  - verify: inspection — no external endpoint or live-network dependency in the test.
