# Task 01 — ToolHive vMCP Kubernetes real-MCP baseline

## Question

Can the selected ToolHive vMCP embedded authorization-server configuration, deployed with mecak8s and Redis in a disposable Kind cluster, complete real per-user OAuth consent, preserve grants across restart, and call a real OAuth-protected streaming-HTTP MCP backend without cross-user credential reuse?

Mecak8s is deployed as part of the reproducible topology but is not yet in the outbound vMCP call path. Do not implement mecak8s broker code, internal agent SPIFFE identities, a sidecar, or client UI changes.

## Fixed constraints

- Use a disposable Kind cluster and versioned manifests/scripts plus external secret prerequisites.
- Deploy mecak8s, ToolHive vMCP, the ToolHive embedded authorization server, Redis-backed state, ingress/callback topology, and one real streaming-HTTP MCP backend.
- Record the exact ToolHive image/commit. It must support the selected bootstrap path; do not assume mecatl's `v0.40.0` module pin supplies newer ToolHive runtime features.
- Use two controlled identities, `alice` and `bob`, with separately consented authority and distinguishable read-only resources.
- Use only controlled read-only calls. Do not create, change, or delete external resources.
- Live tokens, refresh tokens, client secrets, authorization codes, callback query values, and encryption keys must not be committed, printed in reports, put in manifests, or passed to model-facing processes.

## Bootstrap choice

Before deployment, select one and state why:

1. **Static ToolHive delegate client:** operator-provisioned ID + Kubernetes Secret reference + exact scopes/audiences, used only for RFC 8693 token exchange; or
2. **Confidential DCR client:** ToolHive registers an HTTPS non-loopback client and returns a generated secret once, which the proof must persist safely.

Neither client is a user credential. The worker must record the specific ToolHive feature/version that makes the chosen mode available. Do not claim that either bootstrap path supplies SPIFFE workload binding; #6199 is the planned replacement.

## Acceptance criteria and deliverables

### AC 1 — Real target preflight

**Accept when:** the chosen backend is an off-the-shelf streaming-HTTP MCP implementation that supports initialize, `tools/list`, and a safe tool call; browser callback topology works; and Alice/Bob can produce distinguishable read-only results.

**Deliver:** backend/provider/version, selected safe operation, resource distinction, topology diagram, and secret-reference inventory only.

### AC 2 — Reproducible Kubernetes deployment

**Accept when:** mecak8s, vMCP, embedded AS, Redis, and the backend are healthy; the AS uses durable Redis state; and protected-resource URL, AS issuer, allowed audience, backend route, and bootstrap client mode can be inspected without credential disclosure.

**Deliver:** manifests/scripts or exact commands, images/versions/namespaces/resource names, secret-reference names, sanitized readiness evidence, and effective non-secret configuration.

### AC 3 — Alice end-to-end journey

**Accept when:** Alice completes upstream consent; obtains a vMCP credential valid only for the configured protected resource; performs genuine MCP initialize and `tools/list`; and the safe real call proves Alice's resource/identity.

**Deliver:** sanitized repeatable command/test sequence, MCP protocol evidence, and safe Alice result evidence.

### AC 4 — Bob separation

**Accept when:** Bob independently consents and reaches Bob's resource; Alice/Bob receive only their own expected results; and a deliberately invalid/mismatched session/credential path is denied without logging, replaying, or extracting the other user's raw credential.

**Deliver:** Alice/Bob results table, negative-case evidence, and a precise statement of what this does and does not prove about ToolHive credential lookup ordering.

### AC 5 — Durable reload and failure behavior

**Accept when:** restart preserves an unexpired authorized path without browser re-consent; invalid/revoked credentials yield explicit reconnect/re-consent rather than fallback to another user/service authority; and Redis, rather than pod-local state or an environment bearer, accounts for persistence.

**Deliver:** restart procedure, sanitized before/after evidence, observed invalid/revoked behavior, and explicit provider limitations.

### AC 6 — Parent evidence package

**Accept when:** every AC is marked pass, fail, or not-testable; blockers are categorized; and the report makes no claim about mecak8s outbound integration, broker custody, SPIFFE client auth, or agent delegation.

**Deliver:** final sanitized report, reproducibility instructions, and a recommendation for the next handover: minimal mecak8s owner-to-vMCP binding.
