# Mecak8s vMCP multi-tenant PoC

**Status:** Discovery / proof-of-capability. This is not yet an acceptance plan or a commitment to an implementation architecture.

## Objective

Demonstrate, in Kubernetes and against a real OAuth-protected MCP server, that two distinct users can receive distinct ToolHive vMCP/provider authority without a shared user bearer.

Track A (local `mecated mcp login`) is explicitly out of scope for this plan and is verified separately.

## Current architecture direction

```text
local client -> user OIDC token (aud=mecak8s) -> mecak8s session owner
                                                     |
                                                     | future broker binding
                                                     v
                                              ToolHive vMCP / embedded AS
                                                     |
                                                     v
                                    per-user provider grant -> real MCP backend
```

The three credentials remain distinct:

1. Client-to-mecak8s OIDC access token: authenticates the user to mecak8s.
2. ToolHive vMCP access/delegation token: authenticates a user/caller to the vMCP protected resource.
3. Provider credential: retained by ToolHive and injected only into the selected backend request.

## ToolHive version policy

Mecatl currently requires ToolHive `v0.40.0` as a Go module. The ToolHive source-MCP checkout inspected during discovery is `v0.43.0` and exposes newer confidential-client/delegate-client seams. The Kubernetes PoC must record the exact ToolHive image/commit used and must not assume a runtime image matches mecatl's Go-module dependency.

## Bootstrap and future authentication

- B0 may use a tightly scoped, operator-provisioned ToolHive static delegate client for RFC 8693 token exchange, or confidential DCR where its browser/client lifecycle fits the selected proof.
- A static delegate client authenticates a broker/workload, not a human user. It must have exact audiences/scopes and a Kubernetes Secret reference only.
- ToolHive issue #6199 is the intended replacement for bootstrap shared-secret client authentication: SPIFFE X.509-SVID or JWT-SVID client credentials with explicit workload-to-client association.
- The first PoC must not claim that the static delegate-client path proves final multi-tenant delegation safety. Current ToolHive source warns about blanket exchange authority for self-issued user tokens.

## Internal identity direction

SPIRE/cloud identity attests the broker workload only. Mecatl's proposed internal SPIFFE trust domain is for logical user/agent/subagent authority. ToolHive gateway tokens remain an external projection with `sub=user`, eventually `act.sub=immutable definition`, exact audience, and broker-held proof.

## Handover sequence

1. [`tasks/01-vmcp-k8s-real-mcp-baseline.md`](tasks/01-vmcp-k8s-real-mcp-baseline.md): ToolHive/vMCP Kubernetes real-MCP baseline and Alice/Bob evidence.
2. Only after task 01 succeeds: define a minimal mecak8s in-process broker handover that binds a persisted mecak8s owner to the proven vMCP path.
3. Replace bootstrap client authentication with ToolHive #6199 SPIFFE client authentication once landed and qualified against the deployed image.
4. Move the broker behind a same-Pod process/UID boundary, then introduce mecatl internal agent/subagent delegation.

## Parent-session responsibility

The parent session owns architecture decisions, secret policy, external-target approval, and acceptance/rejection of worker evidence. Handover workers must not make unreviewed trust-boundary decisions.
