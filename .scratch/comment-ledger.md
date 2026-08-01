# Comment ledger — agent identity work

Every comment and finding from this review round, with its current status.
Nothing is dropped: items that turned out to be already-handled stay here marked
so, because "we checked this" is worth recording.

**Status key**

| | |
|---|---|
| `LIVE` | Still stands, not yet sent or not yet addressed |
| `SENT-FIXED` | Posted on #321, author addressed it, thread resolved |
| `DISSOLVED` | Covered by existing tracked work — records that we checked |
| `INBOUND` | ToolHive's own tracking corrects **us** |
| `FOLDED` | Now in `docs/agent-identity-outbound.md` — see section B |

Everything below is one team's work across mecatl / vMCP / ToolHive. No item is
an "ask to another team".

---

## A · Live comments on the #321 doc

Corrections to the author's existing prose, deliberately kept out of the fold
commit so they stay the author's to apply. Text for each is in
`.scratch/combined-fold-and-corrections.md` (the version where they were applied)
and `.scratch/combined.patch`.

| # | Where | Finding | Status |
|---|---|---|---|
| A1 | 3 sites | **"Cedar already evaluates SPIFFE IDs in `act.sub`"** is false in all three places it appears. Cedar is claim-generic; SPIFFE appears in two test files matched by a string glob that would treat `"banana*"` identically; the mint puts the OAuth `client_id` in `act.sub` with no SPIFFE parsing. Load-bearing, because it is the sole support for "the attenuation is enforceable by the backend". | LIVE |
| A2 | scenarios intro | **"live, code-complete testing ground where the integration points already exist"** overstates. The mint exists and is hardened; no client that may use the grant can be provisioned, so it is reachable only via a test seam. Accurate: the code path exists, the deployable configuration does not. | LIVE |
| A3 | Scenario B | **Self-contradiction.** One bullet says only ToolHive's AS can mint a `tsid`; the next asks mecatl to "bind the `tsid` it emits". mecatl never emits one, so the unilateral guarantee asked of it is not available. Strengthens the bullet's own conclusion — the fix is on the read seam. | LIVE |
| A4 | Scenario A intro | **"mecatl's chain rides the token the whole way"** is false. The XAA strategy reads the stored upstream ID token and never the claims map, and step 5b has the backend's own AS mint a fresh token. The chain reaches vMCP and stops. Also undercuts the enforceable-by-the-backend claim. | LIVE |
| A5 | Scenario A | **Breaks two steps earlier than the prose predicts.** Doc says it stops at 5b for a public SaaS; it stops at step 4 for *any* backend, because inbound validation is self-issued-only. And 5a fails structurally: XAA is the one strategy of seven that cannot work from a foreign-issuer token. Constructive route: `token_exchange` survives in no-subject-provider mode and would make Scenario A independent of the `tsid` conflict. | LIVE |
| A6 | P3 | **The stated mitigation is not one.** Edge writes a signed binding, store records it, audit cross-checks — but a *compromised* edge holds the binding key and signs Bob-as-Alice consistently in both places, so the cross-check agrees with itself. What bites: persist the originating IdP assertion's issuer + `jti` so an auditor re-verifies against the IdP's keys, independent of the component under suspicion. | LIVE |
| A7 | threat model | **Three threats the architecture implies and the model misses.** (a) A delegated token carrying the credential-store reference — a narrowed child reaches the *full* store, so attenuation is bypassed at the credential layer; distinct from P4 (store compromise) because this is legitimate delegation over-reaching by construction. (b) A Redis-write adversary, distinct from a compromised pod: far likelier against an unauthenticated store, and **cannot sign** — exactly who chain-signing defeats, so merging the rows undersells the mitigation. (c) Bundle/JWKS poisoning: for a design whose value is *offline* verification, a substituted bundle means every verifier accepts forged chains. | LIVE |
| A8 | P1 | **"Cryptographic identity does not help here" overshoots.** `constraints.posture_ceiling` is precisely an identity-carried ceiling on what an injected main agent can grant a child, and the Entra hard-block pattern is cited elsewhere as stronger than issuer correctness for this reason. Cutting the other way: the defences P1 leans on are posture-conditional, since guardrails demote to advisory under `yolo`. | LIVE |
| A9 | P5 | Confidentiality half has no named mitigation, though the doc commits to Redis auth/TLS elsewhere. And transparency anchoring must be **over digests only** — anchoring prompt content to a public log is an exfiltration channel. | LIVE |
| A10 | claims table | Minor: single-audience is stated as *preferred* rather than required. A downstream re-presenting a child SVID to a sibling backend is the classic confused deputy. | LIVE |
| A11 | Scenario B | **An agent can never carry a `tsid`, for two independent reasons** — no browser flow at the agent so nothing mints one, and the exchange passes an empty session link so any inherited one is dropped. So Scenario B is not "running on a missing check" as A3 implies; it is describing the forward-the-user's-JWT shape while the surrounding design is the exchange shape. Step 4 has nothing to extract. **Stronger and more central than A3 — supersedes it as the headline.** | LIVE |
| A12 | delegation semantics | **"The chain is never an authz input" cannot hold alongside "the user appears only in the chain."** The credential belongs to the user, so the lookup keys on the user; the inversion puts the user in the chain; so either the chain is readable for that purpose or the user goes where the lookup can see it. This is also where jbeda's authorizable-root-principal point lands, from the rate-limit and user-store direction. | LIVE |
| A13 | scenarios / claims | Cedar has **no SPIFFE-awareness**, now code-confirmed rather than inferred: claims arrive via a generic `claim_` prefix, `act` as an ordinary nested record, and the SPIFFE IDs in its fixtures are matched by a glob that treats any prefix alike. The shipped mint puts the OAuth `client_id` in `act.sub`. A SPIFFE-named policy needs `client_id` to *be* a SPIFFE URI, which only the deferred SPIFFE client-auth path produces. | LIVE |
| A14 | claims table | The Cedar principal entity is `Client::<sub>`, so whichever identity sits in `sub` is what a rule can name as the principal. Bears directly on the inversion: with `sub` = acting instance, the user is not nameable as principal. Worth stating in the doc since it constrains what policy can express. | LIVE |

