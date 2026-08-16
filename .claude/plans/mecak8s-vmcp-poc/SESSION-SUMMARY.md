# Session summary — mecak8s, ToolHive vMCP, and agent identity

## Agreed direction

Build two separate products:

- **Track A:** local, single-user `mecated mcp login`; verify separately.
- **Track B:** mecak8s in Kubernetes serving many users. Mecak8s owns authenticated caller/session authorization. ToolHive vMCP owns configured upstream provider consent, stored provider grants, refresh, and backend injection.

Track B must demonstrate real deployed MCP behavior, not only fakes/unit tests.

## Identity and token model

```text
local client -> mecak8s
  user OIDC token, aud=mecak8s
  mecak8s derives durable owner=(iss,sub)

mecak8s broker -> ToolHive vMCP
  distinct vMCP/delegated token, aud=exact vMCP resource

ToolHive vMCP -> backend provider/MCP
  user provider token, retained and injected by ToolHive only
```

The inbound mecak8s user token is never forwarded unchanged to vMCP/provider. Provider tokens, vMCP bearer tokens, workload keys, and agent tokens must never enter model prompts, tools, shell environments, session snapshots, event logs, or static shared headers.

## SPIFFE model

- SPIRE/cloud IAM attests the broker workload/infrastructure only.
- Mecatl's proposed logical SPIFFE domain represents user/agent/subagent authority; SPIRE cannot attest goroutines.
- ToolHive/vMCP remains an external authorization domain. The intended later gateway token carries `sub=user`, `act.sub=immutable registered definition`, exact audience, and broker-held sender binding.
- The Track-B security candidate is a same-Pod separate process/UID broker; an in-process broker is valuable for interface/product-flow prototyping but not credential-custody proof.

## ToolHive findings and version correction

Mecatl currently pins ToolHive `v0.40.0`. Direct inspection through the `toolhive-source-code` MCP found a ToolHive `v0.43.0` checkout with newer features. The PoC must record and qualify its deployed ToolHive image/commit rather than assuming the Go module pin defines the runtime capability.

Two separate ToolHive confidential-client mechanisms exist:

1. Commit `026422e6d66f901fac85f9f9a51ee677541b5487` / #6252 enables confidential dynamic client registration: behind `allow_confidential_client_registration`, DCR can mint an HTTPS non-loopback confidential client and return its generated secret once.
2. Current source exposes `authserver.RunConfig.DelegateClients`: operator-provisioned static confidential clients with secret file/env references, exact scopes/audiences, and the RFC 8693 token-exchange grant.

The static delegate-client source emits an explicit warning about blanket exchange of eligible self-issued ToolHive user tokens without per-subject client binding. It may be used as a tightly constrained B0 bootstrap/integration mechanism, but does not prove final multi-tenant delegation safety.

ToolHive #6199 is expected to add SPIFFE X.509-SVID/JWT-SVID client authentication with explicit workload-to-client grant/scope/resource/audience association. It should replace the bootstrap shared-secret client after landing and qualification.

## First handover

The first worker task is [`tasks/01-vmcp-k8s-real-mcp-baseline.md`](tasks/01-vmcp-k8s-real-mcp-baseline.md): deploy mecak8s, vMCP, embedded AS, Redis, ingress, and a real OAuth-protected MCP backend in Kind; prove separately consented Alice/Bob calls, isolation, restart persistence, and safe failure/re-consent behavior.

The parent session owns external-target approval, architecture/trust decisions, secret policy, and acceptance of the evidence package.
