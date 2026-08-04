# Agent identity: issue breakdown

Derived from [`docs/agent-identity-model.md`](agent-identity-model.md) (inbound) and
[`docs/agent-identity-outbound.md`](agent-identity-outbound.md) (the outbound
boundary). Below, **doc 1** always means the first of those and **doc 2** the second; a
*phase* is one of doc 2's phases. Not filed. Every "today" claim is verified against code in
`mecatl@main`, `toolhive@main`, and the WIP branches `toolhive/spiffee-authserver` and
`toolhive/token-delegation` (double-e).

`[M]` mecatl · `[T]` ToolHive · `[M+T]` both · `[OPS]` deployment · `[S]` spike (the output
is a decision, throw the code away)

**27 numbered issues** across eight tracks, plus one tracking issue for deferred work. Every
deferred row carries a trigger, because a deferral with no stated trigger is a decision nobody
revisits.

This is the **long form** — the reasoning, the citations and the per-seam detail.
[`docs/agent-identity-epics.md`](agent-identity-epics.md) is what would actually go in a tracker:
seven behaviour epics, three standalone items, one tracker, and the ToolHive coverage check.

---

## The reframe that shapes Track L

**The label mechanism already exists in this codebase, and it already fails open.**

`session.Session` carries four opaque write-once labels the aggregate never interprets:
`Profile`, `ProviderID`, `ModelID`, `ReasoningEffort` (`engine/session/session.go`). The only
writer is `setSessionLabels` (`internal/adapter/server/service.go`), called from exactly three
sites: shared-engine create, per-session create, and `ForkSession`. **No `session.New` inside
`engine/agent` sets any of them**, and there are eight child-session mint sites there.

So a label propagates on `ForkSession` and silently does not on every delegation path. That is
the same shape as BigQuery's policy tags propagating to views but not to
`CREATE TABLE AS SELECT`, which was patched afterwards by a watcher daemon and which failed
**open**. It is present here today, for `ProviderID` and `ModelID`, not hypothetically.

Consequence for the plan: this is not "design a label system." It is "add one more opaque
field and fix the propagation that is already broken for the four that exist." Smaller ask,
and it ships with a live bug as its motivation.

---

## Waves

| Wave | Issues | Ends with |
|---|---|---|
| **1** | A1, B1, E1, D1 | decisions made, branches landed. Nothing here blocks anything else here. |
| **2** | A2, A3, A4, A6, B2, D2, D3, F1, F2, X1 | **X1 is demoable and lands here.** The escalation proof is the thing that funds the rest. |
| **3** | A5, B3, B4, D4, D5, E2, E3, F3, G1, G2, L1, L2, S1 | the design is implemented |

Three long poles: **B1/B2**, because mecatl has no runtime authority value in any form and every
gateway enforcement is downstream of it; **F3**, because it is what makes the realistic GitHub
scenario possible at all; and **L1**, because every other label issue is downstream of the
propagation fix.

The tracks below are grouped by subsystem, not by wave, so read this index first:

