# PR #321 — every finding, one line each

Index of all findings from nine agents plus the research behind our own draft.
Sorted by severity. `notes?` says whether it made the 317-line
`pr321-review-notes.md`. Ask me to expand any row by number.

## Blocking — wrong, or changes what to do first

| # | finding | notes? |
|---|---|---|
| 1 | Redis client has no password, no TLS, no keyspace scoping; `Save` takes a caller-supplied id | y |
| 2 | So the store-existence backstop is the attacker's own write read back | y |
| 3 | On resume all authority comes out of Redis, making it the root of trust for the whole model — unstated | y |
| 4 | The party the signature defends against (can write, cannot sign) does not exist | y |
| 5 | Persisted chain is the re-mint authority but has no integrity layer; `rehydrateSession` trusts `sess.Mode` too | y |
| 6 | Tier 1 is always the string `main` — no top-level session is def-bound | y |
| 7 | So definition-tier policy has no subject, and `AgentDef` carries no authority fields | y |
| 8 | So `may_act` is a promise, not a mechanism | y |
| 9 | Scheduled fires never cross the edge interceptor, so they have no principal by construction | y |
| 10 | Fires defeat the Redis backstop a second way — the session exists, the principal is empty | y |
| 11 | `ScheduleSpec` persists a whole session construction with no creating-principal field | y |
| 12 | `Principal` as an inert label fails open — empty means both "single-user" and "propagation bug" | y |
| 13 | Nothing propagates it to children: `buildChildSession`, `runBranch`, `Supervisor.sessionID` | y |
| 14 | `setSessionLabels` is the sole writer and lives in the server adapter, off every child-spawn path | y |
| 15 | Phase 1 ships a fail-open window a whole phase wide | y |
| 16 | Phase 1 ships the Copilot shape the doc explicitly refuses | y |
| 17 | Signed-but-unenforced `scope` is worse than absent — the named consumer is a verifier design | y |
| 18 | Empty child principals make the trail misleading rather than incomplete | y |
| 19 | Workspace excluded from scope, but `Schedule create` takes a model-supplied one and fires unattended | y |
| 20 | Shell-free credential read: read-leaning fire in plan mode, confined to the model's root, works on distroless | y |
| 21 | `scope` collides with a registered claim (RFC 8693 §4.2, space-separated string) | y |
| 22 | Attenuation-novelty claim has seven counterexamples, closest is `draft-liu-oauth-chain-delegation-00` | y |
| 23 | Adopt RFC 9396 `authorization_details` — fixes the collision and supplies the missing `resources` axis | y |
| 24 | Edge-only principal derivation is architecturally wrong, not a phase gap | y |
| 25 | **Four shipped systems say the stored record should be a cache, not an authority** | **n** |
| 26 | **KMS residual is a category off: prompt injection reaches the signing capability, not just pod compromise** | **n** |
| 27 | Service-account token sits at a fixed path and `cat` auto-approves for isolated children | n |
| 28 | `envscrub` only scrubs the child shell; the harness process's `/proc/<pid>/environ` is readable | y (as issue) |
| 29 | `ListSessions` returns every session with 120 runes of its first user prompt | y |
| 30 | `GET /v1/sessions/{id}/events` deliberately relays every prompt and whole pre-compaction conversations | y |

## Fix — real problems, smaller consequence

