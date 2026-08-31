# Session vMCP authorization — Stage 3 execution

Accumulator: `acc/session-vmcp-authorization`

Tasks are sequenced by the durable authority, aggregate, dispatch, control, and wire boundaries. Each task owns the acceptance criteria named in its frontmatter body.

## Scenario 11 amendment

The bundled protected workspace-enrollment amendment continues on this accumulator in the
following dependency order:

1. `10-bundled-workspace-enrollment-domain-and-toolhive-chain` — completed prototype and
   implementation baseline; final Scenario 11 proof ownership was reassigned after its
   singleton/eager-protected-discovery assumptions were found invalid.
2. `10a-toolhive-bundled-upstream-construction-repair` — blocked by Task 10; owns
   AC11.3–AC11.7 (real ordered ToolHive upstream construction, private provider mapping,
   protected startup without anonymous discovery, auth-context lifecycle, and anonymous
   compatibility).
3. `11-bundled-enrollment-authenticated-discovery` — blocked by Task 10a; owns AC11.1,
   AC11.2, and AC11.8–AC11.11 (strict owner/session admission, bundle lifecycle,
   provider-scoped `QueryCapabilities`, fail-closed atomic catalogue admission, restart, and
   the static-catalogue boundary). Its paused pre-10a prototype is preserved locally only as
   reference and must not be committed unchanged.
4. `12-mecatui-enrollment-controls-and-multi-backend-vertical` — blocked by Task 11; owns
   AC11.12–AC11.14 (non-permission mecatui controls, prompt gating, and a deterministic
   two-backend vertical over the real ToolHive chain and provider-scoped discovery path).
5. `09-live-saas-mcp-qualification` Mode B — blocked by Task 12 in addition to its existing
   Task 08 dependency; one-provider live GitHub qualification. Mode A's recorded evidence
   remains valid, while the prior GitHub result predates Scenario 11 and does not prove
   bundled enrollment.
6. `13-toolhive-reuse-consolidation` — blocked by Task 09; reviews the qualified final path
   against ToolHive public APIs, removes only genuine duplicated behavior, and records
   remaining upstream limitations.
