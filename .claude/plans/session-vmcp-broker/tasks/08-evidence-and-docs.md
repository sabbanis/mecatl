---
id: 08-evidence-and-docs
title: Broker architecture, resource inventory, and Stage 2 evidence
blocked_by: [03-server-composition, 07-teardown-lifecycle]
status: in-progress
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Update the living architecture, extensibility, implementation notes, and ADR-0027 resource/fidelity inventory for the delivered root-internal broker. Produce `STAGE2-RESULTS.md` with unfiltered residual-goroutine evidence, exact ToolHive APIs/version, manual smoke command and outcome, direct-MCP/Ozz reuse boundary, ConnectUpstream limitation, and Stage 3 go/no-go. Regenerate documentation surfaces. The manual smoke is documented evidence, never part of offline `task test`.

## Acceptance criteria

- AC5.3: Tests add no goleak exclusions or residual-goroutine hiding. Any ToolHive-owned goroutines still remaining after public close are recorded in `STAGE2-RESULTS.md` with their observed stack evidence.
  - verify: inspection — residuals are an upstream dependency finding; the result document records unfiltered evidence.
- AC5.4: A manual live smoke uses `https://modelcontextprotocol.io/mcp` behind the broker and proves remote initialize, authenticated broker `tools/list`, and one documentation tool call; it is not part of `task test`.
  - verify: demonstration — documented command and successful outcome in `STAGE2-RESULTS.md`.
