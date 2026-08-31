---
id: 13-toolhive-reuse-consolidation
title: ToolHive reuse consolidation
blocked_by: [12-mecatui-enrollment-controls-and-multi-backend-vertical]
status: in-progress
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

After the amended Task 09 Mode B live GitHub qualification, compare the final bundled
multi-upstream construction, consent, provider-scoped `QueryCapabilities`, and catalogue
admission path with ToolHive v0.45.0's public APIs and `TOOLHIVE-REUSE-REVIEW.md`.

Consolidate only genuine duplicated OAuth/authserver/vMCP/capability behavior that ToolHive
already owns. Preserve mecatl's necessary adapter-private provider-name mapping, owner/session
admission, all-or-nothing catalogue validation, and lifecycle ordering. Do not introduce a
second authserver or vMCP authority, emulate independent `ConnectUpstream`, weaken secret
boundaries, or add a goleak exclusion. Record remaining upstream API/lifecycle limitations
honestly in `STAGE3-RESULTS.md` and the existing reuse review. If no safe consolidation is
available, land the reviewed evidence without speculative abstraction.

Verification is focused review plus the targeted broker/enrollment/vertical tests changed by
any consolidation; the manual SaaS journey is not rerun automatically.
