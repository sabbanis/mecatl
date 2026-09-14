---
sidebar_position: 5
title: Standalone MCP broker
description: Deploy the process-bound MCP authorization broker safely as one Kubernetes replica.
---

# Standalone MCP broker

Use `cmd/mecabroker` when `mecak8s` needs a remote ToolHive authorization boundary. It
ships as `ghcr.io/stacklok/mecatl/mecabroker` and has its own
`deploy/helm/mecabroker/` chart; it is not part of the mecak8s chart.

## Managed umbrella workload-JWT bootstrap

The managed umbrella chart, `deploy/helm/mecatl`, includes `mecak8s` and a
singleton broker. By default, when
`global.mecatl.broker.workloadJWT.issuer`, `jwksURI`, and `trustBundleSecret` are
all omitted, the broker uses Kubernetes authenticated discovery and JWKS
bootstrap. It receives a broker-specific projected ServiceAccount token and
mounts the expected `kube-root-ca.crt` trust bundle. The chart-owned RBAC grants
that broker ServiceAccount only these non-resource `GET` permissions:

- `/.well-known/openid-configuration`
- `/openid/v1/jwks`

The chart does not create anonymous RBAC. Keep the default `NetworkPolicy`
configuration in mind: egress remains platform-owned and default-deny unless
`networkPolicy.operatorEgress` is configured. If egress policy is enforced, the
operator must allow DNS and the Kubernetes API/discovery traffic needed by the
bootstrap, as well as any other configured destinations.

For an external issuer, set the complete trust tuple. All three values are
required together; a partial configuration fails Helm rendering:

```yaml
global:
  mecatl:
    broker:
      workloadJWT:
        issuer: https://issuer.example
        jwksURI: https://issuer.example/jwks
        trustBundleSecret: broker-workload-ca
        trustBundleKey: ca.pem
```

With all three values present, the umbrella selects the external trust path and
does not render the Kubernetes discovery/JWKS bootstrap resources. Most managed
clusters leave `kubernetesBootstrap.apiAudience` empty so the projected token
uses the API server's default audience. Set it only when the API server requires
a distinct configured audience.

To pre-provision the discovery permissions instead, set
`global.mecatl.broker.workloadJWT.kubernetesBootstrap.createRBAC: false`. The
pre-provisioned role must grant the broker ServiceAccount the two exact
non-resource `GET` permissions listed above; the chart still renders the
projected token and trust-bundle mounts.

```yaml
global:
  mecatl:
    broker:
      workloadJWT:
        kubernetesBootstrap:
          createRBAC: false
```

```sh
helm template mecatl deploy/helm/mecatl -f values.yaml
```

For the standalone chart:

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
| `workloadJWT.{issuer,jwksURI,audience,subject,maxJWKSStalenessSeconds}` | Verification of the mecak8s workload credential. `workloadJWT.trustBundle.{secretName,key}` supplies the read-only trust bundle. In the managed umbrella, omit external issuer/JWKS/trust inputs for Kubernetes bootstrap; `global.mecatl.broker.workloadJWT.kubernetesBootstrap.{createRBAC,apiAudience}` controls pre-provisioned RBAC and a custom Kubernetes API token audience. |
| `callbackURL` | The externally reachable final browser callback URL. It must route to this broker. |
| `profiles[]` | Typed upstream profiles: `name`, `url`, `auth: none|oauth`, and, for OAuth, a strict `oauth.client_mode` union: `preregistered` requires `client_id` plus `client_secret_file`, and `dcr` requires `dcr_discovery_url`; CIMD is rejected because mecabroker has no CIMD construction support; each mode rejects the other modes' fields. OAuth profiles may also declare typed `tools`. |
| `drain.{propagationDelaySeconds,timeoutSeconds,listenerShutdownTimeoutSeconds}` | Bounded singleton shutdown timing. |
| `transport.*` and `runtime.*` | Explicit RPC, handle, owner, receipt, execute, logical-session, retention, and pending-authorization bounds. |
| `service.port` | The Service port for the multiplexed public listener. |
| `rollout.restartToken` | An operator-controlled pod-template change used to restart after external secret rotation. |
| `networkPolicy.{publicFrom,operatorEgress}` | Standard Kubernetes L3/L4 peers for the public listener and outbound destinations. The broker chart does not add broad outbound allowances. |

The broker process does not implement the legacy OAuth `network` controls (`additionalOrigins`,
`privateOrigins`, or `maxRedirects`). The chart rejects those fields during rendering and the
binary rejects them during configuration admission; use the mecak8s in-process MCP client for
that contract instead of silently assuming the broker enforces it.

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

The standalone chart can also consume the brokered profile shape directly. This is the
recommended cutover form when `mecak8s` remains a separately managed release:

```yaml
mcp:
  broker:
    callbackURL: https://mcp.example.com/oauth/complete
  servers:
    - name: github
      url: https://github.example/mcp
      auth:
        mode: oauth
        oauth:
          upstream:
            mode: oauth2
            oauth2:
              authorizationEndpoint: https://github.example/login/oauth/authorize
              tokenEndpoint: https://github.example/login/oauth/access_token
          client:
            mode: preregistered
            preregistered:
              id: mecatl-broker
              secretKeyRef: {name: github-oauth, key: client-secret}
          scopes: [repo]
          requestRefreshToken: true
          network: {additionalOrigins: [], privateOrigins: [], maxRedirects: 0}
```

Only `auth.mode: oauth` entries belong in this broker chart's `mcp.servers`; direct
`none` and `staticBearer` entries remain in the mecak8s release. When
`remoteBroker` is configured, however, neither direct mode is accepted: all MCP
routes must use broker authority. `mcp.servers` and legacy
`profiles` are mutually exclusive, and the nested `mcp.broker.callbackURL` must be the only
callback source for that migration form. The broker projects
Secret references read-only and never puts secret bytes in Helm values or its ConfigMap.
For a separately managed broker, configure `mecak8s.remoteBroker` with the broker
Service address, serving CA, SNI name, and projected-token audience/lifetime. Those
routine links can be selected from the broker Service, but JWT issuer/JWKS/trust,
the listener client trust bundle, and the public `mcp.callbackURL` are explicit trust
inputs. The callback URL is never inferred from a Kubernetes Service name. A single
values file cannot derive values across two independent Helm releases; use a release
bundle or keep these two values files as an explicit interface.

When `remoteBroker` is set, mecak8s renders only route metadata for brokered OAuth
entries and does not mount or configure their OAuth client secrets. The broker release
owns the callback, OAuth routes, refresh state, network controls, and static tool
catalogue. Deploy either this external mode or an embedded broker mode, not both.

Cutover is a maintenance boundary: planned singleton replacement can interrupt active
attachments and browser callbacks. No in-flight OAuth grant, callback, or authorization
state is migrated between the old embedded and new standalone broker; start a fresh
enrollment after the cutover.

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