## B · Moved into the design doc, not into theirs

**Changed since first written.** These were originally folded into their doc as commit
`007c60a3` (121 insertions). That commit was amended down to 15 lines once we decided the
design should stand alone — it now only marks the outbound hop open and says the design is
worked separately. Everything below lives in `docs/agent-identity-outbound.md`.

| # | Content | Where now |
|---|---|---|
| B1 | The two-boundary framing: hop 1 constrains hop 2 | design, overview + hops |
| B2 | Hop-3 options and the who-must-cooperate criterion | design, hop 3 |
| B3 | What the SVID buys | design, hop 3 — **revised**, see J. Client auth and the policy subject are one decision |
| B4 | Subject-token acceptance as the real gate | design, hop 3 + change tables |
| B5 | Static `Headers` map as today's outbound floor | design, hop 4 |
| B6 | Per-definition keying and caching | design, hop 3 — **revised**, see J |
| B7 | `callID` needs sanitising before becoming a path segment | **dropped** from the design as out of scope; still LIVE as a comment for their doc |
| B8 | SPIFFE-ID vs alias for policy stability | design, hop 3 — now a path-design recommendation rather than an objection |
| B9 | Standards references | design, references |
| B10 | The SPIFFE deferral's cost | design, hop 3 + change tables |

## C · Where ToolHive's tracking corrects us

| # | Our claim | The correction | Status |
|---|---|---|---|
| C1 | RFC 9068 §2.2 makes `client_id` REQUIRED in conformant JWT access tokens, so the consent check's `client_id` arm needs no vendor feature and no `may_act`. | True of *conformant* tokens; conformance is not universal. [#5989](https://github.com/stacklok/toolhive/issues/5989) records that real external tokens frequently carry no `client_id` and fail the check closed — Okta and Entra often use `appid`/`azp`. Their direction: authorize the external path on trusted-issuer + audience-is-us + valid signature. Our argument was too clean. Corrected in the fold. | INBOUND |
| C2 | "The `spiffee-authserver` branch is a genuine dead end." | Right on facts, wrong on implication. #5194 lists SPIFFE actor identity as *deliberately deferred* — "we explored it in `spiffee-authserver` and extracted the OAuth-only path first." It is a descope, not abandonment. | INBOUND |
| C3 | The unreachable delegation grant is "probably news to them." | It is not. PoC branch plus epic #5194 tracking productization. Belongs in a report as context about where work sits, not as a discovery. | INBOUND |