| # | finding | notes? |
|---|---|---|
| 31 | "Federation is free because we stay spec-shaped" is false, and is the sole justification for the PKI | y |
| 32 | `https_spiffe` federation needs the issuer to mint X.509-SVIDs too; the doc picks no profile | y |
| 33 | Federation is bilateral registration, not discovery | y |
| 34 | "Free" contradicts the costs section's own "does the JWKS endpoint need an SLO" question | y |
| 35 | "Rotate at half-life" does not apply to JWT-SVIDs — those are minted per request | y |
| 36 | Private-claims quote cites the interop warning, not the `MAY` permission | y |
| 37 | `sub`-collision premise is wrong (8693 has no `sub` rule); conclusion holds definitionally via §4.1 | y |
| 38 | Factual error: §4.1 says the `act` trail *is* in one token, contra the doc | y |
| 39 | `txn` is registered by RFC 8417 §2.2, not the Txn-Token draft | y |
| 40 | Delete the "every deployed 8693 STS" aside — none of the three emits nested `act` | y |
| 41 | `dlg` shape described two ways: flat `{id,def,scope}` vs nested `{sub,act}`, opposite ordering | y |
| 42 | WIMSE convergence half right — "service" is an orthogonal axis, not a third rung | y |
| 43 | Zhu dismissal doesn't apply: nothing here holds a token either | y |
| 44 | Split the unattended-trigger gap from the parking gap — two contributions, one claimed | y |
| 45 | Name revocation as considered-and-rejected; Sweeney specifies cascade revocation in detail | y |
| 46 | `port.EventLog` analogy cannot hold — no downstream seam for spawn | y |
| 47 | Fix: mint in composition-supplied factory closures on both seams | y |
| 48 | `Deps.ChildAskReviewer` is the honest analogy if the loop must be identity-aware | y |
| 49 | `SessionLease.Owner` has opposed requirements — exclusion needs distinctness, attribution needs sharing | y |
| 50 | `callID` becomes a SPIFFE path segment; uniqueness rides provider entropy | y |
| 51 | Session-as-identity rejection contradicts the INSTANCE bullet twelve lines above | y |
| 52 | Q3-converged and Q4-innovation-ground cannot both be true | y |
| 53 | Two of the four nested envelopes are empty | y |
| 54 | Alternative for tier 1: the role, via `roleFamily`'s closed six-value set | y |
| 55 | Three paths mint a new id for a continuing session: `ForkSession`, carryover, scheduled fire | y (partly) |
| 56 | A fire *is* a continuation when `CarryContext` is set, with the link in the schedule store | n |
| 57 | Proto: a principal on the snapshot needs zero proto change (opaque payload, additive JSON) | y |
| 58 | Proto: the Audit section's "principal annotation" *is* a proto change — contradiction | y |
| 59 | Proto: nothing can *set* a principal today; `CreateSessionRequest` has no field | y |
| 60 | Proto: `ListSessions` filtering undecided — unfiltered it's a discovery oracle | y |
| 61 | Day-one cost is two exported surfaces: the fold guard plus `eventsource.SessionMeta` | y |
| 62 | No test catches a missed propagation; `storeconformance` fixtures are the cheap place | y |
| 63 | Phasing takes the irreversible commitments (KMS, JWKS SLO, trust-domain name) in phase 1 | y |
| 64 | `jti`↔session-liveness is not a revocation substitute, and its fail mode is unspecified | n |
| 65 | `networkpolicy.yaml` allows egress to anything on 443 with no `to:` selector | n |
| 66 | Distroless + `/bin/sh` default make shell paths inert *today* — by image choice, not policy | n |
| 67 | "Innovation ground" label: four of five firings fail | n |
| 68 | The label lands on the boring half of parking; the hard half is where authority comes from | n |
| 69 | **The id-is-not-a-credential thesis is stated nowhere** | **n** |
| 70 | **Live-caller-versus-no-caller as the organising principle for which resumes need a stored authority** | **n** |
| 71 | Twelve wire-side by-id load sites plus five engine-side | n |
| 72 | `may_act` precision: "act for" not "delegate for"; covers impersonation; not consent; second example isn't `may_act`-shaped | n |
| 73 | §1.1 misattributed for the `sub` assignment; the impersonation sentence is garbled | n |
| 74 | The §3.4.11 arrow chain is a paraphrase, not a quote | n |
| 75 | `user/<uid>` should state "never minted as a credential", as the definition tier does | n |

## Gifts — things that strengthen their case, uncited

| # | finding | notes? |
|---|---|---|
| 76 | Transaction Tokens §9.2 hits the same `sub` collision and resolves it identically | y |
| 77 | Txn-Token -09 §13.14: append-only chain MUST, "mechanism … out of scope" — names their contribution as unclaimed | y |
| 78 | RFC 3820 §3.8.2 rights-intersection is prior art for the attenuation, not just `depth` | y |
| 79 | Their real contribution is the *algorithm*, not the invariant — nobody specifies how to compute subset | y |
| 80 | Steal `cnf` with a `jkt` thumbprint (RFC 9449) for the phase-3 PoP binding | y |
| 81 | `max_depth` default of 5 is citable from Sweeney §9.5 | y |
| 82 | Route Sweeney's vault + exercise proxy to `scoped-resource-grants.md` | y |
| 83 | 8693 §5's "is suggested" is the exact spot the RFC declines the invariant — worth quoting | n |
| 84 | **Entra hard-blocks certain permissions from ever being granted — a ceiling no issuer can pass** | **n** |

