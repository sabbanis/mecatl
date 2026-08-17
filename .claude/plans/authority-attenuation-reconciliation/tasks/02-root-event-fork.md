---
id: 02-root-event-fork
title: Root binding, event provenance, and peer-fork preservation
blocked_by: [01-authority-domain]
status: done
branch: plan-authority-attenuation-reconciliation/02-root-event-fork-20260812
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Bind a canonical authority maximum when the service creates a root session, and preserve it through event-only reconstruction and an admitted peer fork. Session ownership and parent-lineage authorization must be decided before parsing authority data, so malformed foreign session state does not become an oracle. A peer fork copies the bound rather than deriving one from the current catalog. Do not implement child authority derivation, catalog enforcement, or managed-definition parsing in this task.

The current accumulator worktree contains partial implementation and tests in `internal/adapter/server`, `engine/adapter/eventsource`, and `engine/session`; reconcile and complete them rather than discarding them.

## Acceptance criteria

- AC2.3: A legacy session retains the documented legacy behavior, while every v1 malformed record is rejected rather than reclassified as legacy.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_LegacyAndMalformedRecordsStayDistinct`
- AC2.4: The feature makes no compare-and-swap or malicious-store-writer claim; ordinary aggregate, creation, recovery, rebuild, and resume paths are the bounded guarantee.
  - verify: inspection — store-level stale-writer protection is explicitly deferred by ADR-0224
- AC6.4: `Service.ForkSession` authorizes the source owner before parsing or copying source authority. An admitted peer fork copies the source authority version, maximum, safe definition identity, owner, and applicable environment semantics; it never derives a fresh maximum from the current catalog.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario6_PeerForkAuthorizesBeforeCopyingSourceMaximum`
- AC7.2: Event-only reconstruction of an explicitly legacy record remains legacy; supplied valid v1 creation metadata restores the exact maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldRespectsExplicitProvenance`
- AC7.3: An event host that claims v1 authority but omits or corrupts its authority metadata cannot fold the session as legacy or resume it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldClaimedV1FailsClosed`
- AC7.4: Caller ownership and parent-lineage authorization runs before authority parsing on child resume, so a foreign malformed child handle is absence-shaped rather than an authority-format oracle.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_OwnershipPrecedesAuthorityParsing`