## D · Dissolved by existing tracked work

Checked, and already designed or in flight. Recorded so nobody re-finds them.

| # | Finding | Covered by |
|---|---|---|
| D1 | Subject tokens must be ToolHive-AS-issued; multi-issuer validator has no callers | #5194's "two trust models" (federated via `oidc-trust`); validator landed in #5814; wiring + consent model tracked in #5989 |
| D2 | `actor_token` rejected at the handler | #5815 (open), with a binding check `actor_token.sub == authenticated_client_id` that is better than what we would have proposed |
| D3 | Cedar cannot read `act` | #5194 step 4; audit half closed in #6035 |
| D4 | Multi-actor chaining (`act.act…`) unsupported | Explicitly out of scope in both #5194 and THV-0079 §2.2 |
| D5 | No SPIFFE client auth on `main` | Deliberately deferred, #5194 out-of-scope list. See C2. |

## E · Live work items (tracked as session tasks)

| # | Item | Task |
|---|---|---|
| E1 | `xaa`-survives error in the `tsid` consequence table; `token_exchange`/`aws_sts` survive in no-subject-provider mode and that is undocumented | #1 |
| E2 | `tsid`-keyed read never re-checks inbound `sub` against `stored.UserID`; `ErrInvalidBinding` declared and never returned. **Credit: the #321 author's own doc, not our review.** | #2 |
| E3 | How does a confidential client get provisioned? #5194 says "confidential clients only" as intent; DCR hardcodes public, rejects any auth method but `none`, permits only `authorization_code`/`refresh_token`; no static-client config. No sub-issue appears to track it. `client_secret_basic` already works mechanically, so this is provisioning only. | #3 |
| E4 | Grant wired but not advertised in discovery; only `none` advertised as an auth method | #4 |
| E5 | Write up what the SPIFFE deferral costs mecatl, plainly | #5 |
| E6 | **The `act`/`tsid` conflict** — the one architectural item untracked anywhere in #5194 or its sub-issues | #8, #9, #10 |
| E7 | Operator provider auto-select: `resolvePrimaryUpstreamProvider` is `len()`-then-`[0]` with no type discrimination, byte-identical on all branches; trust-only types land in the same slice. Cheap now, a CRD migration after either branch merges. | — |
| E8 | The branch handler accepting `actor_token` has no consent check, flat `act`, no depth cap. Port the strategy onto the hardened handler, not the reverse. | — |
| E9 | Minor: smart quote where CEL needs `''`; RFC-0080 number collision with the shipped skills-lock-file RFC; stale act-chain doc describing flat-overwrite as unfixed | — |
| E10 | **No authz policy is fail-open, with credentials wired.** `BuildAuthzConfig` returns nil when absent → `allowAllAdmission` → `AllowToolCall` returns `(true, nil)` unconditionally. Admission is the only thing between an inbound call and credential injection. Allow-all is defensible for an unconfigured proxy and dangerous once a credential store is attached; nothing links the two decisions. **Send independently of the design work — live on default config.** | #11 |
| E11 | **`BackendID` never reaches the policy engine.** It exists on `vmcp.Tool` but `admission.go` passes only `tool.Name`, so a rule cannot key on which backend a call routes to. Plumbing gap, not a design constraint. | #12 |
| E12 | **Pinning `primaryUpstreamProvider` silently strips the actor.** `resolveClaims` uses that provider's access-token claims and discards the ToolHive-issued ones, so `claim_act` vanishes and a policy stops matching rather than starting to fail. Same config as the deny-all finding; this consequence is worse because it is silent. | #12 |
| E13 | `readOnlyHint` is backend-declared and `nil` for unannotated tools, with no fallback classifier. A policy default has to be chosen explicitly. Decision, not a bug. | #12 |
| E14 | `pkg/vmcp/cache` declares `TokenCache`/`KeyBuilder`/`CachedToken`/`StatsProvider`, tested, referenced nowhere outside its own package. `token_exchange` and `aws_sts` keep private per-config caches. The seam for the cache that XAA-at-fan-out needs already exists unwired. | #12 |

## A′ · The author's open question, and our answer

