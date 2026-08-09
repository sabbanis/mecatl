---
id: 00-field-prep
title: Principal value object + Session Owner/Authority labels + snapshot round-trip
blocked_by: []
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Scenario 0 of `docs/acceptance/caller-identity.md` (read it, and
`docs/adr/0100-caller-identity-threading.md`, decisions 1 and 4). This is the
joint field-prep commit: the two contended additive fields (`Owner` for this
plan, `Authority` for Track C) land together so the `engine/api/*.txt`
regeneration and the `engine/CHANGELOG.md` note are paid once.

**`engine/session` — the `Principal` value object.** `{ Issuer, Subject,
GrantType, Name }` (`Name` optional). `GrantType` is a small string-typed enum
with exactly three values: `user`, `client_credentials`, `system`. Identity is
the `(Issuer, Subject)` pair — never `Subject` alone (two IdPs/realms collide on
`sub`). It carries **no** scopes, no authority, no credentials, no claims map.
Pure domain: stdlib only, no adapter import (`AGENTS.md` — the layering rule).
Model it on ToolHive's `PrincipalInfo`; do NOT import ToolHive.

**`engine/session` — the labels on the `Session` aggregate.** Additive
`Owner *Principal` and `Authority` (Track C's shape — ship the smallest honest
placeholder: a distinct named type in `engine/session` with a zero value that
means "unset"; it is **inert** in this plan, nothing reads or writes it beyond
round-trip). `Session` is an aggregate — sessnap must NOT poke exported fields.
Restore them through a **write-once** aggregate method (a `RestoreLabels` /
`SetOwnerLabels` sibling of the existing label-restore seam that `Profile` /
`ProviderID` use). Write-once means a second call with a different owner must
not silently overwrite a set owner; pick the honest shape (no-op-if-set or an
error) and pin it with a test.

**`engine/adapter/sessnap` — the round-trip.** Both fields on `Snapshot`, both
`omitempty`, restored by **direct assignment via the aggregate method** — do NOT
widen `RestoreState`'s parameter list (that is a *Changed*/breaking entry under
`engine/COMPATIBILITY.md`; a direct-assignment field is *Added*/minor). A
snapshot written before this plan (no `owner` / `authority` keys) must restore to
a nil owner and a zero authority — additive, never a parse failure.

**Generated surfaces.** This widens the engine's exported API: run
`task api:update`, commit the changed `engine/api/*.txt`, and add an
`engine/CHANGELOG.md` note classifying **both** fields as Added/minor per
`engine/COMPATIBILITY.md`.

Do not touch the server, composition, or any adapter beyond `sessnap`. The edge,
the threading, and the stamping are later tasks.

## Acceptance criteria

- AC0.1: `Session.Owner` and `Session.Authority` round-trip through snapshot +
  restore byte-identically, via the aggregate restore method, with no `RestoreState`
  signature change.
  - verify: `TestCallerIdentity_Scenario0_OwnerSnapshotRoundTrip`
- AC0.2: A snapshot written before this plan (no `owner`/`authority` keys) restores
  to a session with a nil owner and a zero authority — additive `omitempty`, never a
  parse failure.
  - verify: `TestCallerIdentity_Scenario0_PreShipSnapshotRestores`
- AC0.3: A consumer compiled against the new `engine/session` reads `Owner` and
  `Authority` with no `RestoreState` call-site change (the additive-field,
  not-widened-signature contract).
  - verify: `TestCallerIdentity_Scenario0_APICompatAdditive`
