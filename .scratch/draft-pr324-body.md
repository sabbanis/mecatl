Stacked on #321. **Merge #321 first** — the base branch is `docs/agent-identity-model`, so the diff here is just the one new file.

#321 leaves one hop open. Line 359 says "the *harness* presents the subagent's SVID plus its own proof-of-possession," which reads as decided. How it resolves decides how much of the issuer machinery is doing real work, so this doc works it out.

## The shape of it

vMCP is a **gateway**, so a tool call crosses two boundaries with different problems.

**Hop 1 is mecatl to vMCP.** One credential, two options.

The default: connect over mTLS with the X.509-SVID. The AS reads the SPIFFE ID out of the certificate and uses it as `client_id`, and one client-authentication path then covers both grants mecatl needs — `client_credentials` when there's no user (which is what scheduled work needs, since a cron fire has no user by construction), and `token-exchange` when there is one.

The alternative: get an ID-JAG from the front-door IdP, for callers whose token doesn't name mecatl at all.

What separates them is **who else has to cooperate**, not how much code it takes. The first needs nothing from anyone outside ToolHive. The second needs the IdP to implement ID-JAG Step A — Okta does, others don't — so whether it works isn't ours to decide.

**Hop 2 is vMCP to each backend.** Most backends won't trust vMCP as an issuer, which is why that hop already picks a strategy per backend rather than having one answer.

## Four things that bear on #321 directly

- **The SVID does less than #321 assumes.** It buys two things, both under the first option only: no static `client_secret` in mecatl's environment (which matters concretely, since `envscrub` exists precisely because the model can read the harness's own environment under posture `auto` or `yolo`), and per-pod attestation. Both real. Both smaller than "the harness's identity." Under the ID-JAG option it does nothing at this hop at all.

- **`act` is an authorization input, not only an audit record.** RFC 8693 §4.1 says a consumer "MUST only consider the token's top-level claims **and** the party identified as the current actor" — a closed set of two, where only the *earlier* nested actors are informational. `draft-mcguinness-oauth-actor-profile-00` §14.5 goes further and calls evaluating only `sub` a confused-deputy risk. Worth reconciling with #321's audit-only framing.

- **A delegated token can't use the plain-OAuth path at hop 2.** That's the strategy serving most ordinary backends, so this is a real conflict between the two halves of the design, and the thing most likely to force a rework.

- **The blocker is a decision, not a build.** Three different values for `act.sub` are in flight, and no policy can be written until someone picks one. The default option dissolves most of it: `client_id` gets derived from the SPIFFE ID, so two of the three candidates turn out to be the same string.

## Status

Strawman tier per [ADR 0002](https://github.com/stacklok/mecatl/blob/main/docs/adr/0002-documentation-lifecycle.md), same as `docs/scoped-resource-grants.md`. Nothing implemented. Written to be concrete enough to disagree with.

`llms.txt` is **not** regenerated in this commit — `matlatl` is a private module and my environment has no git auth for it. Needs `task docs:llms` before merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