They closed their review response with: *"Still open and I'd love your read: the `act`-as-authority-at-definition-tier vs audit-only tension (your A0/A1, Jakub), which mostly lives in your stacked outbound doc."*

**Decision: do not answer as a standalone comment.** The answer identifies a fork without resolving it, which returns the question to them on the thing we are mid-way through designing. It goes into the end-to-end walkthrough instead, where the resolution arrives with the mechanism.

| | Answer, for the walkthrough |
|---|---|
| The §4.1 question | **Their restatement already resolves it.** "Authz keys off `sub` + `authorization_details`, the chain is signed provenance, the current actor stays an authority input" is conformant — §4.1's rule is a closed set of two, and only *prior nested* actors are informational. No change needed. Say so rather than re-litigating. |
| What is actually open | A12 above — the chain cannot be both unreadable and the only place the user appears. |
| The tier | **Definition, and not as a tradeoff.** XAA runs two round trips per proxied call with no cache wired, so per-instance keying yields a near-zero hit rate exactly at fan-out. Attribution carries the instance as a non-authorizing correlator. |
| How much `act` must carry | Probably less than either doc assumed. A child's tool catalog is definition-determined, so most narrowing can live in policy; only genuinely per-call authority bits (read-only vs read-write) need to travel. |

## Context for whoever posts these

- **jbeda has three open threads**, and two are substantive: the root principal being authorizable (same axis as A12), and the per-call cost of minting for every outgoing tool call (same axis as the caching argument). Not ours to resolve, but any comment touching those axes should acknowledge them rather than arrive in parallel.
- **jbeda called Claude output "slop" twice** on this PR, about his own build/buy draft. Keep posted comments short and specific; no long preambles.
- **The author asked for build-vs-buy data points** and jbeda supplied them (go-spiffe for verify only, go-jose for signing, sigstore for KMS custody, five transitive JWT libraries to consolidate, Biscuit as a timeboxed spike). Nothing for us to add.
- **jbeda asked for a concrete end-to-end scenario** with the threats it defends against. The author said that is the gap they have not filled. That is what the walkthrough is.
- **Their branch is still `b726aa53`**, unchanged since the review, so section A's line references hold. Re-check before posting — it was force-pushed once already.

## F · mecatl-side prerequisites (from the review body, sections B1–B8)

All posted on #321 and addressed by the author's revision. Kept for the record
since they are the implementation checklist.

| # | Item | Status |
|---|---|---|
| F1 | `CreateSessionRequest`/`CreateTeamRequest` have no principal field | SENT-FIXED |
| F2 | `<def>` resolves to the literal `main` for every session; tier 1 has no subject | SENT-FIXED |
| F3 | Labels do not reach children; `setSessionLabels` is off every child-spawn path; empty must be rejected not compared | SENT-FIXED |
| F4 | `ScheduleSpec` has no owner field | SENT-FIXED |
| F5 | Redis has no auth, TLS or keyspace scoping; it is the root of trust on resume | SENT-FIXED |
| F6 | `validateScheduleSpec` has no workspace containment; scope needs a resource axis | SENT-FIXED |
| F7 | Child minting must happen in composition, not a port the loop calls; `port.EventLog` is the wrong analogy, `Deps.ChildAskReviewer` is the right one | SENT-FIXED |
| F8 | `SessionLease.Owner` cannot carry issuer identity (exclusion needs distinctness, attribution needs sharing); definition drift across resume undetected; `jti`-to-liveness is not revocation | SENT-FIXED |

## G · Doc corrections sent and resolved

The 14 inline comments on #321, all addressed by the author.

