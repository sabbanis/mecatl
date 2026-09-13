---
sidebar_position: 5
title: Standalone MCP broker
description: Deploy the process-bound MCP authorization broker safely as one Kubernetes replica.
---

# Standalone MCP broker

Use `cmd/mecabroker` when `mecak8s` needs a remote ToolHive authorization boundary. It
ships as `ghcr.io/stacklok/mecatl/mecabroker` and has its own
`deploy/helm/mecabroker/` chart; it is not part of the mecak8s chart.

```sh
task ko:build:broker
helm template broker deploy/helm/mecabroker \
  -f deploy/helm/mecabroker/ci/production-values.yaml
```

Create the TLS, workload-JWT trust-bundle, and upstream OAuth client Secrets out of
band. Secret values do not belong in Helm values. The chart has a typed values schema.

## Typed configuration

The chart renders one typed `broker.json` ConfigMap from these values. The names below
are Helm values; the generated JSON uses the corresponding snake-case configuration
keys.

| Values | Purpose |
|---|---|
| `listener.publicAddress` and `listener.tls.{secretName,certKey,keyKey}` | The TLS public bind address and the exact certificate/key Secret keys. The default bind is `0.0.0.0:8443`. |
| `workloadJWT.{issuer,jwksURI,audience,subject,maxJWKSStalenessSeconds}` | Verification of the mecak8s workload credential. `workloadJWT.trustBundle.{secretName,key}` supplies the read-only trust bundle. |
| `callbackURL` | The externally reachable final browser callback URL. It must route to this broker. |
| `profiles[]` | Typed upstream profiles: `name`, `url`, `auth: none|oauth`, and, for OAuth, `oauth.clientID`, `oauth.clientSecret.{secretName,key}`, endpoints/issuer, scopes, and `requestRefreshToken`. OAuth profiles may also declare typed `tools`. |
| `drain.{propagationDelaySeconds,timeoutSeconds,listenerShutdownTimeoutSeconds}` | Bounded singleton shutdown timing. |
| `transport.*` and `runtime.*` | Explicit RPC, handle, owner, receipt, execute, logical-session, retention, and pending-authorization bounds. |
| `service.port` | The Service port for the multiplexed public listener. |
| `rollout.restartToken` | An operator-controlled pod-template change used to restart after external secret rotation. |
| `networkPolicy.{publicFrom,operatorEgress}` | Standard Kubernetes L3/L4 peers for the public listener and outbound destinations. |

For an OAuth profile, the chart mounts only the exact `profiles[i].oauth.clientSecret`
Secret key as `/var/run/mecabroker/oauth/i/client-secret`. It is read-only, is not an
environment variable, and is not copied into the ConfigMap. The same exact-key rule
applies to the TLS and workload-JWT trust-bundle mounts.

A minimal shape is:

```yaml
listener:
  publicAddress: 0.0.0.0:8443
  tls: {secretName: mecabroker-tls, certKey: tls.crt, keyKey: tls.key}
workloadJWT:
  issuer: https://kubernetes.default.svc
  jwksURI: https://kubernetes.default.svc/openid/v1/jwks
  audience: mecabroker
  subject: system:serviceaccount:mecatl:mecak8s
  trustBundle: {secretName: mecabroker-workload-jwt, key: ca.pem}
callbackURL: https://mcp.example.com/v1/mcp/broker/callback
profiles:
  - name: github
    url: https://github.example/mcp
    auth: oauth
    oauth:
      clientID: mecak8s
      clientSecret: {secretName: github-oauth, key: client-secret}
      authorizationEndpoint: https://github.example/login/oauth/authorize
      tokenEndpoint: https://github.example/login/oauth/access_token
      scopes: [repo]
      requestRefreshToken: true
```

The chart requires the configured `profiles` and all required typed fields to be
complete. It passes paths and non-secret settings to the process, never secret values.

## Endpoint and name meanings

Keep these names distinct:

- The **SAN** is the DNS name/IP encoded in the broker serving certificate.
- The **callback host** is the host in `callbackURL`, where a user's browser returns;
  it is normally the operator's public gateway name.
- The **Service endpoint** is the Kubernetes address in `mecak8s.remoteBroker.address`.
  It is where mecak8s opens its outbound gRPC connection and need not be public.
- The **TLS server name** is `mecak8s.remoteBroker.serverName`, the name used for
  certificate verification and SNI. It must match a broker certificate SAN, but need not
  be the URL host used for the browser callback.
- The **bind address** (`listener.publicAddress`) is only the broker process's local
  socket address. It is not a certificate name, callback URL, or public route.

One operator-owned public TLS/HTTP2 endpoint should route all three broker surfaces to
the broker Service: gRPC, `/v1/mcp/broker/`, and the final OAuth callback URL. The
mecak8s HTTP listener is not a callback target. Configure the gateway/Ingress and
Certificate separately; this chart creates neither.

## Availability and deliberate restarts

The chart always uses one replica and `Recreate`. It offers no PDB, autoscaling, HA
switch, or outer-broker Redis. Restart interrupts active attachments and callback
correlation. A replaced broker may support a fresh enrollment, but cannot rebind an
active protected call or promise exactly-once external effects.

Secret projection does not by itself make every consumer reload credentials. After
rotating the TLS, workload-JWT CA, or an upstream OAuth Secret, change
`rollout.restartToken` deliberately and perform the controlled singleton restart.
Keep old and new credentials valid during the cutover where the upstream permits it.

If a tool reports an unknown outcome after losing the broker response, treat it as
possibly completed, inspect provider state using a safe read/status operation, and do
not automatically repeat a mutation.

## Probes, drain, and policy limits

Only the TLS public listener is published by the Service. The admin listener is fixed
at loopback-only `127.0.0.1:8081`; shell-free exec probes call the binary's fixed
`health`, `ready`, and `drain` operations. Drain closes gRPC and callback admission
together, waits for endpoint propagation, permits existing work until the configured
finite deadline, then cancels the remainder. The default 70-second pod grace contains
the default drain budget.

`networkPolicy.publicFrom` applies to the one multiplexed public TCP port. Kubernetes
NetworkPolicy is an L3/L4 control: it can select peers and ports, but cannot distinguish
gRPC from browser callbacks, inspect HTTP paths, validate TLS/SANs, enforce OAuth
identity, or express that only a particular upstream hostname is allowed. Put route,
method, TLS, and identity policy in the operator-owned gateway and configure concrete
`operatorEgress` peers for DNS, workload-JWKS, upstream OAuth, and MCP destinations.
External DNS names are not enforced by NetworkPolicy. Empty peer lists remain
(default-deny) rather than being inferred from URLs.

For the complete resource-lifecycle boundary, see [ADR 0327](https://github.com/stacklok/mecatl/blob/main/docs/adr/0327-single-replica-mcp-broker-topology.md).