## Credits — verified correct, worth saying so

| # | finding | notes? |
|---|---|---|
| 85 | The `sub` collision is a real find most people would hit months into implementation | y |
| 86 | `act`-is-audit-never-authority complies with a normative MUST most designs get wrong | y |
| 87 | "Subagents are not network entities" deletes the per-subagent key problem | y |
| 88 | Projection-not-authority means phase 1 cannot weaken today's enforcement | y |
| 89 | The doc discloses its own missing edge seam rather than hiding it | y |
| 90 | The three-tier decomposition is the right one, better than our draft's flat framing | y |
| 91 | CB4A citation is real and fairly characterised; our own research missed it | n |
| 92 | `arch-08` §3.4.11 confirmed, with genuinely zero protocol or claims | n |
| 93 | `practices-05` §5.5 confirmed verbatim, including the out-of-scope disclaimer | n |
| 94 | WIT TTL guidance ("hours, PoP minutes, never bearer") is a precise compression | n |
| 95 | RFC 3820 `pCPathLenConstraint` cited exactly right, with an appropriate hedge | n |
| 96 | §7.2 single-audience cited correctly | n |
| 97 | Workload Endpoint §5 cited correctly; the analogy is honestly hedged as their own framing | n |
| 98 | `dlg`, `depth`, `max_depth` are genuinely unregistered — "pre-standard" is accurate for those | n |
| 99 | The parking gap is real, confirmed against two independent drafts | n |
| 100 | Nothing requires `may_act` to be a token claim — substituting policy is conformant | n |
| 101 | A JWT-SVID is a valid `actor_token` of type `urn:ietf:params:oauth:token-type:jwt` | n |
| 102 | The informational-only quote is accurate and the ellipsis honest — suggest restoring the preamble | n |
| 103 | No-structural-enforcement is right, and stronger than the doc states | n |
| 104 | `port.Issuer` in `engine/port` breaks no layering rule; the *discipline* claim is what fails | n |
| 105 | A new field survives `resetToIdle` and all recovery seams; no code change needed for that | n |
| 106 | Concurrency is safe provided no mutator is added | n |
| 107 | No path found to read another session's minted SVID from memory — do not raise it | n |
| 108 | `networkpolicy.yaml` blocks port 80, so cloud metadata is unreachable | n |
| 109 | The three beyond-frontier audit problems are honestly named | n |
| 110 | Their `depth`/`max_depth` as signed claims is stronger than Sweeney's bare SHOULD | n |

## Nits, and corrections to my own framing

| # | finding | notes? |
|---|---|---|
| 111 | Self-issuance is the base case, not a recognised topology — say you're absorbing SPIRE's whole job | n |
| 112 | The `Owner` bullet uses pod identity and issuer identity interchangeably | n |
| 113 | `MemberSessionID` differs between the gRPC path and the Team-tool path | n |
| 114 | `api:check` covers only seven core packages; the fold guard is what actually fails CI | n |
| 115 | A `principal` on a store RPC needs the same authoritative-key rule as `session_id` | n |
| 116 | Memory store is a flat KV reachable from `noFSChildCatalog` — but absent in mecak8s | n |
| 117 | `MemberSessionID` collision is a write-clobber, distinct from the read hole | n |
| 118 | Not-found message reuse collides with the house rule on model-facing text | y |
| 119 | Don't couple structurally to Sweeney — `-00`, same week, crowded niche | y |
| 120 | Entra comparison: no lifecycle, revocation, risk-detection or fleet story | n |
| 121 | AuthZEN's model assumes the PDP trusts the PEP, with no integrity for supplied attributes | n |
| 122 | **My framing was wrong: `resume:` is prefix-gated and cannot target an arbitrary id** | n |
| 123 | **My framing was wrong: the `Schedule create` fire id is mostly random, so it barely helps forge** | n |
| 124 | Our own `docs/agent-identity.md` is a competing strawman in the tree — delete it | n |

---

## The seven I'd promote into the review

25, 26, 69, 70, 84 — and 64 and 66 if there's room. Everything else in the `n`
column is either a credit worth mentioning in passing, a nit, or already covered
by a neighbouring comment.