| # | Finding | Status |
|---|---|---|
| G1 | "Nobody has solved multi-tier delegation with attenuation" — four drafts do mandate it; what is unspecified is *how* to compute the subset and *who* must refuse | SENT-FIXED |
| G2 | JWT-SVID §3 quote used the warning as if it were the permission | SENT-FIXED |
| G3 | `dlg` → `delegation_chain`, the name two drafts already use | SENT-FIXED |
| G4 | `scope` cannot hold a structured value; RFC 9396 `authorization_details` is the registered name | SENT-FIXED |
| G5 | RFC 8693 §4.1 says the nested `act` chain **is** the history trail; "only exists across the sequence of exchanges" is backwards | SENT-FIXED |
| G6 | The deployed-STS aside: none of AWS/Azure/GCP emits nested `act`, so they cannot evidence the point | SENT-FIXED |
| G7 | The `sub` collision premise overstated 8693; reground on §4.1 | SENT-FIXED |
| G8 | `may_act` is act-*for*, not delegate-for, and covers impersonation | SENT-FIXED |
| G9 | `txn` is registered (RFC 8417 §2.2), not pre-standard; PoP is `cnf`+`jkt` | SENT-FIXED |
| G10 | "Rotate at half-life" does not apply to JWT-SVIDs | SENT-FIXED |
| G11 | The Zhu dismissal applies to this design too — it converges rather than departs | SENT-FIXED |
| G12 | Workspace exclusion is the argument for inclusion; `validateScheduleSpec` hole | SENT-FIXED |
| G13 | The Redis backstop does not hold; the honest sentence is already in the doc | SENT-FIXED |
| G14 | Federation is not free; needs `https_web` or `https_spiffe`, and the latter means minting X.509-SVIDs too | SENT-FIXED |

## H · Open residuals nobody has resolved

| # | Item |
|---|---|
| H1 | **Joe Beda's authorizable-root-principal point**, with the rate-limit fan-out and user-store cases. The doc still holds prior actors audit-only. Sits on the same axis as the one-party-actor-slot finding. Probably the most interesting unresolved question on the PR, and two of Joe's three threads are still open. |
| H2 | `max_depth` = 5 is citable from Sweeney §9.5 rather than picked — not taken |
| H3 | The WIMSE "service is an orthogonal axis, not a run" correction — not taken |


## I · Design outputs (this session's main work)

| Artifact | State |
|---|---|
| `docs/agent-identity-outbound.md` | The design. 600+ lines: overview + mermaid flow, properties, eight hops with cost blocks and threats, the steps as interfaces, per-side change tables, open questions. **Uncommitted.** |
| `.scratch/binding-first-principles.md` | Part 1, the properties. Feeds the design's properties section. |
| `.scratch/walkthrough.md` | Superseded by the design doc — the hops were folded in. Keep until the design is committed, then drop. |
| `.scratch/draft-reply-jbeda.md` | Distillation for jbeda. **Not posted.** Check with JAORMX first — he said the scenario was his gap to fill. |
| commit on `agent-identity-fold` | Minimal: marks the outbound hop open in their doc and says the design is worked separately. 15 insertions. **Unpushed.** |

## J · Reversals recorded, so they are not re-litigated

| Claim | Now |
|---|---|
| Two credentials, shared plus per-call signed | **Reversed.** One shared credential plus an unsigned correlation value. A subagent never holds a credential, so per-instance revocation solves a problem this architecture does not have. The draft requiring it assumes agents are independent processes holding their own tokens. |
| Per-definition keying trades away attribution | **Reversed.** Not a tradeoff. One credential reused across siblings, with a logged correlation value naming the individual. |
| SPIFFE earns its place only via a SPIFFE-named policy subject | **Reversed twice, landing here:** client auth and the policy subject are one decision, not two. Not required, but the recommended default — no secret the model can read, per-pod attestation, a namespaced policy subject, and a registered mechanism. May also be the cheapest fix for the provisioning blocker, since the branch auto-registers a confidential client. |
| The chain rides the token the whole way | **Wrong**, theirs and mine. It reaches the gateway and stops. |
| Enforcement could live at the outgoing strategy | **Wrong.** Fails the fail-closed property (seven strategies, one omission is invisible) and that layer lacks the tool name anyway. Admission stays the gate. |
| RFC 9068 makes the consent check reachable without `may_act` | **Overstated.** True of conformant tokens; real external tokens often lack `client_id`. #5989 records this. |

## Files

| Path | What |
|---|---|
| `.scratch/comment-ledger.md` | This file |
| `.scratch/toolhive-findings.md` | The vMCP/ToolHive-facing half, 10 findings |
| `.scratch/pr321-comments.md` | The review as posted on #321 |
| `.scratch/pr321-all-findings.md` | The original 124-finding index |
| `.scratch/combined-fold-and-corrections.md` | Doc with section A corrections applied — source text for posting them |
| `.scratch/combined.patch` | Same, as a diff |
| `.scratch/model-OLD-6a62807d.md` | The version reviewed |
| `.scratch/model-NEW-b726aa53.md` | The author's revision |