| Track | Repo | What it covers |
|---|---|---|
| [A](#track-a--user-identity-and-the-shared-access-seam-m) | `[M]` | a principal at the edge, session ownership, and the one shared `authorize` seam |
| [L](#track-l--labels-m) | `[M]` | object labels, propagation at every creation seam, what the model may never do, and the memory laundering paths labels close |
| [S](#track-s--sharing-m) | `[M]` | observers and handoff: multiplayer v1, and what v1 forbids |
| [B](#track-b--authority-as-a-runtime-value-m) | `[M]` | authority as a value that can be narrowed. **B1 is wave-1 work despite appearing here** |
| [D](#track-d--the-auth-server-becomes-enforcing-t) | `[T]` | making the vMCP auth server enforce rather than relabel |
| [E](#track-e--key-custody) | `[M]` `[OPS]` | keeping the pod's key out of the agent loop's address space |
| [F](#track-f--the-gateway-t) | `[T]` | one gate, one resolved target, one credential |
| [G](#track-g--unattended-work-mt) | `[M+T]` | schedules with real consent and honest failure |

---

# Track A — user identity and the shared access seam `[M]`

Today: one static shared bearer token (`internal/adapter/server/authn.go`), constant-time
compared, short-circuiting to allow when empty, which is the default in both binaries and
every shipped manifest. The interceptor validates a credential and **discards it before the
handler** (`grpc.go` never reads `ctx` metadata). `--client-ca` gives mTLS and the certificate
is never inspected. No OIDC anywhere. `CreateSessionRequest` has 8 fields, none about who asked.

## A1 Verify a user token and carry a principal into the handler

**Description.** The interceptor already holds a credential and throws it away. This replaces
the static-string comparison with real verification and puts the resulting principal into the
request context so a handler can read it. Three deployment shapes are viable and the first
acceptance criterion is picking one: mecatl verifies an OIDC bearer in-process; a proxy at the
edge verifies and injects a trusted header; or mTLS with the certificate actually read.
Recommendation on the table is in-process OIDC, because mecatui is a first-class client and a
TUI behind a cookie-setting proxy is miserable while a TUI doing device-code is a solved
pattern. The shared `--auth-token` stays and changes meaning: it identifies a deployment, not
a person.

**Acceptance criteria.**
- [ ] The three shapes are compared on what the operator configures, what mecatui does, and what happens to the credential-free session creators. One is chosen, the others recorded as rejected.
- [ ] `--oidc-issuer` / `--oidc-audience` on both binaries; JWKS fetched from discovery, cached, re-fetched on rotation.
- [ ] Signature, `iss`, `aud`, `exp`, `nbf` verified. Empty `sub` is a rejection. Failures are 401 / `Unauthenticated` leaking no reason.
- [ ] Both wire surfaces put a principal in `ctx`; a handler gets the same value from either.
- [ ] **Group claims are carried**, because Track L's labels are sets of group names and there is no second source for them.
- [ ] Rate limiting buckets per principal. Today it buckets on the token string, so all users share one bucket.
- [ ] `--auth-token` callers get an explicit service principal, never an empty one.
- [ ] If the trusted-header mode is kept, it is off by default and warns at startup that mecatl must then be unreachable except through the proxy, i.e. the NetworkPolicy becomes an authorization boundary rather than hygiene.
- [ ] One JWT library in the direct module graph. Four are there transitively today.

**Deliverable.** One verifier package, two adapters wired, flags documented in `docs/usage.md` and `user-docs/deployment/`.

**User stories.**
- As Alice, when I call mecatl with my IdP token, then a principal reaches the handler instead of being thrown away at the interceptor.
- As an operator with two users, when one of them hammers the API, then the other's rate-limit budget is untouched.
- As the developer of Track L, when I need a label, then the groups it is built from are already on the principal.

## A2 The identity type, and how it travels

**Description.** This is the issue for the shape of "who is calling" and its carriage, not just
a field. Two types, and the credential-free one is defined **first**, because the sibling project
that retrofitted the split ended up with a permanently-empty `groups` field on an external
webhook payload:

```go
// engine/session — durable, credential-free, safe to persist, log, and put in an event.
type Owner struct {
    Subject string `json:"subject,omitempty"` // stable opaque principal id; "" = unauthenticated
    Issuer  string `json:"issuer,omitempty"`  // disambiguates two IdPs minting the same Subject
}

// internal/adapter/server — request-scoped. NEVER persisted, NEVER logged, nil = unauthenticated.
type Caller struct {
    Owner  session.Owner
    Claims map[string]any // RAW claims, verbatim. Never pre-parsed.
}
```

`Owner` lives in `engine/session` and that is **free**: the `core-domain-leaf` depguard rule
already covers it with `allow: [$gostd]`, so there are no depguard edits, no DAG-table edits and
no `CorePackages` entry — `engine/arch/layering_test.go` declares `engine/session` with no
allowed imports and stays unchanged. It rides `setSessionLabels`, the single existing writer,
which already runs at create and at `ForkSession`.

Carriage is a ctx value for **one function's width** and an explicit parameter thereafter. The
interceptor signature gives no other option at the wire, and `authn.go` is already the single
named tested transport boundary — today there is no ctx-value carriage anywhere in this repo at
all (`context.WithValue` and `ctx.Value` have zero non-test occurrences under `engine/` and
`internal/`), so this introduces the first one and gets to set the discipline.

**The module boundary does not enforce that discipline, and an earlier draft of this issue
claimed it did.** The boundary stops `engine/`, which is not where the risk is: `*server.Service`
has ~60 methods in the *same package* as the accessor and every one of them already takes `ctx`
first, so "unexported" buys nothing against a future `Service` method reading ctx instead of its
parameter. That is exactly how the sibling project ended up with its ctx accessor read in 27+
packages, down to a backend-telemetry leaf. Depguard cannot express an intra-package rule. The
cheapest thing that works is a source-level test asserting `callerFromContext` is referenced only
in the wire files — the same discipline as `internal/adapter/soul/store_test.go`'s
`TestStoreExposesOnlyReadMethods`, which A4 already cites for a different property.

**The identity does not enter `engine/agent`, and that is the biggest simplification available —
but the reason given in an earlier draft was wrong.** That draft said a child transcript is
reachable only through `InspectSubagent`/`InspectMember`, which run inside a run whose ownership
the caller already proved. Owning your run scopes nothing about the id you pass. The real gate on
all three store-reading tools is an **id-prefix family check, not an ownership check**:
`engine/agent/subagentinspect.go`'s `hasAnyPrefix(id, t.allowedPrefixes)`, `teaminspect.go`'s
`team_id`+`member` framing, and the `resume:` path's `strings.HasPrefix` in `subagent.go`. Ids are
derived, not secret (`subagent-<providerToolCallID>`, `parallel-<callID>-<i>`,
`team-<teamID>-<member>`), so possession of a child id is read access to **any** principal's child
transcript. That is a live cross-tenant read, and it is A6's to close.

The conclusion survives because the fix is a **narrower store, not a wider `Deps`**: scope those
tools to the ids this run actually minted — which the child registry already tracks as
`parentCaps.children` for `SubagentStatus` — or hand `engine/agent` a per-session-wrapped store
from composition. Both are authority narrowing (Track B) or the A4 decorator, neither is identity
plumbing. Injecting an `Owner` into `Deps` would buy the same outcome at the cost of the largest
simplification here. So `buildChildSession`, `Deps` and `parentCaps` stay untouched, and the
fork / background-child / detached-goroutine / remote-process survival questions dissolve.

**Acceptance criteria.**
- [ ] `session.Owner` as above, with `String()` returning only the subject. **No** custom `MarshalJSON` on `Owner` — it has nothing to redact and would fight sessnap's plain `json.Marshal`. Redaction belongs on `Caller`, which holds the claims.
- [ ] A value type, not a pointer, so `omitempty` keeps snapshots byte-identical when unset. The nil-not-zero-struct rule binds on `Caller`, which is a pointer and is nil when unauthenticated.
- [ ] `Owner` on the Session aggregate, written by `setSessionLabels`, persisted in `sessnap` (additive, no version bump — the format tag deliberately does not bump for additive change), restored on rehydration.
- [ ] **`eventsource.SessionMeta` gains the field.** The fold takes labels from caller-supplied meta and not from events, so skipping this silently zeroes the owner on the event-sourced path — the same latent trap the four existing labels already have.
- [ ] **`jsonlstore`'s `metaSnapshot` gains it too**, because it is a hand-mirrored subset of the snapshot tags serving the fast `ListSessions` path. Miss it and the fast and slow paths disagree.
- [ ] `CreateSessionRequest` and the HTTP body gain `principal`; the handler prefers the verified `Caller` and rejects a body that contradicts it. The response echoes the resolved owner. **No proto change for the store** — the driver envelope is opaque.
- [ ] `authn.go`'s `authGRPC` returns a `*Caller` rather than a token string; the three wire entry points place it in ctx; each handler pulls it once at the top and passes it explicitly.
- [ ] `callerFromContext` returns `(*Caller, bool)` and guards `ok && c != nil`. A public key plus a bare pointer let a **typed nil** past the setter in the sibling project, which now carries a test for that bypass; an unexported key makes it unlikely, not impossible, and the guard is one line.
- [ ] A source-level test asserting `callerFromContext` is referenced **only** in the wire files, per the intra-package argument above. Roughly 20 lines.
- [ ] **The identity-disable predicate is its own, derived from whether A1's verifier is wired — NOT `SecurityConfig.authEnabled()`.** That predicate is `AuthToken != ""`, which answers "is a static shared token configured": wrong in both directions, since a shared-token deployment has one credential and *zero* subjects, while an OIDC deployment may have subjects and no static token. Reusing it is a latent fail-open. Disabled means `authorize` allows unconditionally at that one site, byte-identical to today.
- [ ] Every appended event carries the owner, identity only. No child content, no prompt text, no arguments added by this change.
- [ ] `txn`-style run correlation lands here as a log field, not as a claim.
- [ ] ACP and `mecatequi` get a named principal, since each acts *for* someone at a *later* time and a blank in the log is a real gap. The scheduler fire is A3.
- [ ] **The mecatui embedded socket gets no principal, and that is deliberate.** It has exactly one principal — the invoking OS user — for the process lifetime, already enforced one layer down: the socket lives in a randomised `os.MkdirTemp` dir at 0700 and `cmd/mecatui/embed/embed.go` already writes down that rationale. A `subject: "local"` would record an unverified fact and make single-user snapshots differ from pre-identity ones for nothing.
- [ ] **No `SO_PEERCRED` read.** It re-derives what the kernel guaranteed before the first byte reached the listener, and it does not generalise: mecated's default bind is loopback TCP, which has no peer uid.
- [ ] **Anonymous means nil `*Caller` and a zero `Owner` — never a fabricated one.** The sibling project's `AnonymousMiddleware` mints `sub: "anonymous"`, `iss: "toolhive-local"`, and **forged `exp`/`iat`/`nbf`** so any policy inspecting freshness sees a valid 24-hour token no IdP issued; `"anonymous"` then appears in audit records and an external webhook contract looking like a user who named themselves that. Worth copying from it: its Cedar authorizer **fails closed** on a missing principal (`ErrMissingPrincipal`) rather than choosing one.
- [ ] **Ownerless legacy sessions are refused**, with the disable switch as the escape hatch. Adopt-on-first-touch is ownership laundering — whoever touches it first owns it, so a prompt-injected agent or anyone who guesses a derived id takes it, silently and irreversibly. Treat-as-public re-adopts A4's sharpest leak as policy and never converges, since `jsonlstore` has no rewrite pass. Refuse is the only failure mode a human notices and can undo, and it does not touch the single-user case at all, where the switch is off.
- [ ] `setSessionLabels` widens to take the owner (it takes none today), and **a fork inherits the *source's* owner**, authorized by an A4 `write` check on the source. The forking caller's own owner must never overwrite it, or fork becomes an ownership-laundering path. `ForkSession` takes no `*Caller` today, so this is a signature change, not a free ride.
- [ ] **The api-compat cost is three lines in `engine/api/session.txt`, not one** — the `Owner` type, the `Session` struct line (the baseline inlines full struct shapes), and `Owner.String()` — plus the `engine/CHANGELOG.md` note, all **Added = minor**. `engine/adapter/eventsource` is not baselined, so `SessionMeta` is free.
- [ ] Test: the owner survives reopen, interrupt, recover, a pod migration, and a fork.
- [ ] **Not built, with triggers recorded:** no credential, token, expiry or refresh on either type (trigger: mecatl grows an upstream-token flow, which it has none of — provider credentials are operator-held and `envscrub`'d out of every agent-facing shell); no `Metadata map[string]string` escape hatch; no pre-parsed structured claim; no `port.AuthorizationPolicy` interface until a second implementation exists, because the check is `slices.Contains` in the service layer; no delegation-chain type (trigger in S1).

**Deliverable.** Two types, the `authn.go` return-type change, the aggregate field, three sessnap lines, the `SessionMeta` and `metaSnapshot` fields, the proto field for create, a migration answer.

**User stories.**
- As an auditor, when I load any session from the store, then it tells me who owns it.
- As an auditor with no keys and no verifier, when I read the event log, then I can already tell who did what.
- As a developer in `engine/agent` who reaches for the caller, then the import does not compile.
- As a developer adding a `Service` method that reads the caller from ctx instead of its parameter, then the source test fails, because the module boundary cannot see me.
- As an operator on the default single-token deployment, when I upgrade, then my snapshots are byte-identical and nothing changes.
- As a developer running mecatui locally with no token, when I open a session, then no principal is invented for me and the log says unauthenticated rather than naming a user who does not exist.

## A3 Schedule owner captured at create, replayed at fire

**Description.** The load-bearing credential-free path. `makeFireFunc`
(`internal/app/scheduler_fire.go`) is a Go closure invoked by the leader's tick loop; it calls
`*server.Service` methods directly, crossing no interceptor and holding no `ctx` metadata. It
has nobody to ask at 3am, so the owner must be captured when the schedule is created and
replayed at every fire.

**An earlier draft said the one-line half was "read `OriginSessionID` at fire time." That has a
lifetime bug.** `OriginSessionID` is a session id, not an owner, so deriving from it means a
`store.Load` at fire — and the origin session can be **gone**, because `internal/app/childgc.go`
sweeps top-level sessions on `mainRetention`/`mainMaxTotal`. A cron schedule that outlives its
origin then fires ownerless, which is the exact failure this issue exists to prevent. The cheap
correct version instead: `validateScheduleOrigin` in `internal/adapter/server/schedule_manager.go`
**already loads the origin session at create time**. Take the owner off that already-loaded
session, at the one moment the session provably exists. Still one assignment, at a Load that
already happens.

**There are also two create seams, not one, and they differ in identity access.** The model-facing
`agent.SessionOriginScheduleManager.CreateSchedule` overwrites `spec.OriginSessionID`
unconditionally with the bound session id and has **no** verified caller; the wire path in
`schedule_manager.go` does. Keeping identity out of `engine/agent` means the wrapper keeps
stamping only the session id, and the Service-layer manager resolves the owner from it.

**Acceptance criteria.**
- [ ] `ScheduleSpec` carries an owner, written from the verified principal at schedule creation. It lives in `engine/port/schedule.go` — `engine/port` already imports `engine/session` so this is legal, but it is **in the baselined engine module**, so it costs a line in `engine/api/port.txt` that an earlier draft of this issue did not mention.
- [ ] The owner is captured in `validateScheduleOrigin` off the session it already loads, **not** re-derived at fire from `OriginSessionID`.
- [ ] `makeFireFunc` passes the captured owner through; no path creates an ownerless session.
- [ ] Both create seams are covered, and the model-facing one gains no identity access.
- [ ] A service-owned schedule's owner is an explicit service principal ("the schedule did this"), never a fabricated user.
- [ ] `FireNow` inherits the fix rather than needing its own.
- [ ] Test: a fire's session carries the schedule creator's owner, verified across a restart and a leadership change.
- [ ] A defined answer for ownerless legacy schedules.

**Deliverable.** A field on `ScheduleSpec`, the fire-path change, tests across leadership change.

**User stories.**
- As an auditor reading a 3am run's log, then it names who the work belongs to, and never blank.
- As a prompt-injected agent creating a schedule, then I cannot make it run as someone else.

## A4 One shared access seam: `authz.Check(ctx, verb, objectRef)`

**Description.** The requirement is that mecatl not have several subsystems governed in
different ways, so this is one decision function shared across every governed kind. Object kinds
are sessions, schedules, teams and memory; verbs are `read`, `write` and `delete`, interpreted per
kind, where `write` on a session means **prompt it** (which makes "may Bob prompt this?" an
ordinary verb check and makes observers fall out as read-without-write).

**The seam is not a Service funnel, and an earlier draft of this issue got that wrong in a way
that would have shipped an off switch instead of a check.** Two findings force the shape:

*One.* `acquireLease` cannot hold the check. It returns early when `s.cfg.SessionLease == nil` —
**the default in both binaries**, per the SessionLease gotcha — so a check there does not execute
in the shipped configuration. It returns early again on `s.leaseDisabled`, which one
`ErrLeaseUnsupported` from a storage backend sets stickily for process life. And it returns early
on `heldLeases[id]`, which is fatal *even when a lease is wired*: the lease is session-scoped for
the session's life by deliberate design, its doc-comment warning future readers not to "fix" that,
so the check would run on the **first** run-entry only. Alice creates a session; Bob's second
prompt short-circuits and is never checked. Authorization is per-request, the lease is
per-session. The draft's *diagnosis* was right — `resumeFromAwaiting` genuinely bypasses
`loadAndReopen`, calling `GetSession` because `loadAndReopen` would drive back to idle exactly the
terminal states this seam must reject — but it then picked a funnel that cannot carry a decision.

*Two.* No Service-layer chokepoint can reach `engine/agent`, which reads the shared session store
directly from **model-facing** tools: `InspectSubagent`, `InspectMember`, and the `resume:` load,
each gated by an id-prefix family check rather than ownership (A2 has the detail). `engine/agent`
must never import a Service, so a funnel there governs zero of it.

So: **one leaf package `internal/authz` exporting `Check(ctx, Verb, ObjectRef) error`, called from
port decorators built in `internal/app`** over `port.SessionStore`, `port.PrunableStore`,
`port.MetaLister`, `port.EventLog` and `tool.MemoryStore` — plus Service-level calls for the verbs
that touch no store (A6). The decorator construction is what makes the primitive genuinely shared,
and it is the only shape that reaches all four bypass families at once: `Service`, whose every
store touch is `s.cfg.Store`; the `grpcdriver` servers, which take the port interfaces as
constructor args, so handing them the decorated value closes A6's worst hole with **zero proto
change**; `childgc`, same; and `engine/agent`'s inspect tools, which hold whatever store
composition injected. `internal/app` already imports `engine/port` and `engine/tool` and is the
only package allowed to meet ports with adapters, so there is no depguard edit, no DAG entry, no
api baseline and no CHANGELOG.

**Not a new `port.AuthorizationPolicy`.** The loop consumes nothing from it — `engine/agent` is
storage-agnostic by policy and must not learn about principals, the `port.SessionLease` precedent
exactly — and a new port costs an api baseline plus a CHANGELOG entry per ADR 0037 for zero engine
consumers.

**Do not merge this with `port.PermissionPolicy`.** That one takes `(sessionID, mode, ToolCall,
workspace)` and returns a three-valued decision resolved deny-dominant over six config scopes,
where `ask` means "surface to a human"; its subject is the agent inside a session and its question
is whether a tool call may run. `authz.Check` takes `(principal, verb, objectRef)` and returns
allow or deny — **no `ask` tier, because on a cross-user object read there is nobody to ask** — and
no mode. Merging them would let a project-tier `settings.yaml` Allow widen an object ACL, since the
tighten-only project gate does not cover ownership, and would hand the model an `ask` path to a
cross-tenant read. They compose in series: `authz` gates entry to the object, `PermissionPolicy`
gates tools once inside.

Filtering stays a service concern: `port.MetaLister` and `port.PrunableStore` both say in their
doc-comments that they apply no filtering, and `storeconformance`'s `assertSessionEqual` fails any
store that drops or alters a message.

The reason this is one issue rather than per-port work is drift. The per-session-catalog-drift
class fired three times and the third fix was structural: one registration path plus a test
asserting exact equality. The same discipline applies here or the primitive is shared by
agreement only.

**Acceptance criteria.**
- [ ] `internal/authz` exists: `Verb` (a closed set of **three**), `ObjectRef{Kind, ID}` with kinds session/schedule/team/memoryScope, `Check(ctx, Verb, ObjectRef) error`, `PrincipalFrom(ctx)`. One per-kind interpretation table, in the package doc-comment. **The objectRef does not exist today and is the piece that makes a single seam possible at all** — without something generic to pass, every port necessarily writes its own check.
- [ ] **`administer` is cut.** It had zero call sites: sharing and ACL mutation are Track S and do not exist yet. An untestable column in the interpretation table is worse than the `ungoverned` bucket the anti-drift test already needs. Add it when S1 lands member lists.
- [ ] **`delete` stays distinct from `write`** for a real reason — an owner may prompt their session without being the only gate on destroying it — and has exactly two sites: `childgc` and the driver server.
- [ ] **The verb set's known hole dissolves; record the resolution.** `CreateSession*` authorizes the *caller*, which A1's principal already decides, and creation's job is to **stamp** `Owner = principal` — a write to the new object, not a check against an old one. No fifth verb, no parent reference. "Who may create at all" is a deployment-level principal allowlist, never an objectRef verb.
- [ ] **`acquireLease` is not the funnel, and a comment inside it says why** — nil by default, sticky-disable, session-scoped-once — so no reviewer re-proposes it.
- [ ] The decorators **implement every method explicitly and embed no interface**, so adding `MetaList` to `port.MetaLister` fails the *build* until someone classifies it. That is a real gate covering exactly the surface reflection over `*server.Service` cannot reach, and it costs only boilerplate.
- [ ] **`StreamSessionEvents` is checked at stream open, not per event.** An earlier draft put this on `relayEvent`'s `forward bool`: the four relay sites are real, but `relayEvent` fires per event on a run whose entry already decided ownership — per-event cost for a per-stream constant — and it does not cover the read-back at all. `StreamSessionEvents` returns `EventLog.Read(ctx, id)` for **any id the caller names**, unchecked. That is the leak.
- [ ] **The events read-back decision is explicitly reversed.** `grpc.go` and `http.go` carry comments saying "Do NOT copy the live-relay filter here" — a deliberate single-user choice that relays `EvUserPrompt` and `EvApproval` in full for any session id a caller names. Rewrite them to say the ownership gate is upstream while the log-only-kind relay decision stands.
- [ ] Bob's `ListSessions` returns only Bob's sessions, and Alice's first prompt never appears. **Twin:** Alice's own call still returns hers, so this cannot be fixed by returning nothing.
- [ ] `GetSession` and the SSE read-back refuse a session the caller does not own, with a response that does not leak existence.
- [ ] **`DeriveTitle` alone is not sufficient.** It has three callers, but `listSessionsMeta` reads the title straight off `MetaList` and never calls it, so a redaction there is bypassed on any store implementing `MetaLister`. Cover both paths, or collapse to one.
- [ ] `SessionSummary` and its proto mirror carry the owner.
- [ ] An explicit operator-principal path exists for fleet views, rather than the absence of a check standing in for one.
- [ ] **The anti-drift test.** Reflection over `*server.Service`'s exported methods against a `method → (kind, verb)` table with an explicit `ungoverned` bucket, so a new exported method fails until it is classified. Precedent: `internal/adapter/soul/store_test.go`'s `TestStoreExposesOnlyReadMethods` does exactly this, one type smaller. Plus the catalog-drift vacuity guard so emptying the table cannot pass. Failure text in the tone of `engine/port/llm_neutral_test.go`.
- [ ] The test's limits are documented in the test: it cannot see whether a method body calls `authorize`, it cannot reach the paths in A6, and it cannot reach the decorated ports — those are compile-gated instead.
- [ ] **Memory's governed object is the *scope*, not the entry.** `tool.MemoryEntry` is `{Key, Value, Description, UpdatedAt}` — no owner, no label — and composition builds **one** project store per deployment, shared by every session, so a check can only be all-or-nothing per scope. Listing memory beside sessions implies a granularity the port cannot express. Per-entry authz is deferred to L1/L2 with the `tool.MemoryEntry` widening named as its prerequisite. The six memory tools' floor-scoped Allows are the orthogonal tool-permission axis and are untouched.
- [ ] **The background actors get an explicit system principal in their ctx**, or they die silently the day a decorator lands: `childgc.sweep` and both consolidators (`startMemoryConsolidation`, `startUserModelConsolidation`) run on goroutines with no caller.
- [ ] **This does not ride the posture ladder and must not fold into it.** `internal/app/posture.go` governs what the **model** may do; authorization governs what a **human caller** may reach. Fold them and `--posture auto`, documented as the recommended unattended default, silently disables cross-user checks — the recommended production setting becomes the insecure one. There are exactly two states, decided once in composition from whether A1's verifier is wired: identity disabled, where `Check` allows at that one site; and identity enabled, where a nil `*Caller` is refused at the wire and never reaches an ownership comparison at all. That last part is the point — an empty-`Subject` `Owner` comparing equal to an unowned session is the classic fail-open, and this shape means the question never arises.

**Deliverable.** The `internal/authz` package, the verb table, the port decorators built in `internal/app`, the Service-level calls for the store-free verbs, the stream-open check, proto changes for the owner echo, and the anti-drift test.

**User stories.**
- As Bob, when I list sessions, then I see only mine.
- As Bob guessing Alice's session id, when I request her events, then I am refused.
- As a developer adding a governed subsystem, when I forget to route it through the seam, then CI fails instead of a reviewer maybe noticing.
- As a developer widening a store port, when I add a method and forget to classify it, then the **build** fails, because the decorator embeds no interface.
- As a reviewer, when I ask how memory is governed versus how sessions are governed, then the answer is one function and a table rather than two subsystems.
- As an operator who deliberately runs single-user, when I upgrade, then nothing is checked and nothing changes, because the verifier is not wired.

## A5 Store hardening: auth, TLS, snapshot integrity `[OPS]`

**Description.** On resume all authority is re-derived from the session store, which makes
Redis the root of trust for the whole model. It dials with no auth, no TLS and no keyspace
scoping, and `sessnap` is plain JSON with no MAC. This issue also **absorbs the one property
the deferred SPIFFE issuer was going to provide**: a leaked database credential against an
unauthenticated store is far likelier than pod compromise, and that adversary cannot forge a
MAC. A MAC on the snapshot buys the same defence as a signed chain, against that adversary,
for a fraction of the cost.

**Acceptance criteria.**
- [ ] Redis AUTH and TLS supported and used by the shipped manifest; keyspace scoping so one deployment cannot read another's sessions.
- [ ] Startup warning when a shared store is configured without auth.
- [ ] A MAC over the persisted snapshot, verified on load, covering the principal and the label.
- [ ] A tampered snapshot fails the load with a diagnostic that says integrity, not something that looks transient.
- [ ] **Twin:** an unmodified snapshot loads cleanly.
- [ ] Test written from the adversary's side: modify the stored row directly, then resume.

**Deliverable.** Store adapter changes, the MAC, manifest changes, one paragraph in `user-docs/deployment/`.

**User stories.**
- As someone with write access to the store and no key, when I widen a stored authority row or lower a label, then the resume refuses.
- As an operator pointing mecak8s at a shared store with no auth, then I am told at startup rather than in an incident.

## A6 Close the five paths that bypass the seam

**Description.** A4's decorators govern every store touch. Five paths still need their own answer,
and the two an earlier draft of this issue missed are the model-reachable ones.

The three already known: `internal/adapter/grpcdriver` wraps the **raw ports** —
`NewSessionStoreServer` exposes `Save`/`Load`/`List`/**`Delete`** and `NewMemoryStoreServer` all
six memory methods, over the network, with zero Service involvement (A4's decorators close this by
construction, since both take the port interface as a constructor arg). There is **no
session-delete method on the Service at all** — the only delete is `internal/app/childgc.go`, a
background sweeper. And team member sessions pass neither `StartRunContent` nor `loadAndReopen`.

**Fourth: the live-run verbs, which touch no store and so no decorator sees them.** `ApproveRun`
takes a lock-free fast path — `if run, ok := s.LookupRun(id); ok { run.Approve(askID, verdict);
return nil, nil }` — reaching no funnel at all. Same shape in `Cancel`, `CancelChild`, `SetMode`'s
live branch, `ApprovePlan` and `Persist`. **Today Bob can approve a tool call on Alice's live run,
cancel her run, and flip her permission mode.**

**Fifth: `engine/agent`'s direct store reads from model-facing tools.** `InspectSubagent`'s only
gate is `hasAnyPrefix(id, t.allowedPrefixes)` — a family check, not parentage — then
`t.store.Load`. `InspectMember` and the `resume:` path are the same shape. Ids are derived, not
secret, so a prompt-injected model handed or guessing another tenant's child id reads that
transcript verbatim. This is the one live cross-tenant read reachable by the model rather than by a
caller, and no Service-layer seam can reach it.

**Acceptance criteria.**
- [ ] The live-run verbs get a Service-level `Check`: `ApproveRun`'s fast path, `Cancel`, `CancelChild`, `SetMode`'s live branch, `ApprovePlan`, `Persist`. Test: Bob cannot approve, cancel, or re-mode Alice's live run.
- [ ] `InspectSubagent` cannot read a `sub-*` session outside the caller's ownership — via the A4 decorator, or by scoping the tool to the ids this run minted (`parentCaps.children` already tracks them for `SubagentStatus`). Same for `InspectMember` and `resume:`. **No identity enters `engine/agent`** to achieve it.
- [ ] The driver protocol either carries a principal and label on the wire and enforces them, or the driver servers are documented as an explicitly trusted in-cluster transport with a deployment requirement that says so. Not silence.
- [ ] If enforced, the principal and label are on `contracts/proto/mecatl/driver/v1/` (regenerated with `task generate`, never hand-edited) — otherwise they are dropped at the process boundary and the round-trip silently lowers.
- [ ] Team member runs get their own answer. `AddMember` takes no parent session and the gRPC `RunTeam` path has zero parent caps, so this is not a wiring oversight.
- [ ] Session deletion gets a governed surface, or `childgc` is documented as a system-principal actor with the `childSessionPrefixes` scope caveat restated (overriding a family prefix de-scopes those children from GC, and would de-scope them from enforcement too) **and with its real blast radius stated: it deletes top-level sessions too, on `mainRetention`/`mainMaxTotal`, so it is not merely a child sweeper.**
- [ ] A sibling structural test covers the driver servers, since reflection over `*server.Service` cannot reach them.

**Deliverable.** Proto changes or a documented trust boundary, the Service-level checks on the six live-run verbs, the narrowed child-inspect store, the team-member answer, a governed delete or an explicit exemption, one sibling test.

**User stories.**
- As Bob holding Alice's session id, when I approve a tool call on her live run, cancel it, or flip her permission mode, then I am refused — today all three succeed.
- As a prompt-injected agent that has been handed another tenant's subagent id, when I call `InspectSubagent` on it, then I get a refusal rather than the transcript.
- As an operator running a remote driver, when I ask whether it enforces the same rules as the API, then the answer is written down rather than assumed.
- As a security reviewer, when I read the anti-drift test, then it tells me what it does not cover instead of implying completeness.

---

# Track L — labels `[M]`

The access half of the model, at **object** granularity. Per-item labels inside a session are
out: five research angles converged that they are defeated three independent ways, each
silently. The primitive for mixed sensitivity is a separate derived artifact, i.e. fork, which
is the tearline pattern ICD 209 formalised and which every collaborative-document vendor
independently converged on as "move it to its own page."

Access is set dominance. The model is MCS-shaped (non-hierarchical categories, no sensitivity
ladder) rather than MLS-shaped, because a ladder we invent is a ladder users set to one value.

**A label is not a set of IdP group names, and an earlier draft of this doc had that wrong.**
The sibling project put a normalised `Groups []string` on its identity type and the field is now
dead: never populated, never read, with two tests pinning its emptiness and a doc-comment saying
authorization must use the raw claims instead, because group claim names vary by provider
(`groups`, `roles`, `cognito:groups`). Storing IdP group names durably inherits that failure
three ways — a persisted set freezes at create time so revoking a group leaves old sessions
readable forever; the normalisation choice gets baked into durable state so changing a config
mapping silently changes the meaning of every stored session; and two consumers end up
disagreeing about whether the normalised or raw form is authoritative.

The fix is that there are **two values with different lifetimes**. The *caller's* labels are
per-request, derived live from this token's raw claims by a config-driven mapper, and never
persisted. The *session's required* labels are durable — and they are **mecatl's own vocabulary**,
which operator config maps claims into once, at the wire (`cognito:groups: ["eng-platform"]` →
`["team-platform"]`). Downstream nothing ever sees a provider-specific claim name. Staleness goes
away because the caller side is live; provider variation is confined to one config table in
composition; and the dominance check is a few lines over `slices.Contains` with no policy engine.
`governance.Audience` survives as a durable label for exactly this reason: it is a closed set
whose meaning is fixed in code, not an open set mirrored from an external system.

## L1 A label on every owned object, propagated at every creation seam

**Description.** Add the fifth opaque aggregate field and fix the propagation that is already
broken for the four that exist. The template is in the repo:
`agent.SessionOriginScheduleManager` threads the creating session's identity into a durable
object from inside `engine/agent`, stamping it unconditionally and overwriting whatever the
model supplied, bound once per run in `startRun` via `Deps.OriginBinder`. No port widening, no
ctx value, no `parentCaps` change. Copy that shape.

The label type lives in `engine/session`, beside `Owner` from A2, and that home is **free** —
the `core-domain-leaf` depguard rule already allows it, so no depguard edit, no DAG-table edit,
no `CorePackages` entry and no new api baseline. A separate `engine/access` leaf would have cost
all four and is unnecessary. `engine/port` and `engine/tool` are forbidden outright, because
`port→tool` and `port→session` both already exist so either direction closes a cycle — the
documented `FileSystem`/`Workspace` gotcha verbatim.

This issue also carries the prohibitions on what the **model** may do with a label, because a
gate whose operation depends on the model behaving is incomplete without a model-visible
instruction and a test proving it lands (ADR 0070). The LLM performs the derivation and is
prompt-injectable, so robust declassification in the formal sense is unattainable here: an
attacker who gets text into a tool result can influence what reaches any declassifier. The
nastiest version is **justification capture** — if the model authors the rationale a human reads
when approving a release, the attacker wrote the human's decision input. The repo already solves
that exact shape once, in the `#31` ask-reviewer discipline, where the command rides inside the
untrusted fence, `neutraliseFraming` strips forged headers, and the verdict parse requires the
whole output to *be* a single JSON object so a forged verdict echoed inside fenced content cannot
be lifted out.

**Acceptance criteria.**
- [ ] A label type in `engine/session` with a dominance function. Set inclusion over **mecatl's own label names**, no ladder.
- [ ] A config-driven claim mapper in composition turns provider claims into mecatl labels, with a configurable claim name, a documented fallback list, dot-notation traversal for nested claims, and `dedup(nil) == nil` so absent stays distinct from empty. This is the one place provider variation lives.
- [ ] The label is an opaque aggregate field beside `Profile`/`ProviderID`/`ModelID`, written by `setSessionLabels`, persisted in `sessnap`, restored on rehydration, and mirrored into `eventsource.SessionMeta` and `metaSnapshot` for the same reason A2's owner is.
- [ ] Child sessions inherit the label. **Decide whether this needs the label on the child aggregate at all**: children are not enumerable and are reachable only through a parent run, so read control does not require it — but a child that writes a durable object does. If a composition-built store decorator carries the label instead, `engine/agent` stays untouched, which is the cheaper answer.
- [ ] **Raise-only is enforced in `session.SeedHistory`**, which is where all five conversation-copy paths converge: subagent fork, model-switch carryover, `ForkSession`, and the two rehydration folds. One check, five paths.
- [ ] `ForkSession` and model-switch carryover inherit the **source's** label, not the request's. Today `setSessionLabels` writes the request's selector, which is where a lowering bug would be easiest to introduce.
- [ ] Lowering a label is refused everywhere. Raising is an explicit act.
- [ ] Workspace roots are constrained by the label, so an agent cannot re-derive restricted content it may no longer read.
- [ ] A dominance check at each read seam from A4, so a caller who does not dominate a session's label cannot read it or join it.
- [ ] **The floating-label channel is closed.** An implicitly rising label is itself a channel: silently ejecting a participant tells them the label rose. The harness computes a *proposed* label from what the session read and refuses to continue when the proposal exceeds the declared label, dirty-working-tree style, with the raise being a human act.
- [ ] Default when absent: the most restrictive available. Fail closed.
- [ ] One test per creation seam, through the real factory path, so deleting the wiring fails CI (ADR 0070).

Model prohibitions, each an invariant with a test:
- [ ] The model never computes or lowers a label. Labels are computed by the harness from provenance at seams the harness controls.
- [ ] The model never produces a "no confidential content detected" verdict. An LLM redaction checker is acceptable as advisory defence-in-depth that can only *raise* a label or *block*, never approve — the same asymmetry the guardrail `PostToolUse` rule already encodes.
- [ ] The model never authors the text a human reads when authorising a release. The human is shown the exact bytes plus a harness-authored, static statement of the source labels.
- [ ] **There is no declassify tool in any catalog.** If it is in the catalog, injection reaches it. Release is an out-of-band operation on the API surface, authenticated as the human, in the same way `--subagent-ask-reviewer` is deliberately not a permconfig key.
- [ ] A model-visible posture note states the label regime via the `applyXPosture` idiom, with a test asserting it lands in `req.System.StablePrefix` through the real factory path.
- [ ] A cheap non-model laundering check on any release: longest-common-substring against the source. Ten lines, catches the crude verbatim-copy attack, documented as detection rather than defence.
- [ ] While here: `AGENTS.md` says `engine/governance` is "session-free (`session` imports it, never the reverse)". `engine/session` imports **zero** internal packages; both are pure stdlib leaves sharing one depguard rule. The stated permission exists in prose and in neither enforcement mechanism. Fix the wording, since this issue is what makes someone read that rule closely.

**Deliverable.** The label type, the claim mapper, the aggregate field, the `SeedHistory` raise-only check, the dominance check at the A4 seams, the model prohibitions with tests, one test per seam, the `AGENTS.md` correction.

**User stories.**
- As Alice, when I start a session on a confidential engagement and the agent spawns a subagent, then the child cannot escape the label.
- As Bob, who is not read into that engagement, when I try to join or read that session, then I am refused by a set comparison rather than by someone's judgement.
- As an operator whose IdP calls groups something unusual, when I configure the mapping once, then nothing downstream ever sees my provider's claim name.
- As an operator who removes someone from a group, then their access to existing sessions goes away rather than being frozen at create time.
- As a prompt-injected agent, when I try to lower a label or call a declassify tool, then neither exists for me to reach.
- As a human approving a release, when I read the screen, then every word on it was written by the harness and not by the model.
- As a developer, when I delete the label propagation at any one spawn seam, then a test fails.

## L2 The non-session transition seams

**Description.** L1 covers objects that are sessions. These are the seams where a *different*
kind of object is created and the label has to travel, and they are ranked by how likely they
are to be forgotten, which correlates with how far the creation site is from a session and
whether it runs on a detached goroutine.

The worst is `dream` memory consolidation: a background goroutine on the process context with
no session ever in scope, and consolidation is a **join across sessions** because it merges
entries authored by many. A decorator cannot reach it, because there is no session to bake in.
It needs a label on `tool.MemoryEntry`, which is already a domain value object so the widening
is legal.

**Acceptance criteria.**
- [ ] `tool.MemoryEntry` carries a label. This is the only route for `dream`; a composition decorator serves every other memory write but not this one.
- [ ] `dream` consolidation computes the **join** when merging entries of differing labels, and never the meet. An unlabelled entry is treated as most-restrictive.
- [ ] The schedule fire's session inherits the schedule's label, which inherited the creating session's. (Shares the `OriginSessionID` read with A3.)
- [ ] The delivery queue carries a label. A fire session's output crosses into the **origin session's conversation** via a durable sidecar across two runs and possibly two processes; a note may only be delivered into a session that dominates its label.
- [ ] The compaction archive carries the source session's label. **Do not put a label on `session.Event`** — the relay stamps it, since `relayEvent` and `appendEvent` already have the session id and the loaded aggregate has the label. The `port.EventLog` discipline verbatim: the loop emits, the relay persists.
- [ ] `SkillDraft` output carries the label of the session that authored it, because a promoted draft becomes a **system-prompt input for other sessions**.
- [ ] Learned permission rules and guardrail waivers are keyed on `(session, principal)` and are label-scoped, so a rule learned in a restricted session does not apply in an unrestricted one. Today all of it is session-keyed and in-memory, which is the good news: the key is the session id and the session carries the label, so no port widens.
- [ ] **The user-model reviewer's write inherits the originating session's label**, so a restricted session's user-model facts are compartment-scoped rather than global. This is a live leak today: the reviewer fires on session stop in a detached goroutine on `context.Background()`, loads the finished transcript, and spawns a child whose only tool is `RememberUser`, whose output rides `<user-model>` in every subsequent session in every project, gated only by a regex deny-list.
- [ ] The origin reaches that write via a composition decorator over `tool.MemoryStore`, **not** by widening the domain interface and not by a ctx value. `RememberTool.Execute` receives a `session.ToolCall`, which carries no session id, so the origin does not otherwise survive to the write.
- [ ] Project-memory `Remember` gets the same injection scan and fence-tag guard the user-model family already has. Today it has neither, yet it renders into `<memory-index>` on every run.
- [ ] A test-only completion signal or synchronous entry point exists for the reviewer's detached goroutine, so its wiring can have a fails-if-deleted test at all. **This is the wiring most in need of one and currently the hardest to write one for.**
- [ ] Test: a fact written from a labelled session does not appear in an unlabelled session's `<user-model>`.
- [ ] Every seam in the inventory has a test through the real factory path, **except** the two where that is infeasible today, which are documented rather than given an unsatisfiable criterion: the user-model reviewer runs detached on `context.Background()` with no join point, and `dream` is a ticker on the process context. Both need a test-only completion signal or a synchronous entry point first, and the reviewer's is an acceptance criterion above.

**Deliverable.** `MemoryEntry.Label`, the `dream` join, the fire and delivery-queue inheritance, the relay-side archive stamp, `SkillDraft` labelling, `(session, principal)` keying, tests per feasible seam.

**User stories.**
- As Alice, when memory consolidation merges a fact I wrote in a confidential session with one from an open session, then the result is restricted rather than quietly open.
- As Alice, when a 3am fire reports back into the session that scheduled it, then the report cannot land in a session cleared for less than the fire was.
- As an operator, when I read the seam list, then the two seams nobody can test yet are named as such.

# Track S — sharing `[M]`

## S1 Observers, then explicit handoff

**Description.** The smallest coherent multiplayer model, and deliberately not concurrent
prompters. Observers are read-only members: they see the relayed stream and the conversation,
and cannot prompt, approve or resume. That covers most of the real demand and raises **no
authority question at all**, because an observer never causes a run. Handoff then gives one
*active principal* that can be transferred, recorded as an event, with future runs resolving
credentials and permissions against the new principal. That is `SET ROLE`, not multiplayer: at
every instant the root principal is singular, so the delegation chain, the approval routing,
the credential read and the audit root all stay singular and nothing has to become plural.

The authority question, when it does arrive, is settled: **invoker semantics, mandatory.**
PostgreSQL's own documentation says `SECURITY DEFINER` is safe only when `search_path` excludes
any schema an untrusted user can write, so the deputy's name resolution cannot be influenced by
its caller. You cannot set a safe `search_path` on a prompt. Definer-mode agent sessions are not
risky, they are unsecurable, and there is no careful version.

**Acceptance criteria.**
- [ ] A member list where non-owners are read-only. `read` without `write`, falling out of A4's verb table rather than being a special case.
- [ ] Join is gated on label dominance (L1), checked once at join.
- [ ] The UI states the true thing: sharing this session discloses everything in it and everything it can reach.
- [ ] Handoff transfers the single active principal, recorded as an event, with credentials re-resolved at the run-entry funnel per turn and never captured at session create.
- [ ] **Forbidden in v1, each because it fails silently and durably:** definer mode; union of member authority; intersection across members (which makes authority a function of the roster, so adding a reader breaks automations and removing a member grants authority); per-item read control on history; concurrent turns on one session; cross-principal permission learning or approval replay; shared writable memory, soul or user model; any unattended run in a shared session.
- [ ] Each forbidden item is refused in code with a clear error, not merely absent from the docs.
- [ ] Memory writes and the soul/user-model fragments are **off** in a shared session for v1, not "attributed correctly". One branch in composition versus a per-principal routing subsystem.
- [ ] **`docs/agent-identity-model.md` is amended here**, because this issue is what makes it wrong. Doc 1 says "runs are not identities" and puts the credential at the instance tier. Once the root principal can differ per prompt, the chain root and the credential subject move to the **run** tier and `txn` gains a subject. Either amend the tier model or state that multiplayer is out of its scope. While there, reconcile doc 1's phase-2 language with the settled position that mecatl's signatures cover the internal chain for audit and the vMCP auth server asserts the agent for anything crossing the boundary.
- [ ] Also decided here, not earlier: whether an actor **chain** type is needed. It is not for v1 — mecatl's children cross no trust boundary, and the chain already exists as reconstructable data in the child session id scheme plus the per-child `Deps.Role` diagnostics tag. The trigger is a caller-scoped schedule, which genuinely acts for an absent user; at that point add a one-level `Owner.OnBehalfOf *Owner`, not an unbounded chain, and note `ScheduleSpec.OriginSessionID` is where part of the answer already lives.

**Deliverable.** The member list, the join gate, the handoff event, the refusals, the composition branch.

**User stories.**
- As Alice, when I want a colleague to watch a run, then I add them as an observer and no authority question arises.
- As Bob the observer, when I try to prompt, then I am refused.
- As Alice going on holiday, when I hand the session to Bob, then future runs spend Bob's authority and the log records the transfer.
- As an operator, when someone asks for concurrent prompting, then they get a refusal with a reason rather than a subtly wrong implementation.

---

# Track B — authority as a runtime value `[M]`

Today there is **no runtime value representing a parent's current authority.** A child's tool
set is resolved statically, per definition, at build time against the shared catalog. The
per-call knobs are limits and a selector for which pre-built tier to use. The audience tag on
permission rules is a config-parse-time label on rules, identical for every child. So
narrowing is not "wire an existing computation outward"; the noun has to be invented first.

## B1 Authority as a runtime value

**Description.** Invent the noun, then build the root. The shape decision comes first because
the layering rule constrains it. Three candidates: an opaque string on `parentCaps` resolved in
composition (the `forkHistory` precedent); a value object in `engine/governance`, which is a
pure stdlib leaf; a tighten-only field on `RunOptions`, the `MaxRunTokensOverride` precedent.

**Acceptance criteria.**
- [ ] Each candidate evaluated for layering legality, whether the loop stays identity-agnostic, whether it survives persistence and rehydration, and whether it expresses all three axes. One chosen, reason recorded.
- [ ] A session's authority is a runtime value expressing `operations`, `resources`, `constraints`.
- [ ] **The `resources` axis is required, not optional.** A model-created session (a scheduled fire) can name an arbitrary workspace root today, so a child narrowed on tools and posture could otherwise read a strictly larger filesystem than its parent.
- [ ] `constraints` carries the posture ceiling from the `strict < trusted < auto < yolo` ladder and a delegation depth.
- [ ] Persisted with the session so a rehydrated session has the same authority.
- [ ] Names what does **not** travel: turn and tool-call limits stay internal, per doc 2's decision 3.

**Deliverable.** The domain type, its construction in composition, the shape decision written down.

**User stories.**
- As a session created for Alice, when I am asked what I may do, then there is one value to read rather than an implicit answer spread across composition.
- As a developer implementing B2, when I start, then the layering question is already settled.

## B2 Narrow at the three spawn seams

**Description.** The invariant that makes everything downstream meaningful: a child's authority
is computed as a subset of its parent's at the moment it is spawned, and a widening request is
refused at the seam rather than logged. Three seams (`buildChildSession`, the team member
factory, the parallel branch forker), one containment function.

**Acceptance criteria.**
- [ ] One shared containment function: set containment on `operations`, canonicalised prefix containment on `resources`, rank comparison on posture, integer comparison on depth. One implementation, three call sites.
- [ ] A spawn requesting anything outside the parent's authority is refused with a model-visible error, not silently narrowed. Depth enforced at every hop.
- [ ] Fail-safe: an authority that cannot be computed is a refusal.
- [ ] Property or fuzz test: for random parent/child pairs, the child is never a superset on any axis.
- [ ] **Closing AC, the proof.** A subagent whose catalog *includes* Write, spawned by a parent holding only read authority, is refused on Write, and the refusal names the narrowing. The catalog's contents are asserted, not assumed. **Twin:** the same child under a write-holding parent succeeds. Mutation check: deleting the narrowing makes the test fail.

Without the "catalog includes Write" clause the test measures today's static catalog and would
pass whether or not anything was built.

**Deliverable.** The containment function, three call sites, the property test, the proof test.

**User stories.**
- As a parent agent spawning a child that asks for more than I hold, then the spawn is refused.
- As a reviewer told narrowing works, then there is a test that would fail if it did not.

## B3 Resume re-derives authority and never widens

**Description.** A session parks for hours awaiting a human approval and resumes on a different
pod. Its authority must be re-derived, never wider. Where a live caller exists (an approval
click, a parent turn resuming a child, a run-scoped background child) the live binding is the
authority and the stored record is only the bound it is checked against: the record is a cache,
not the authority. The scheduled fire is the one case with nobody present, and it falls to G1's
grant.

**Acceptance criteria.**
- [ ] Every resume path re-derives: reopen-if-completed, interrupt-if-cancelled, recover-if-failed, and the awaiting-approval re-entry.
- [ ] Re-derived authority is checked against the persisted bound and refused if wider.
- [ ] Where a live caller exists, authority comes from the caller.
- [ ] Test: a session parked and resumed in a different process has authority no wider than pre-park.

**Deliverable.** Changes at the run-entry funnel, one test per resume path.

**User stories.**
- As a session resuming on a different pod, then my authority is no wider than it was.
- As an operator whose session parked for six hours awaiting an approval, when it resumes, then it holds what it held before the park and not what the stored row happens to say.

## B4 A project-tier definition cannot take an operator definition's name

**Description.** `AgentDef.Origin` carries a trust tier and the tier is carried, not enforced. A
project-tier definition is read from a mutable workspace and project precedence beats user, so a
definition committed to repository content can take the name of an operator-managed one. Two
legitimately-valid same-name definitions from different-trust sources collide.

`AgentDef.Origin` and `SkillOrigin` are **this repo's own worked example of the failure mode the
label model must not repeat**: both doc-comments say Origin exists "for observability and
inspection only", and every use is a diagnostic field. A carried-but-unenforced label.

**Acceptance criteria.**
- [ ] A project-tier definition cannot inherit the authority or policy of a user- or operator-tier definition with the same name.
- [ ] The distinction is either in the identity path or explicitly in policy, and whichever is chosen is documented.
- [ ] Test: a project-tier def named `deployer` does not receive the operator-registered `deployer`'s authority.

**Deliverable.** The tier distinction plus its test.

**User stories.**
- As an attacker who can commit to the repository, when I add an agent definition named after a privileged one, then it does not inherit that definition's authority.
- As an operator who manages a `deployer` definition centrally, when a project checks in one with the same name, then mine is not shadowed by repository content.

---

# Track D — the auth server becomes enforcing `[T]`

Prereqs: `token-delegation` and `spiffee-authserver`.

## D1 Land both delegation branches

**Description.** `token-delegation` brings the RFC 8693 handler wired into fosite, the
multi-issuer subject-token validator, the `oidc-trust` upstream, CA-bundle plumbing, and the
two-line Cedar change adding a `map[string]interface{}` case to `convertToCedarValue`. Before
those two lines a map-valued claim hit `default: return nil`, so `act` was silently dropped and
no delegation policy could ever match; that is the whole Cedar-side enablement.
`spiffee-authserver` brings the mTLS SPIFFE middleware, the fosite client-authentication
strategy that turns a certificate's URI SAN into an authenticated OAuth client, the registration
policy, and the `client_credentials` grant.

**Acceptance criteria.**
- [ ] Both land on main, along with the branch's four `docs/arch/token-delegation-*.md` notes, since three of them are the specifications for D3, D4 and F3.
- [ ] **A conscious decision on `resolveActor` when `actor_token` is absent.** `token-delegation` returns `client.GetID()` and drops the SPIFFE coupling entirely; `spiffee-authserver` requires mTLS SPIFFE or refuses the exchange. Do not merge both behaviours by accident.
- [ ] The factory's panic on a trusted issuer configured without an expected audience is preserved or replaced with an equally loud failure. Such an issuer accepts any `aud`.
- [ ] The `PostForm`-vs-`Form` write-back quirk the branch's own docs flag is resolved or documented.
- [ ] `MaxRegistrations` being a per-process in-memory counter that resets on restart is fixed or documented as a known limit.
- [ ] The stale `future-directions.md` section referencing a deleted `client_auth.go` is corrected.
- [ ] Discovery's advertised auth method is decided; it is `tls_client_auth` today rather than `spiffe`.

**Deliverable.** Two merged branches, the arch notes, the `resolveActor` decision recorded.

**User stories.**
- As a workload holding an X.509-SVID, when I authenticate over mTLS, then I am an authenticated OAuth client with no secret to distribute.
- As an operator writing a Cedar policy referencing `context.claim_act.sub`, then the claim is actually there.

## D2 Registration says what a client may hold and which definitions it may act as

**Description.** Two halves of one surface. First: `spiffee-authserver`'s client-auth strategy
auto-registers every SPIFFE client with the auth server's *entire* advertised scope list plus
the entire allowed-audience list. So granting `agent:code-reviewer` grants it to everyone and
call 1's refusal never fires. Second: on both branches `act.sub` is the OAuth `client.GetID()`,
which the SPIFFE strategy forces to equal the pod's SPIFFE ID, so the actor is the **workload**
and not the agent definition, and doc 2's whole premise does not hold. Same file, same
registration surface, same test shape.

**Acceptance criteria.**
- [ ] A registration names the scopes that client may hold; auto-registration no longer copies the global list. Audience scoped the same way.
- [ ] A client requesting a scope outside its registration is refused. **Twin:** inside its registration succeeds.
- [ ] No client is granted a scope it cannot use given its grant types. Today an auto-registered client gets `offline_access` with no `refresh_token` grant.
- [ ] A registration lists which agent definitions a client may be issued a token for. A request naming an unregistered definition is refused. **This is leg 1's independently testable property.**
- [ ] `act.sub` in the resulting delegated token names the definition, per the resolution now in doc 2: RFC 9068 §2.2's SHOULD applies to `application/at+jwt`, and call 1's token is never presented as an access token, so minting it with another `typ` puts it outside 9068 entirely. `sub` names the agent, `client_id` names the workload, both present, no SHOULD bent.

**Deliverable.** Registration surface change, refusal paths, the `sub` decision recorded.

**User stories.**
- As an operator registering `code-reviewer` read-only, then it holds read-only and not the auth server's entire scope list.
- As a policy author writing a rule about `code-reviewer`, then the token actually says `code-reviewer`.

## D3 Intersect requested scope against the subject token

**Description.** The mechanism doc 2 assumes and that does not exist. The handler checks
requested scopes **only against the client's registered scopes**; the subject token's own scopes
are never read, never intersected, never down-scoped. So even with D2 landed, a child exchange
can request anything the registration allows regardless of what the parent token holds. This is
what makes call 2 a narrowing step rather than a relabelling step, and it is why the narrowing
lives here rather than in policy: the value the gate compares comes from the token on the
request, so it cannot drift.

**Acceptance criteria.**
- [ ] Granted scope is the intersection of requested scope, the client's registration, **and the subject token's scope**.
- [ ] A request for a scope absent from the subject token is refused whatever the registration says. **Twin:** present in both succeeds.
- [ ] Audience narrowing follows the same rule.
- [ ] A test asserting the intersection directly, not via a demo.

**Deliverable.** Intersection in the handler plus tests.

**User stories.**
- As a parent agent holding read-only, when I request a write scope for a child, then the auth server refuses because it intersects against my token.
- As a security reviewer asking what stops a child widening, then it is an intersection in the handler and not a registration coincidence.

## D4 Nest `act` instead of overwriting it

**Description.** The handler does `Extra["act"] = {"sub": actorID}`, clobbering any inbound `act`
and violating RFC 8693 §4.3. The branch's own `token-delegation-act-chain.md` says it is safe
today only *incidentally*, because subject tokens must satisfy `aud == iss`, and warns that
registering any client with the issuer as an allowed audience would let a delegated token be
re-exchanged with the original actor lost. The consequence for this design: **call 2 narrows and
leaves no record that it did.**

**Acceptance criteria.**
- [ ] An exchange over a token already carrying `act` produces `act: {sub: new, act: {sub: old}}`.
- [ ] Depth bounded; a chain exceeding it is refused.
- [ ] The incidental `aud == iss` protection is replaced by an explicit rule, so it no longer depends on audience configuration.
- [ ] Test: two chained exchanges, both actors present in the final token, in order.

**Deliverable.** Nesting in the handler, a depth cap, tests.

**User stories.**
- As an auditor reading a twice-exchanged token, then both actors are present in order rather than the second having erased the first.
- As an operator registering a client with the issuer as an audience, then I have not silently created a chain-erasure path.

## D5 Bind by `cnf`, not subject equality; sender-constrained end to end

**Description.** The handler requires `actorClaims.Subject == client.GetID()`. With D2, `sub` is
the agent definition and the client is the workload, so the check rejects the very token this
design needs. The replay attack it defends is real, and `cnf` defends it better: the token is
bound to the pod's key, so a leaked one is useless rather than merely attributable. Doc 2's open
question 3 says plainly that nothing else in the design substitutes. This issue also carries the
binding-method decision as its first AC, since that is an afternoon of thinking implemented in
the same change. `future-directions.md` calls certificate-bound tokens *"the highest-value
compliance gap"*; today every delegated JWT is a pure bearer token, and doc 2's work table notes
there is **no tracker**.

**Acceptance criteria.**
- [ ] Thumbprint or DPoP chosen, costed against the actual deployment: mTLS termination point, ingress certificate forwarding, mesh interaction. WIMSE is specifying WPT, which is DPoP-shaped, and states WIT/WPT are not used with mTLS, so certificate binding is the transition case. The AS connection and the gateway connection may not get the same answer.
- [ ] Actor-token acceptance is gated on `cnf` matching the presenting connection, not on `sub == client_id`. The self-issued requirement on actor tokens is preserved.
- [ ] Both leg-1 and leg-2 tokens carry `cnf`; the gateway verifies it and refuses a mismatch. **Twin:** the legitimate holder on its own connection succeeds.
- [ ] Documented deployment requirement: without an mTLS path to the gateway, `cnf` cannot be checked and the token is a bearer token in practice.
- [ ] Coordinated with #5815 rather than diverging from it. A tracker is opened, since none exists.

**Deliverable.** The binding change, minting, gateway verification, a deployment note, a tracker.

**User stories.**
- As a pod holding an agent token whose `sub` is a definition, when I present it as `actor_token`, then it is accepted.
- As someone who lifted an access token from a log, when I present it from my own connection, then it is refused.

---

# Track E — key custody

**SPIFFE does not leave the plan here; mecatl's role flips from issuer to consumer.** The pod
needs an X.509-SVID to authenticate on call 1, the broker holds it, and the selectors have to be
right or E1's attack works.

## E1 Spike: can a model-spawned shell reach the pod's key `[M]` `[S]`

**Description.** Doc 2 marks this **Unverified** and says the design should not rest on the
answer being favourable. Three routes, three different mitigations. Do this first: one day of
adversarial shell work, and it can invalidate the two-leg design's central claim that mecatl
holds no key whose signature carries authority.

Worth knowing before starting: the PoC's isolation is not what its docs claim. Both containers
in `10-sidecar-agent-pod.yaml` run `runAsUser: 0`, and the isolation is the CSI volume being
mounted only on the sidecar, i.e. mount-namespace separation rather than a uid boundary.
`implementation.md` asserts `runAsNonRoot` and `readOnlyRootFilesystem` on the agent container
and the manifest sets neither.

**Acceptance criteria.**
- [ ] Route 1, fetch its own SVID from the Workload API: answered, plus what closes it (a `unix:sha256` selector pinning the binary, which a model-spawned `/bin/sh` fails).
- [ ] Route 2, read the key out of the agent loop's memory: answered. A subprocess sharing a uid can ptrace its parent, so only `unix:uid` closes it.
- [ ] Route 3, inherit the Workload API socket path from the environment: answered.
- [ ] Each answer is a shell transcript, not an assertion.
- [ ] If route 2 is open, the report names which claims in doc 2 weaken.

**Deliverable.** Three transcripts and a one-page finding.

**User stories.**
- As a security reviewer asking whether an injected model can reach the pod's key, then there is a tested answer rather than an assumption.
- As the developer about to build the broker, then I know which routes it actually has to close.

## E2 The token broker at its own uid, and the SPIRE selectors `[M]` `[OPS]`

**Description.** Call 1's ceiling is the whole client registration, so the SVID must not be
reachable from the agent loop. A shell the injected model controls would otherwise perform call
1 itself, ask for `agent:deployer cap:github.write`, and receive the pod's full registered set
with no parent token to narrow against. Calls 2 and 3 bound children; only reachability bounds
the root. The broker is a separate process at its own uid holding the SVID and exposing one
call. It attests nothing and knows nothing about goroutines. It keeps one key out of one address
space, which is the whole job. AgentCore reaches the same property by a different route
("Runtime-managed agent identities cannot retrieve workload access tokens directly"), paid for
with one agent per Runtime per execution role; a uid boundary buys it without one pod per
session.

**Acceptance criteria.**
- [ ] Separate process, own uid, one RPC over a unix socket. Peer pid pinned via `SO_PEERCRED` so a subprocess cannot pose as the loop.
- [ ] Its policy for which agent names a session may request lives in configuration the loop cannot write.
- [ ] Calls 1, 2 and 3 are made by the broker, never by the agent loop.
- [ ] SPIRE registration uses `unix:uid` and `unix:sha256`; a model-spawned `/bin/sh` asking for an SVID is refused. **Twin:** the broker binary receives one.
- [ ] CA-bundle rotation handled rather than loaded once. The PoC accepts a process restart; state whichever is chosen.
- [ ] Adversarial test: a shell at the loop's uid can neither read the key nor obtain a token for an agent name the loop is not permitted. **Twin:** the loop asking properly gets one.
- [ ] Deployment requirement documented, and startup fails loudly rather than open when the separate uid is absent.
- [ ] The PoC's `runAsUser: 0`-on-both-containers arrangement is not carried forward, and its docs are reconciled with what deploys.

**Deliverable.** The broker, its socket protocol, SPIRE entries, manifests, the adversarial test.

**User stories.**
- As a prompt-injected model trying to make call 1 myself asking for `agent:deployer cap:github.write`, then I cannot, because the key lives at a uid I do not have.
- As an operator deploying without the separate uid, then startup tells me the ceiling is reachable.

## E3 mecatl's broker client and token cache `[M]`

**Description.** The loop-side half: ask the broker, cache the result, do not stampede. The
exchanger on `spiffee-authserver` already has the shape worth copying: singleflight-deduped
bootstrap, a delegated cache keyed on `sha256(user token)` with a 30-second expiry buffer, error
bodies truncated so a failure cannot leak a secret into a log. ToolHive's own token cache exists
with zero importers.

**Acceptance criteria.**
- [ ] Bootstrap deduplicated: N concurrent children cause one leg-1 call.
- [ ] Leg-3 tokens cached per user and agent with an expiry buffer. Cache keys are not loggable secrets.
- [ ] Inventoried per ADR 0027's resource lists, since it outlives a call.
- [ ] Fan-out test: 8 concurrent subagents produce a handful of token calls, not 8 or 24.

**Deliverable.** Broker client, cache, an ADR 0027 inventory row.

**User stories.**
- As the agent loop needing an outbound token, then I ask the broker and get a cached one in milliseconds.
- As an operator watching a fan-out, then the auth server sees a handful of requests rather than one per child per hop.

---

# Track F — the gateway `[T]`

## F1 The resolved target as a value only admission can construct

**Description.** Doc 2's cheapest structural fix. The credential read currently happens in
authentication middleware **before the JSON-RPC body is parsed**, so nothing there knows what is
being called. Moving it is necessary but leaves nothing preventing a second early call site
later, which is exactly how the current behaviour arose: the read was put where the token was
validated, which was reasonable in isolation. If the read's signature demands a resolved target
that only admission can construct, a caller in auth middleware has nothing to pass and the early
read stops being expressible. Target binding becomes a rule the compiler applies.

**Acceptance criteria.**
- [ ] A resolved-target type carrying tool, operation, canonical resource and a credential selector.
- [ ] Only admission can construct one.
- [ ] A deliberate attempt to read a credential from auth middleware does not compile.
- [ ] The backend, which currently reaches the admission seam and is dropped before policy, is preserved through to policy. Today a call to an unadvertised name gets a synthesised tool with no backend at all.
- [ ] The credential selector's exact shape and its uniqueness rule are decided here, since F3 needs them.

**Deliverable.** The type, the constructor restriction, the compile-time negative test.

**User stories.**
- As a developer trying to read a credential before admission ran, then it does not compile.
- As a policy author writing a rule about a backend, then the backend actually reaches policy.

## F2 Cedar evaluates the right things, safely

**Description.** Four related stringly-typed problems, one change set. The agent arrives as
`context.claim_act.sub` matched with a `like` glob, so a policy naming a nonexistent agent, or
one whose casing or path segments drift from the token, matches nothing and reports no error.
`claim_scope` arrives as a space-delimited string alongside the set form, so
`like "*cap:github.read*"` also matches `cap:github.readwrite`. The PoC matches the human by
`context.claim_email == "devops-user@example.com"`, a mutable, non-unique, IdP-controlled
attribute used as the authorization subject. And the read/write hint is absent by default with
no classifier, so a rule omitting `== true` silently permits unannotated tools.

**Acceptance criteria.**
- [ ] An `Agent` entity type with a schema; the agent is the `principal` in delegation policies. A policy naming an agent absent from the schema fails validation **when written**, not silently at evaluation time.
- [ ] Scope comparisons use the set form with `containsAll`. `cap:github.read` never satisfies a rule requiring `cap:github.readwrite`. `scope` is listed in the authorizer's multi-valued claims; a rule referencing a set that was never built errors and denies, which is refuse-on-missing-input working as designed.
- [ ] `grantedScopes` is populated from the token on the request so it cannot go stale.
- [ ] Policies name the user by a stable issuer-scoped identifier; email is an attribute for readability and never the matched subject. An OAuth-only upstream produces a correct user identity (#6053).
- [ ] A tool with no read/write annotation is treated as **mutating**. Per-tool operator overrides remain the escape hatch and are documented as such.
- [ ] The same refuse-on-missing rule applies to every decision input: a missing policy, a missing resolved target, a missing annotation all deny rather than guess.
- [ ] **`aws_sts` is addressed here.** Four of five outbound strategies derive a credential without reading inbound claims; that one reads them *authority-bearingly* (the claims select which IAM role to assume, and it hard-fails when absent), so a discarded or forged actor claim changes outbound authority directly.
- [ ] Existing PoC policies migrated, not left as the example.
- [ ] **Recorded, not built:** Cedar has exactly one transitive relation it evaluates for you, `in` over `parents`, and provenance-taint and session containment both want that slot. Cedar also has no production-ready "which resources can this principal see" query — the partial-evaluation and resource-query types are behind experimental feature flags. Note both so a future reader does not attempt provenance-as-policy.

**Deliverable.** Cedar schema, entity construction, identity construction, the annotation default, policy migration.

**User stories.**
- As an operator writing a policy naming a nonexistent agent, then it is rejected when I write it.
- As an operator granting `cap:github.read`, then a token holding it cannot satisfy a rule requiring `cap:github.readwrite`.
- As a user whose email changes, then my authorization does not change with it.

## F3 The credential read: keyed on the user, behind the gate, one credential

**Description.** One issue because it is one change set. `upstreamtoken.TokenReader` has a single
method taking a session id and returning **every** credential for that session, called from
authentication middleware before the body is parsed. So a subagent narrowed to one repository can
trigger a call to another service and nothing in the credential path objects, because by then the
credential is already loaded. And when the session pointer is absent the loader returns an empty
map with **no error**, so what reaches the backend depends on which outbound strategy runs.

**`tsid` is not a decision still open here.** The design discarded it, doc 2 hop 6 keys the read
on the user, and `token-delegation-tsid.md` writes it as an invariant: *a delegated token MUST
NOT carry `tsid`.* The branch closed half the loop, stopping `tsid` riding a delegated token, and
did not re-key the read. That mismatch is exactly why `upstream_inject` returns 401 for an agent.
So finishing the re-key **is** what unblocks the stored-credential path, and it cannot be a
separate issue: you cannot change the reader's signature without fixing the consumers that index
the old map by a static provider name. This is what makes Scenario B exist, and Scenario B is the
realistic one, because it needs no special grant from the provider while Scenario A needs an
enterprise auth server implementing ID-JAG.

**Acceptance criteria.**
- [ ] The read takes a user and a resolved target and returns **at most one** credential.
- [ ] The user comes from the verified token's subject, never a session pointer and never a header.
- [ ] A credential stored for one user is never returned for another, **checked at the read** rather than assumed from the key. `ErrInvalidBinding` is declared today and returned by no implementation.
- [ ] The read runs after admission allowed the call, using the same target admission decided on.
- [ ] A refused call reads no credential at all, observable as a **read counter at zero**. **Twin:** an allowed call reads exactly one, and it is the right user's.
- [ ] A missing credential fails the call. The backend is never called without one, and an empty result never falls through to a strategy.
- [ ] `upstream_inject` serves a delegated token. The `tsid` invariant is preserved; the fix is the read key, not restoring `tsid`. #5194's effect is accounted for.
- [ ] End to end: Alice's subagent calls the GitHub MCP server through the gateway with a delegated token and gets the diff.
- [ ] The enterprise deployment's user-keyed storage decorator is reused for what it does, honouring its authors' warning that how a session maps to a user must be settled first or re-keying can reintroduce a cross-user path.

**Deliverable.** The interface change, the ownership recheck, the moved read, the strategy fixes, an end-to-end test.

**User stories.**
- As a subagent confined to `cap:github.read`, when I call a tool needing a different integration, then the call is refused and the store read counter is zero.
- As Alice, when my subagent calls GitHub through the gateway, then it works, using my stored credential, keyed on me.
- As Bob, when a bug would have handed me Alice's credential, then the ownership recheck refuses.

---

# Track G — unattended work `[M+T]`

## G1 Two schedule types, a signed envelope, consent the model cannot author

**Description.** Nothing can mint a credential naming Alice from nothing at 3am, and no
specification offers a way: every shipped system either replays something captured at consent
time or degrades to a service identity. So the grant is captured at schedule creation. But
scheduling is model-facing, which means a prompt-injected agent can create recurring work, and
"captured with consent" means nothing if the model can cause the consent. The agent still holds
nothing of Alice's: the refresh token lives in the credential store, scoped to one user and one
provider, revocable, which is *safer* than a system able to mint her credential at will. One rule
adopted verbatim from the credential-broker draft: **the PDP must not evaluate justification text
for approval decisions**, because agent-authored prose influencing a decision is the whole
injection surface.

**Acceptance criteria.**
- [ ] Two schedule kinds as **separate types**: user-delegated (owner Alice, subject Alice) and service-owned (owner a service principal, no subject). The failure mode this prevents is one silently becoming the other.
- [ ] Creation produces a pending authorization that does nothing until confirmed.
- [ ] Confirmation happens through a channel the model cannot author, and confirms account, resources, cadence and an absolute expiry.
- [ ] No agent-authored text reaches the approval decision.
- [ ] The schedule stores a **signed envelope**, verified before every fire, so mutating the row without re-signing invalidates it and widening needs fresh consent. The envelope format, its signer, and which component holds the refresh token are decided here.
- [ ] Adversarial test: an injected agent creates a schedule and nothing runs.

**Deliverable.** Two types, the pending-authorization flow, the envelope, the adversarial test.

**User stories.**
- As a prompt-injected agent scheduling work against Alice's GitHub account, then nothing runs until Alice confirmed it through an interaction I could not author.
- As Alice confirming, then the 3am run works and acts as me.

## G2 Grant lifetime bounded by the schedule; never fall back to a service identity

**Description.** Refresh-on-use lets an unsupervised agent extend a credential forever;
refresh-on-login stops a working schedule for invisible reasons. A schedule has an expiry its
owner set, and its grant refreshes only while it lives. When the grant is gone the run fails and
surfaces reauthorization. It must never fall back to a service identity, because that converts
Alice's job into somebody else's and makes the audit record false.

**Acceptance criteria.**
- [ ] Refresh happens only while the schedule lives; the schedule's expiry bounds the credential, not the reverse.
- [ ] A gone grant fails the run and surfaces reauthorization to the owner.
- [ ] **No code path substitutes a service identity for a user-delegated schedule.**
- [ ] Test: expire the grant, fire the schedule, assert the failure and the absence of a fallback.

**Deliverable.** Refresh bounding, the failure path, tests.

**User stories.**
- As Alice whose schedule grant expired, then I am asked to reauthorize rather than discovering a service account has been doing my work.
- As an auditor reading a 3am run's record, then it names whoever actually held the authority.

---

# X1 The escalation proof `[M+T]`

**Description.** The one demo with its own issue, because it spans both repos and nobody else
owns it, and because it is what funds the rest. Doc 2's own phase-1 proof slice: Alice, two
agents, one GitHub tool. `code-reviewer` registered read-only, `deployer` registered
write-capable. **One agent proves nothing** — a single-agent run never requests a second
definition, so the interesting step never executes and the demo passes whether or not it is
guarded. The other demos are folded into the closing acceptance criteria of the tracks that
produce them: B2's narrowing proof, E2's adversarial shell test, F3's read counter, D5's replay
twin, A5's tampered snapshot, L1's per-seam tests.

**Acceptance criteria.**
- [ ] The injected parent calls `Subagent(agent: "deployer")` and the resulting token carries no write scope.
- [ ] The gateway refuses the write, and no credential is read either way.
- [ ] **Twin:** the operator runs `deployer` as a top-level session and the write succeeds. Without this you cannot distinguish "escalation blocked" from "deployer is broken".
- [ ] The two token payloads are shown side by side with the scope shrinking between them.
- [ ] Assertion discipline follows `test-sidecar-delegation.sh`, which checks real HTTP status codes. It does **not** follow `run-demo.sh` Act 3, whose delegation matrix is a hardcoded `printf` and whose intern-user Cedar denial is printed without a tool call ever being made.

**Deliverable.** A runnable script plus a short walkthrough a non-author can read.

**User stories.**
- As a security reviewer watching an injected agent try to escalate to `deployer`, then I see the scope shrink between two token payloads and the write refused, and I see `deployer` still works when the operator runs it.

---

# Deferred, each with a trigger

One tracking issue. A deferral with no stated trigger is a decision nobody revisits.

| Deferred | Un-defers when |
|---|---|
| **mecatl as its own SPIFFE issuer** — own signing keys, own bundle endpoint, own trust domain, the `delegation_chain` / `authorization_details` / `depth` claim vocabulary, KMS root plus in-memory intermediate, JWKS endpoint. Deferred **out of this plan, not indefinitely** — see [Sequencing the issuer](#sequencing-the-issuer). Nothing in the tracks above needs it: attribution is A2's log annotation, attenuation is B2's spawn seam, integrity-against-a-store-writer is A5's MAC, and doc 2's own revocation argument says a credential naming an instance would be *"a credential in form and a log field in effect."* **Two conditions on the deferral:** pick and record the trust-domain name now, mint nothing; and do not design the claim vocabulary for the outbound hop, because the consumer that needs it wants a different token. | The filesystem grant service (`docs/scoped-resource-grants.md`) is built. It is not one possible consumer among several, it is *the* consumer, and it is not substitutable by the vMCP auth server. Also un-defers for a regulated deployment or an external auditor who must verify a chain without trusting the harness's log. |
| **A `Labels` field on the durable owner.** A2 ships `Owner{Subject, Issuer}` and nothing more. L1's session-required labels are a separate durable field with their own writer; the *caller's* labels stay per-request and ephemeral. Adding a normalised label set to the identity type itself is the shape that died in the sibling project — a field with no reader, then two tests pinning its emptiness. | A second reader exists. Until then `Subject` alone gates the real case, and the deployment mecatl ships today has one shared token. |
| **Per-item labels inside a session.** Defeated three independent ways, each silently: nothing stops the model including restricted content in an answer; the agent re-derives the source under a different prompter's turn, unlabelled; and compaction folds the label away because the summariser has no provenance channel. Object granularity (Track L) dodges all three. | Someone shows a real case that fork cannot serve. Note the industry evidence against: Google Docs, Notion, Confluence and SharePoint all declined per-range **read** permissions, and Google shipped range *edit* protection in Sheets and pointedly not read protection. |
| **mecatui logs in** (auth-code + PKCE, device code for headless, cached and refreshed token). Also fix the loopback auto-reuse probe, which dials `127.0.0.1:8080` with no credentials, so a token-protected local mecated fails that path. | The demos are proven and humans other than the authors start using it. Until then, script a token, which is exactly what the ToolHive PoC does. |
| **Deployment hardening beyond A5**: an Ingress or Gateway, TLS terminated somewhere named, the shipped manifest authenticated by default, `GET /drain` (currently outside auth on 0.0.0.0) moved inside or documented as an accepted kill-switch, and an authentication section in ADR 0048 which has none. | Anything is exposed beyond a port-forward. `deploy/service.yaml`'s own "do not expose this, it is unauthenticated" warning is the current honest state. |
| **Resource-level authority.** RFC 9396 `authorization_details` carrying structured resource fields, so the gate tests containment over the resolved target rather than a scope string. Deferred because nothing in vMCP implements it, because §6.1 leaves comparison of two authorization-detail requests unspecified so the narrowing rule would be ours to define, and because phase 1 is provable without it. | One agent must be confined to a subset of a backend another agent may reach in full. Scope cannot express that. Denying a call to a *different repository* is the phase-2 proof and phase 1 cannot express it. |
| **Per-agent credential isolation.** Three alternatives, not steps: gate a shared credential in policy (**we have this**, it is F2); narrow what the provider sees (per-provider, and impossible for a stored user OAuth token since nothing can narrow a credential it did not mint); one credential per agent (where AgentCore and Entra both are). | Two conditions together: a second agent needing different authority from its siblings, **and** a record of the user consenting to a named agent. The second is the hard one — without it a per-agent storage key partitions credentials by an agent nobody authorized. And a scheduled run has nobody present to consent, so the only available pattern is an administrator deciding in advance for a class of agent, substituting organizational authorization for Alice's. That is a policy decision someone signs, not a technical gap. |
| **Rekor-style transparency anchoring** of the event log, over **digests only**. Anchoring prompt content to a public log is an exfiltration channel, not a defence. | Tamper-evidence on the audit log becomes an external requirement. |
| **Signed per-call instance attribution.** No credential names an instance, because an instance is a goroutine: cancelling it is the revocation and mecatl does that directly with no credential involved. | Instances stop being goroutines. A subagent in its own process or pod is independently addressable, can hold a key, and can be revoked alone, at which point the two-token shape becomes correct. |
| **Child-to-parent result attestation.** Every standard flows parent to child; nothing lets a child return signed proof of what it did. | A consumer must trust a child's report without trusting the harness. |
| **Cross-trust-domain audit correlation.** Txn-Tokens stop at the domain boundary. Two join keys, two boundaries, neither spans both. | An auditor needs one query across mecatl's log and a downstream's. |
| **Content shredding for a departed member.** "Remove access" is a membership row and is tractable; "remove contributions" is not, because the log is append-only by design and turn 40 is a function of turns 1 to 39. The offerable version is attribution-retained, content-shreddable: payloads addressable and delete-able, skeleton kept. | A retention or erasure obligation lands. Do not ship a "delete my messages" button on a shared session before then; it cannot mean what a user will read it to mean. |

---

# Sequencing the issuer

The issuer is deferred out of this plan and it is **not** deferred indefinitely, because
`docs/scoped-resource-grants.md` requires one. That doc is explicit about it:

- **Attenuation is an issuer RPC, not client-side token math.** A holder calls the issuer with
  its grant and gets a narrower one back. The issuer is therefore the policy point and it holds
  the delegation graph, which is what carries the "revoking a token must also revoke everything
  derived from it" obligation.
- **Offline verification is required.** Services verify tokens with no issuer call on the data
  path.
- **The issuer sits on the renewal path**, and the ordinary revocation mechanism is the issuer
  declining the next renewal.
- **Push-based revocation** to the token's single audience stays available as an escalation,
  tractable precisely because audience binding means every token has exactly one recipient.
- **The audience is a SPIFFE ID**, with holder proof so a leaked token is not a usable token.

This is not substitutable by the vMCP auth server, for two reasons. The grants are over mecatl's
own workspace resources on a hot path, so routing them through a gateway's AS is both
architecturally wrong and a latency problem. And the holder requesting attenuation is a subagent,
i.e. a goroutine, which no SPIFFE mechanism and no SPIRE attestor can attest. That is doc 1's
central argument arriving with an actual customer rather than a hypothetical one.

**So build the issuer with the FS service, not before it and not for the outbound hop.** Two
practical consequences.

First, the FS grant's requirements are a **superset** of doc 1's, and in one place the two
conflict:

| | doc 1's instance credential | the FS grant token |
|---|---|---|
| role | signed provenance, never an authorization input | **is** the authority, verified offline by the service |
| lifecycle | ephemeral, re-minted on demand | two TTLs; the issuer declining renewal is the revocation |
| revocation | lists considered and explicitly rejected as heavier than a minutes-long TTL | push to the single audience, kept as an escalation |
| attenuation | issuer-side at the in-process mint seam | an issuer RPC a holder calls |

These are two token designs sharing one issuer. Built for the outbound hop first and retrofitted,
that mismatch surfaces late. Built for the FS grant, doc 1's audit chain is a small addition on
top: the signing infrastructure, the bundle endpoint and the trust domain are shared, and only the
claim set differs.

Second, the trust-domain name is the one decision that cannot wait, because it is a one-way door
and it is free today. Record it in the shared contract during wave 1.

---

# Open questions still unowned

Each blocks the wave named.

1. **Which SPIFFE client-authentication method** — JWT-SVID assertion, X.509-SVID over mTLS, or WIT-SVID. Related to D1 and D5 but a distinct choice. Blocks wave 1.
2. **Definition-based or instance-based external authorization.** D2 assumes definition-based; if that is wrong, D2 changes shape. Blocks wave 2.
3. **Whether creation gets a fifth verb or a parent object reference.** Blocks A4's verb table, so blocks wave 2.
4. **Whether the driver protocol enforces or is declared trusted.** Blocks A6, so blocks wave 2.
5. **Whether the access token is a profiled JWT or opaque plus introspection.** Blocks wave 3.
6. **Whether per-agent consent is a product requirement, and who holds the record.** Blocks the per-agent-credential deferral permanently until answered.
