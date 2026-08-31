# Session vMCP authorization — Stage 3 execution

Accumulator: `acc/session-vmcp-authorization`

Tasks are sequenced by the durable authority, aggregate, dispatch, control, and wire boundaries. Each task owns the acceptance criteria named in its frontmatter body.

## Scenario 11 amendment

The bundled protected workspace-enrollment amendment continues on this accumulator in the
following dependency order:

1. `10-bundled-workspace-enrollment-domain-and-toolhive-chain` — blocked by Task 08; owns
   AC11.1–AC11.3 (owner-bound pre-prompt enrollment, deterministic all-or-nothing ToolHive
   chain, and unchanged eager anonymous discovery).
2. `11-authenticated-discovery-and-frozen-session-catalogue` — blocked by Task 10; owns
   AC11.4–AC11.6 (authenticated discovery, fail-closed validation, immutable session-local
   catalogue, and fresh enrollment after restart).
3. `12-mecatui-enrollment-controls-and-multi-backend-vertical` — blocked by Task 11; owns
   AC11.7–AC11.9 (non-permission mecatui controls, prompt gating, and the deterministic
   two-protected-backend vertical).

Task 09 retains its Task 08 dependency. Mode A's recorded anonymous-backend evidence remains
valid; Mode B is additionally blocked by Task 12 and becomes a one-provider live
qualification of Scenario 11. The prior GitHub result predates Scenario 11 and does not prove
bundled enrollment.
