import json, subprocess

REPO = "stacklok/mecatl"

# keyed by the anchor line the comment was posted on
NEW = {
106: """**The attenuation claim doesn't survive contact with the drafts.** Fixing it makes it stronger, not weaker. Suggested replacement:

> No ratified standard mandates attenuation. RFC 8693 only *suggests* scope as an abuse mitigation (§5). `draft-ietf-oauth-identity-chaining-17` expects non-escalation in non-normative prose and explicitly leaves claim representation undefined. ID-JAG makes narrowing a policy MAY (§4.3.3). Several individual drafts do mandate it. What is unspecified everywhere is *how* to compute a subset over a structured authority model, and *who* is obliged to refuse.

Four to cite:

- **`draft-mcguinness-oauth-actor-profile-00`** (30 Apr 2026) is the closest overlap, and it's not the "punts on policy" doc its abstract suggests. It mandates non-escalation on every path (§6.2.1.2, §6.2.2, §4.2). It specifies a chain construction and validation algorithm, with append-only as a MUST (§3.6). It enforces a depth limit. And it has `sub_profile: "ai_agent"` with a "user → orchestrator → agent → tool" reference architecture.
- **`draft-mcguinness-oauth-ai-agent-instance-00`** (4 Jul 2026), same author, makes your definition/instance split in almost your words: "A platform registers a single `client_id` and then runs many concurrent agent instances under it." It has a REQUIRED `agent_instance_id`, plus `agent_platform`, `agent_model` and `agent_runtime` for provenance. You cite Hartman as the closest analog for per-session SVIDs; this is the closest analog for the tier model itself.
- **`draft-liu-agent-operation-authorization-02`** (16 Mar 2026) and its follow-on **`draft-liu-oauth-chain-delegation-00`** (6 Jun 2026) both name a `delegation_chain` claim and enforce strict-narrower server-side. The second caps depth at 5.
- **Macaroons** (Birgisson et al., 2014) and **Biscuit** are where holder-side attenuation actually comes from, and the omission I'd fix first. Biscuit gives a cryptographic guarantee rather than a runtime policy: the holder appends a narrowing block offline, and the verifier rejects any block that widens. Worth revisiting because `docs/scoped-resource-grants.md` already evaluates Biscuit and parks it, on the grounds that offline attenuation has no v1 consumer — but this design does want per-hop narrowing.

All four are individual submissions with Standards Track intent; none are WG-adopted. Only `draft-ietf-oauth-identity-chaining` and ID-JAG are.

**What's left of your claim survives, and gets sharper.** Every attenuation MUST in actor-profile cites "[RFC8693], Section 4" for the method. Section 4 is the claims registry, where §4.2 defines `scope` as a space-separated string. There's no reduction algorithm anywhere in it. So even the draft with the hardest MUSTs mandates the requirement and then points at a section with no method. Containment over *this* authority model — tool names, a posture ladder, delegation rights — is genuinely unspecified.

**Three places actor-profile makes your case stronger:**

1. Its chain entries carry only identity (`sub`, `iss`, `sub_profile`). So a per-hop scope snapshot doesn't fit `act` even under the draft that fully specifies `act`. Your secondary reason for a private claim is better than you argued it.
2. §6.3 requires an `actor_token` to identify the acting party in its top-level `sub`. A JWT-SVID is exactly that shape.
3. §3.2 states that `sub` is the authorizing principal, as an explicit invariant. RFC 8693 never states this. That's the citation your `sub` argument needs.

One nuance that keeps `depth` yours: actor-profile's depth is a locally configured maximum, never a token claim. So `max_depth` in the credential stays distinct, and RFC 3820 remains the in-credential precedent.

Two more, uncited. Transaction Tokens §9.2 hits the same `sub` collision and resolves it the way you do, with `sub` as the transaction principal and `req_wl` as the requesting workload. And -09 §13.14 has an append-only chain MUST whose "mechanism for maintaining this Call Chain is out of scope" — which names your contribution as unclaimed. RFC 3820 §3.8.2's rights-intersection rule is also prior art for the attenuation itself, not just for `depth`.

One objection worth answering in the doc. A JWT is immutable once signed, so a holder can't attenuate its own token; narrowing needs the issuer to mint a new one. That's a general objection to JWT chains, including this one. Your answer is that minting is a local signing call. Good answer, currently implicit.

Also: `max_depth` = 5 is citable from Sweeney §9.5 rather than picked. Sweeney is the only one of these with a fully worked revocation design, which is worth a sentence in the costs section — naming TTL-only as considered and rejected, rather than unconsidered. And the WIMSE workload/instance/service parallel is half right: workload → instance nests and maps cleanly, but "service" is an orthogonal axis (a capability spanning several workloads), so it doesn't correspond to "run".""",

193: """**This quotes the wrong sentence.** JWT-SVID §3 says:

> Registered claims not described in this document, in addition to private claims, MAY be used as implementers see fit.

*and then* warns about interoperability. As written, the doc asserts "explicitly permits this" and quotes only the warning, which reads as though the warning were the permission.

Quote the MAY sentence, and keep the warning as the cost you're accepting. The permission is stronger than what's cited here.""",

201: """**`dlg` is genuinely unregistered, so "pre-standard" is accurate — but two drafts already named this claim.** `draft-liu-agent-operation-authorization-02` and `draft-liu-oauth-chain-delegation-00`, from the same author group, both call it **`delegation_chain`**.

Worth doing one of three things: use that name, cite it as what `dlg` mirrors, or say why a shorter private name is preferred. Any of them is fine. Saying nothing reads as though the space were empty.

One snag for an implementer: this doc describes the `dlg` shape two ways. A flat `{id, def, scope}` array in this table row, and a nested `{sub, act: {sub, …}}` in the prose below — with the ordering reversed between them.""",

202: """**`scope` is the wrong claim name for a structured value.** RFC 8693 §4.2 registers `scope` as "a JSON string containing a space-separated list of scopes" in RFC 6749 §3.3 format. That charset excludes spaces inside values and excludes structured JSON. So the structured authority this doc wants can't ride that name cleanly.

**RFC 9396 `authorization_details` is the registered name for exactly this.** Published, not a draft, and in production use in FAPI:

```json
{"type": "mecatl_tool",
 "operations": ["Read", "Grep", "Bash"],
 "resources": ["/workspace/repo"],
 "constraints": {"posture": "auto", "max_depth": 3}}
```

Two things this buys beyond being correct. `resources` is the axis the workspace gap needs — see my comment on the "Workspace paths are *not* claims" line. And `constraints` absorbs the posture ceiling and `max_depth`, instead of them being separate top-level claims.""",

215: """**This is backwards, and §4.1 says the opposite.** RFC 8693 §4.1:

> the nested `act` claims serve as a history trail that connects the initial request and subject through the various delegation steps

So the full trail *is* in the token. It isn't spread across the sequence of exchanges.

The point you're making is still available, and the defensible version is a better argument anyway: `dlg` is **issuer-enforced** rather than left to the AS's discretion, and it carries a **per-hop scope snapshot** that `act` doesn't. Both are real differences. "Emergent versus first-class" holds. "The trail doesn't exist in the token" doesn't.""",

225: """**Suggest deleting this aside.** Of AWS, Azure and GCP service-account impersonation, only Google's STS is an actual RFC 8693 endpoint — and **none of the three emits nested `act` chains**. So they can't be evidence for how deployed systems evaluate such chains.

The §4.1 MUST carries the point on its own, without an appeal to deployment practice. That's the stronger position anyway.""",

239: """**The collision is real, but the premise overstates 8693, and as written the argument is attackable.** There is no normative language in 8693 assigning `sub`. §2.1 says only that the issued token's subject will "typically" be the subject token's, and Appendix A.2.5 is illustrative. So "8693 delegation requires `sub` to be the delegator" isn't quotable, and a reviewer who checks will find that out.

Regrounding it on §4.1 makes it unattackable. §4.1 defines `act` as the party *to whom* authority has been delegated, and keys access control to it. So with `sub` bound to the acting instance, the user can only go in one of two places. Either in `act` — which makes a conformant consumer authorize **the user as the actor**, which is wrong. Or in some non-`act` claim — in which case it isn't `act`-expressed delegation at all. Same conclusion as yours, reached from text that exists.

And if you want a citation for the invariant itself, `draft-mcguinness-oauth-actor-profile-00` §3.2 states explicitly that `sub` is the authorizing principal. RFC 8693 never does.""",

267: """**Two corrections to the `may_act` description.** §4.4 is about who may **act for** a subject, not "delegate for" it — and it covers impersonation as well as delegation. So "pre-authorizes which actors may delegate" is narrower than what the claim actually does.

Also worth knowing before leaning on it: `may_act` is close to dead in deployment. Keycloak gates it behind an experimental flag and doesn't support `actor_token` at all. Which is a second reason discharging it onto definition-tier policy, as this doc does, is the right call — not only the architectural one.""",

288: """**`txn` isn't pre-standard. It's already registered.** IANA points `txn` at **RFC 8417 §2.2**, and Txn-Token -09 §9.2 confirms it: "as defined in Section 2.2 of [RFC8417]".

So References should cite 8417, and the "pre-standard" label in the claim-name drift bullet further down should drop `txn` and keep `dlg`.

Two more while you're in this area. For the phase-3 proof-of-possession binding, the standard name is **`cnf` with a `jkt` thumbprint** (RFC 9449), rather than a new claim. And the Txn-Token citation of `§14.11.1` was renumbered to **§13.14** in -09.""",

295: """**"Rotate at half-life" doesn't apply to JWT-SVIDs.** From SPIRE's own `spire_agent.md`, `availability_target` "only affects the agent SVIDs and workload X509-SVIDs, **but not JWT-SVIDs**." JWT-SVIDs are minted fresh per request, so there's no rotation schedule to inherit.

That's convenient for this design rather than awkward. Mint-per-request is exactly the "credential ephemeral" half of the contract below. Worth stating it that way, instead of borrowing a rotation default that doesn't apply.""",

300: """**This dismissal doesn't hold, because it applies to this design too.** Both IETF schools are dismissed here on the grounds that they "assume the token holder persists." But nothing in this design holds a token either — the harness re-mints from Redis on resume.

Strip the label and Zhu's mechanism is: short TTL, plus re-derive from durable state. Which is what "chain durable, credential ephemeral" says two paragraphs down.

The honest framing is that this design **converges with** Zhu rather than departing from it. What's genuinely new is the parked-and-resumed-on-another-pod lifecycle, not the re-derivation.""",

338: """**This exclusion is the argument for inclusion, and there's a live hole behind it.** "The workspace is a property of the session's construction, not of its identity" is true for an operator-created session. It's false for a **model-created** one.

`validateScheduleSpec` checks the workspace for non-emptiness only. No allowlist, no containment against the creating session's root, no canonicalisation. There is no workspace allowlist anywhere in `internal/adapter/server` or `internal/app`.

And a read-leaning scheduled fire runs in plan mode, which permits Read, Grep and Glob confined to the workspace root — where that root is the model-supplied value.

So `Schedule create {workspace: "/var/run/secrets", mutating: false, cron: …}` is a shell-free, approval-free, unattended read of the credential directory. It works on the distroless image.

Which means a child whose `scope` is a strict subset on the tool-name and posture axes can read a **strictly larger** part of the filesystem than its parent. Construction is exactly what a scoped principal must not be able to widen.

A `resources` array with prefix containment after canonicalisation gets most of the value — see my comment on the `scope` table row.

I'm filing the `validateScheduleSpec` gap separately as a code issue, since it's live today and independent of this design.""",

383: """**This backstop doesn't hold, and the doc already contains the honest version.**

An attacker who can request signatures can also **write** the session. `redisstore` dials `redis.NewClient(&redis.Options{Addr: addr})` — no password, no TLS, no keyspace scoping. `--redis-url` is a bare `host:port`. `Save` writes `mecatl:session:<id>` with a caller-supplied id, and `sessnap` is plain JSON with no MAC.

So "the identity references a session that must exist in Redis" isn't a constraint on the attacker. It's a step they perform.

Two sections down, the doc says the accurate thing — "the pod that can sign is the pod that can impersonate any session." That sentence should replace this one.

Redis auth and TLS are also a prerequisite for **any** phase of this design meaning anything, since `Principal` lands in the same store. And worth stating somewhere explicitly: on resume, all authority comes out of Redis, which makes Redis the root of trust for the whole model.""",

386: """**"Free because we stay spec-shaped" isn't true, and it's the only justification offered for the PKI machinery.**

A SPIFFE bundle endpoint needs either the `https_web` profile, which means a public-CA certificate, or `https_spiffe`, where the endpoint presents its own **X.509**-SVID. This doc is scoped around JWT-SVIDs only, so `https_spiffe` would mean the issuer has to mint X.509-SVIDs as well. That's a real addition, not a free consequence. The doc picks no profile.

Federation is also **bilateral registration**, not discovery: each domain configures the other's bundle endpoint. So there's no "it just works cross-cluster" property to inherit.

And the costs section asks "whether the JWKS endpoint needs its own SLO" two sections later, which is the same doubt surfacing in a different place. Worth resolving once, here.""",
}

out = subprocess.run(
    ["gh", "api", "--paginate", f"repos/{REPO}/pulls/321/comments",
     "--jq", ".[] | {id, line, body_head: .body[0:40]}"],
    capture_output=True, text=True, check=True)
existing = [json.loads(l) for l in out.stdout.strip().splitlines()]

done, missing = [], []
for c in existing:
    new = NEW.get(c["line"])
    if new is None:
        missing.append(c)
        continue
    payload = {"body": new}
    p = "/tmp/one-comment.json"
    with open(p, "w") as fh:
        json.dump(payload, fh)
    subprocess.run(
        ["gh", "api", f"repos/{REPO}/pulls/comments/{c['id']}",
         "--method", "PATCH", "--input", p, "--jq", ".id"],
        capture_output=True, text=True, check=True)
    done.append(c["line"])

print("patched lines:", sorted(done))
print("unmatched (left alone):", [(m["line"], m["body_head"]) for m in missing])
