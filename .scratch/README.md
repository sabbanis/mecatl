# Agent identity work — file index

## The rule this workstream runs on

**mecatl, vMCP and ToolHive are built by the same team. All of it is fungible.**

Read the code to learn **what a component is for and how the pieces relate**. That
knowledge is not obtainable any other way, and getting it wrong invalidates
everything downstream — vMCP is a *gateway*, not an endpoint, and missing that sent
an early round of this work in the wrong direction.

Do **not** read the code to learn what is possible. Everything in these repos can be
changed by the people doing this work, and two branches already prove it:
`spiffe-authserver` and `token-delegation` exist because someone decided a change was
required and made it.

So in every design artifact here:

- What a hop *should* do is derived from the properties, never from what runs today.
- The today / delta / cost annotation is a **cost signal**, not a boundary. It says how
  much work a step is, never whether it is allowed.
- A missing interface is a thing to build, not a constraint to design around.
- An existing field or interface is not an argument for using it.

This is written down because it was violated three times in one session: estimating a
branch's cost from its diff size, letting a seam survey pick the architecture, and
citing a field's existence as evidence for a design choice. When dispatching an agent,
put this rule in the brief — the seam survey was briefed without it and ranked options
by what was cheap to wire, because that was the only axis it had.

## The other rules, all learned the hard way here

**Check what is already tracked before calling something a finding.** Several items
reported as discoveries were open issues with a design behind them. Read the epic and
its sub-issues first. A finding that turns out to be someone's in-flight work costs
credibility and wastes their time.

**Verify the target has not moved before posting.** Their branch was force-pushed once
mid-review, which invalidated line references. Check the head before sending anything
anchored to a line.

**Read the whole conversation before adding to it.** Comments were nearly posted that
duplicated points another reviewer had already made better, and that missed the author
having already responded to half the review.

**Name the deliverable and its audience before writing a word.** A design for the team
and a short evocative example for one reviewer are different artifacts. Writing one and
judging it by the other's test wasted a full pass.

**When told the writing is unreadable, fix the language, not the substance.** The first
instinct was to cut content, which solved the complaint by deleting the work. Density
and length are separate problems from what the thing says.

**No aphorisms, no tease sub-headers, no editorial clauses.** "For a reason that is not
tidiness", "and it is narrower than it looks", "a narrowing nobody downstream can check
is a convention, not a control" — all of these tell the reader how to feel instead of
saying the thing. If a sentence needs a second read, rewrite it.

**Use the domain specialists as the knowledge base, not as a final sanity check.**
The WIMSE and OAuth agents each caught a substantive error the moment they were asked —
the WIT/WPT identity-versus-authority split, and the direction of `client_id` in mTLS
client auth. Standards questions should go to them *while* the argument is being built,
not after it is written. Named bodies of work worth going to them for: McGuinness's
actor-profile and ai-agent-instance drafts, how WIMSE builds on SPIFFE, and
SPIFFE-SVID-as-an-OAuth-credential.

**Every agent brief needs: the governing rule above, a word cap, and an instruction to
report via SendMessage.** Two agents died from oversized replies after being told
completeness beats brevity, and four of five went idle without reporting at all.


Everything for the mecatl / vMCP agent-identity work lives **here**, in the repo's
gitignored `.scratch/`. Nothing important should sit in a session temp directory —
those die with the session. If a new file appears, add a row.

Branch: `agent-identity-fold`, stacked on `origin/docs/agent-identity-model`
(PR #321, head `b726aa53`). One commit so far: `007c60a3`, the outbound-hop fold.

**LIVING** = expected to change. **FROZEN** = a snapshot, do not edit.
**DRAFT** = written, awaiting review, not sent.

---

## The work

| File | Status | What it is |
|---|---|---|
| `binding-first-principles.md` | **LIVING** | Part 1 of the design. What an ideal credential binding looks like, derived from mecatl's shape. Nine settled properties at the end — those are the test everything else gets judged against. WIMSE corrections marked inline. |
| `walkthrough.md` | **DRAFT, incomplete** | The end-to-end example. Hops 3–6 written (obtain credential / call tool / gateway decides / credential selected). Hops 1, 2, 7, 8 and the threats pass still to do. Becomes the second commit on the branch. |
| `comment-ledger.md` | **LIVING** | Every comment and finding, 71 items, nine sections, each tagged LIVE / SENT-FIXED / DISSOLVED / INBOUND / FOLDED. Section A is what would be posted to #321. Section A′ is the author's open question and our answer. Read the context section before posting anything. |
| `toolhive-findings.md` | **LIVING** | The vMCP/ToolHive-facing half. Ten findings. Needs the fail-open authz default adding — it is in the ledger as E10 but not here yet. |

## Drafts not yet sent

| File | Status | What it is |
|---|---|---|
| `draft-pr324-body.md` | **DRAFT, stale** | PR body written when #324 was a standalone doc. The plan changed to folding into their doc, so this needs rewriting or discarding depending on what happens to #324. |

## Reference snapshots — do not edit

| File | Status | What it is |
|---|---|---|
| `ref-their-doc-b726aa53.md` | **FROZEN** | Their doc as reviewed and as it stands now, 1135 lines. The ledger's line references point at this. |
| `ref-their-doc-6a62807d-reviewed.md` | **FROZEN** | The earlier version, 506 lines, before they responded to the first review round. Kept for diffing what they absorbed. |
| `ref-corrections-applied.md` | **FROZEN** | Their doc with all eight prose corrections applied. This is the **source text** for posting ledger section A — copy from here rather than rewriting. |
| `ref-corrections.patch` | **FROZEN** | The same as a diff. |
| `pr321-comments.md` | **FROZEN** | The review as actually posted on #321, after the plain-language rewrite. |
| `pr321-all-findings.md` | **FROZEN** | The original index of 124 findings from the first pass. Superseded by the ledger, kept because the ledger only carries what survived. |

## Tools and artifacts

| File | Status | What it is |
|---|---|---|
| `tool-patch-inline-comments.py` | Reusable | Patches existing inline comments on a PR by anchor line. Used once to rewrite all 14. Edit the `NEW` dict and run. |
| `artifact-flows.html` | Published | Source for the flow-comparison artifact at `claude.ai/code/artifact/d00a0375-ce30-4a94-a842-3e952bfd727a`. Republishing the same path keeps that URL. |
| `review-payload.json` | Generated | Output of a previous review post. Regenerate rather than reuse. |

---

## Staleness — what to re-check before relying on something

- **Their branch was force-pushed once** mid-review. Line references in the ledger
  and `ref-corrections-applied.md` hold only while their head is `b726aa53`.
  Verify with `git log --oneline origin/docs/agent-identity-model -1` before posting.
- **`toolhive-findings.md` predates** the fail-open authz finding and the seam
  survey results. The ledger has both; this file does not.
- **`draft-pr324-body.md` predates** the decision to fold rather than keep a
  separate doc.
- **`pr321-all-findings.md` is from the first pass** and includes items later
  dissolved by ToolHive's own tracked work. Trust the ledger over it.

## Session task list

Numbered tasks track the sendable items and the remaining work. They are not files.
Current open ones: the four ToolHive reports plus the fail-open one, the SPIFFE
deferral write-up, the seam-survey record, the dependency inventory, and the
walkthrough.
