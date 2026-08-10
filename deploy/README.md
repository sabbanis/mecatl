# Deploying mecated

Kubernetes manifests for the mecatl server, `mecated`. The container image is
built with [`ko`](https://ko.build) directly from `./cmd/mecated` — there is no
Dockerfile. Manifests reference the image via the `ko://…` placeholder, which
`ko resolve` / `ko apply` substitutes with the real ref at deploy time.

## ⚠️ Security: the mecated API is auth-optional

mecated exposes command and file execution over gRPC + HTTP. Authentication is
**opt-in**: it is **off by default**, so unless you enable it the API performs
**no caller identity check** (see `cmd/mecated/main.go`). The in-code default binds
loopback for exactly this reason. The Deployment overrides that to `0.0.0.0`
because a pod's network namespace is isolated — but that only shifts the trust
boundary to Kubernetes networking.

- **Recommended in-pod control: enable `--auth-token`.** mecated supports
  `--auth-token` (bearer-token auth) as well as TLS and mTLS. Turning on
  `--auth-token` gives you a caller-identity check that travels with the pod,
  independent of network topology. The `/healthz` and `/readyz` endpoints are
  mounted **outside** the auth boundary, so probes keep working when auth is on.
- A default-deny ingress **`NetworkPolicy`** ships in `networkpolicy.yaml`
  (wired into `kustomization.yaml`). It selects the mecated pod and allows no
  ingress until you add an explicit allow for your clients — defense-in-depth on
  top of (or in lieu of) `--auth-token`. See that file for a ready-to-adapt
  client-allow block. Egress is intentionally left open because mecated needs
  cluster DNS and outbound HTTPS to OpenAI.
- The `Service` is `ClusterIP` only. Do **not** expose it via
  LoadBalancer/NodePort/Ingress without an auth boundary in front.
- For exposure beyond a trusted network, combine `--auth-token`/mTLS with the
  NetworkPolicy, or front mecated with an external auth proxy / mTLS gateway.

## Prerequisites

- `ko` installed — https://ko.build/install/
- A container registry, set via `KO_DOCKER_REPO`
  (e.g. `export KO_DOCKER_REPO=ghcr.io/stacklok/mecatl`).
- `kubectl` with access to the target cluster.
- The `mecated-openai` Secret containing `OPENAI_API_KEY` (see below).

## The OpenAI API key Secret

The Deployment passes `--openai` and reads `OPENAI_API_KEY` from a Secret named
`mecated-openai`. Create it out-of-band — never commit a real key:

```sh
kubectl create secret generic mecated-openai \
  --from-literal=OPENAI_API_KEY="sk-...your-key..."
```

`secret.example.yaml` is an illustrative placeholder (plus a commented
`ExternalSecret` template for the External Secrets Operator). It is **not** in
`kustomization.yaml`, so a `kubectl apply -k deploy/` will not push a dummy key.

## Build a local image

```sh
task ko:build          # KO_DOCKER_REPO=ko.local, --local, no push
```

This loads the image into your local Docker/podman daemon and prints the
fully-qualified ref (content-hash tag).

## Build, push, and deploy to a cluster

```sh
export KO_DOCKER_REPO=ghcr.io/stacklok/mecatl   # your registry

task ko:publish                          # build + push the image
task ko:resolve | kubectl apply -f -      # render ko://… → real ref, then apply
```

`task ko:resolve` runs `ko resolve -f deploy/`, which builds+pushes the image and
emits the manifests with the `ko://…` placeholder replaced. Pipe straight into
`kubectl apply -f -`.

> Note: `ko resolve -f deploy/` processes the YAML files; `kustomization.yaml`
> is for `kubectl apply -k deploy/` (which does not do ko substitution). Use the
> `ko resolve | kubectl apply -f -` flow for the ko-built image.

## Probes: httpGet against /healthz and /readyz

mecated serves HTTP health endpoints on the `http` port (8081), mounted **outside**
the auth boundary so they work with or without `--auth-token`:

- **`/readyz`** — readiness probe; gates Service traffic until the app can serve.
- **`/healthz`** — liveness probe; detects a hung process so it gets restarted.

Both are configured as `httpGet` probes in `deployment.yaml`. (gRPC clients can
also use the standard `grpc_health_v1` health service on the `grpc` port.)

## Pod Security Standards: restricted

Both the pod- and container-level `securityContext` satisfy the PSS
**restricted** profile: `runAsNonRoot` (UID/GID 65532, matching the chainguard
static base), `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`,
`seccompProfile: RuntimeDefault`, and `capabilities.drop: [ALL]`.

## Caller identity (OIDC) — the opt-in overlay

`deploy/mecak8s-oidc/` is a kustomize overlay over `deploy/mecak8s/` that turns
on **caller identity**: a real IdP authenticates each caller, and every session
and schedule records the verified `(issuer, subject)` that owns it.

```sh
kubectl apply -k deploy/mecak8s-oidc     # edit the three flag values first
```

It appends three flags to the agent — `--oidc-issuer`, `--oidc-audience`
(required whenever the issuer is set) and the optional `--oidc-jwks-uri` (pin the
signing-key endpoint and skip discovery, for an air-gapped or pinned-key
deployment). The base deploys with identity **off**, byte-identically to a mecatl
without it, so nothing changes for existing users of these manifests.

**This is attribution, not isolation.** It records who acted; it refuses nothing.
Any authenticated caller can still list and act on any session — per-caller
access control is separate, later work. Do not deploy it as a tenancy boundary.

**Point it at a real external IdP over HTTPS.** That is the only shape that works
with the token validator's security defaults intact: it refuses an `http://`
issuer, and refuses a `jwks_uri` that resolves to a private, loopback or
link-local address — which is what stops a `jwks_uri` aimed at cloud instance
metadata (`169.254.169.254`). An **in-cluster** IdP needs a flag that relaxes
both checks; that flag exists for the end-to-end test fixtures only and is
deliberately absent from these manifests, because a published example must not
ship SSRF relaxation. No `NetworkPolicy` patch is needed either: the base egress
already allows DNS plus TCP 443 to any destination IP, exactly what an external
IdP requires.

### Current build: the flags fail closed

The token validator lives in a shared library that is **not yet part of this
build**, so a process started with `--oidc-issuer` set exits non-zero with:

```
oidc: misconfigured: no OIDC token validator is available in this build
```

That is deliberate. A verifier that cannot be constructed must never degrade
silently to unauthenticated — the classic misconfigured-verifier fail-open — so
mecated and mecak8s refuse to start instead. It is not a bug in the overlay, and
it resolves when the validator library lands.

### Trying it locally by hand

Once the validator ships, the same three flags work on a plain `mecated` and are
the quickest way to see attribution end to end:

```sh
bin/mecated --grpc-addr=127.0.0.1:8080 \
  --oidc-issuer=https://idp.example.com/realms/mecatl \
  --oidc-audience=mecatl \
  --oidc-jwks-uri=https://idp.example.com/realms/mecatl/protocol/openid-connect/certs
```

Then create a session with a bearer token from that issuer and list sessions: the
row names the caller. Until the validator lands this exits with the message
above, which is the expected result rather than a misconfiguration on your side.
