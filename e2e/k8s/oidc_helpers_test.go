//go:build kind_e2e

// SPIKE ONLY — see docs/acceptance/caller-identity-e2e.md "The dependency wall".
// The agent image these fixtures deploy must contain the toolhive-core/authn
// adapter, which lives on spike/authn-wiring and compiles only under the local
// GOWORK override. Run with:
//
//	GOWORK=$PWD/.scratch/go.work.authn task e2e:k8s
//
// MUST NOT merge to acc/caller-identity until toolhive-core tags authn.

package k8s_e2e_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"os/exec"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
)

const (
	jwksName  = "jwks"
	jwksKID   = "e2e-key-1"
	jwksPort  = 8080
	oidcAudi  = "mecatl-e2e"
	oidcIssue = "http://jwks.mecatl.svc.cluster.local:8080"
)

// oidcFixture is the in-cluster IdP: an RSA key held by the TEST, whose public
// half is served as a JWKS by a pod. The test signs tokens; the agent verifies
// them against the pod. Nothing is committed, so no token can rot on a date.
type oidcFixture struct {
	key *rsa.PrivateKey
}

// deployJWKS generates the key, publishes the public half as a ConfigMap, and
// deploys a pod serving it plus the NetworkPolicies the traffic needs.
//
// The workload is busybox httpd rather than nginx for one reason: the namespace
// enforces Pod Security Standards **restricted**, so the API server REJECTS a
// pod that is not runAsNonRoot with dropped capabilities and RuntimeDefault
// seccomp. busybox httpd serves a read-only directory as any UID on an
// unprivileged port and needs no writable path, which makes compliance trivial;
// stock nginx wants root and a writable cache.
func deployJWKS(ctx context.Context) *oidcFixture {
	ginkgo.GinkgoHelper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "generate the e2e signing key")

	jwks, err := json.Marshal(map[string]any{"keys": []map[string]string{{
		"kty": "RSA", "use": "sig", "alg": "RS256", "kid": jwksKID,
		"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
	}}})
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "marshal the JWKS")

	ginkgo.By("publishing the public JWKS as a ConfigMap")
	cm, err := json.Marshal(map[string]any{
		"apiVersion": "v1", "kind": "ConfigMap",
		"metadata": map[string]any{"name": jwksName, "namespace": k8sNamespace},
		"data":     map[string]string{"jwks.json": string(jwks)},
	})
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "marshal the ConfigMap")
	kubectlApplyStdin(ctx, cm)

	ginkgo.By("deploying the in-cluster JWKS server + Service + NetworkPolicies")
	kubectlApplyStdin(ctx, []byte(jwksManifests))

	ginkgo.By("waiting for the JWKS pod to be Ready")
	waitOut, err := exec.CommandContext(ctx, "kubectl", "wait", "--for=condition=Ready",
		"pod", "-l", "app.kubernetes.io/name="+jwksName, "-n", k8sNamespace,
		"--timeout=120s").CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"the JWKS pod never became Ready\n--- output ---\n%s", waitOut)

	return &oidcFixture{key: key}
}

// mint signs an RS256 token for sub, valid for ten minutes.
func (f *oidcFixture) mint(sub string) string {
	ginkgo.GinkgoHelper()
	now := time.Now()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": oidcIssue,
		"aud": oidcAudi,
		"sub": sub,
		"iat": now.Unix(),
		"nbf": now.Unix(),
		"exp": now.Add(10 * time.Minute).Unix(),
	})
	tok.Header["kid"] = jwksKID
	s, err := tok.SignedString(f.key)
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "sign a token for %q", sub)
	return s
}

// patchAgentToOIDC turns caller identity ON in the running Deployment and waits
// out the rollout.
//
// The args list is REPLACED wholesale, so it must carry every flag the pod needs
// — the same constraint patchToLiveProvider documents, and the same one that
// makes the deploy/ overlay use a JSON6902 append instead of a strategic merge.
// Dropping --redis-url here would leave the pod with no session store.
//
// --oidc-insecure-allow-private-issuer is required and is exactly why that flag
// exists: the issuer is http:// at an in-cluster address, which the validator
// refuses by default (the check that also blocks a jwks_uri aimed at
// 169.254.169.254). It is a TEST fixture flag and `task deploy:check` fails if it
// ever appears under deploy/.
func patchAgentToOIDC(ctx context.Context) {
	ginkgo.GinkgoHelper()

	args := append(baseAgentArgs(),
		"--oidc-issuer="+oidcIssue,
		"--oidc-audience="+oidcAudi,
		"--oidc-jwks-uri="+oidcIssue+"/jwks.json",
		"--oidc-insecure-allow-private-issuer",
	)
	argsJSON, err := json.Marshal(args)
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "marshal the OIDC args")

	ginkgo.By("patching mecak8s-agent to enable caller identity")
	patch := fmt.Sprintf(
		`[{"op":"replace","path":"/spec/template/spec/containers/0/args","value":%s}]`, argsJSON)
	patchOut, err := exec.CommandContext(ctx, "kubectl", "patch",
		"deployment/mecak8s-agent", "-n", k8sNamespace,
		"--type=json", "-p", patch).CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"kubectl patch deployment to OIDC failed\n--- output ---\n%s", patchOut)

	ginkgo.By("waiting for the OIDC rollout")
	rolloutOut, err := exec.CommandContext(ctx, "kubectl", "rollout", "status",
		"deployment/mecak8s-agent", "-n", k8sNamespace, "--timeout=180s").CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"the OIDC rollout never completed — the pod may be refusing to start (a validator that "+
			"cannot be built is FATAL by design)\n--- output ---\n%s", rolloutOut)

	ginkgo.By("waiting for all mecak8s pods to be Ready (after the OIDC patch)")
	waitPodsReady()
	// The rollout replaced both pods; podNames() filters to Ready only, so the
	// terminating old pods are excluded automatically (patchToLiveProvider precedent).
	agentPods = podNames()
}

// scaleJWKS takes the IdP away (0) or brings it back (1). AC3.2 uses it to make
// the key material genuinely unreachable, which a fake validator can only
// simulate.
func scaleJWKS(ctx context.Context, replicas int) {
	ginkgo.GinkgoHelper()
	out, err := exec.CommandContext(ctx, "kubectl", "scale",
		fmt.Sprintf("deployment/%s", jwksName), "-n", k8sNamespace,
		fmt.Sprintf("--replicas=%d", replicas)).CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"kubectl scale %s to %d failed\n--- output ---\n%s", jwksName, replicas, out)
	if replicas == 0 {
		gomega.EventuallyWithOffset(1, func() string {
			return runCmdQuiet("kubectl", "get", "pods", "-l", "app.kubernetes.io/name="+jwksName,
				"-n", k8sNamespace, "-o", "name")
		}, 90*time.Second, 2*time.Second).Should(gomega.BeEmpty(),
			"the JWKS pod never went away")
	}
}

// kubectlApplyStdin applies a manifest from stdin.
func kubectlApplyStdin(ctx context.Context, manifest []byte) {
	ginkgo.GinkgoHelper()
	apply := exec.CommandContext(ctx, "kubectl", "apply", "-f", "-")
	apply.Stdin = strings.NewReader(string(manifest))
	out, err := apply.CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"kubectl apply (stdin) failed\n--- output ---\n%s", out)
}

// jwksManifests is the IdP workload: a PSS-restricted busybox httpd serving the
// ConfigMap, its Service, and the two NetworkPolicies the traffic needs.
//
// KNOWN FIDELITY GAP: kind's default CNI (kindnetd) does not implement
// NetworkPolicy, so these two policies are applied and INERT here. They are
// included because the namespace default-deny covers both directions for every
// pod, so a real cluster running Calico or Cilium WOULD need them — and omitting
// them would let this suite pass while the same configuration failed in
// production. They are correctness-by-construction, not something this suite
// proves.
const jwksManifests = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jwks
  namespace: mecatl
  labels:
    app.kubernetes.io/name: jwks
    app.kubernetes.io/part-of: mecak8s
    app.kubernetes.io/component: idp
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: jwks
  template:
    metadata:
      labels:
        app.kubernetes.io/name: jwks
        app.kubernetes.io/part-of: mecak8s
        app.kubernetes.io/component: idp
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: httpd
          image: busybox:1.37
          command: ["/bin/busybox", "httpd", "-f", "-v", "-p", "8080", "-h", "/www"]
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: jwks
              mountPath: /www
              readOnly: true
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          readinessProbe:
            httpGet:
              path: /jwks.json
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
      volumes:
        - name: jwks
          configMap:
            name: jwks
---
apiVersion: v1
kind: Service
metadata:
  name: jwks
  namespace: mecatl
  labels:
    app.kubernetes.io/name: jwks
    app.kubernetes.io/part-of: mecak8s
spec:
  selector:
    app.kubernetes.io/name: jwks
  ports:
    - name: http
      port: 8080
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: jwks-allow-agent-ingress
  namespace: mecatl
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: jwks
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: mecatl
          podSelector:
            matchLabels:
              app.kubernetes.io/name: mecatl
              app.kubernetes.io/part-of: mecak8s
              app.kubernetes.io/component: agent
      ports:
        - protocol: TCP
          port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mecak8s-agent-allow-jwks-egress
  namespace: mecatl
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: mecatl
      app.kubernetes.io/part-of: mecak8s
      app.kubernetes.io/component: agent
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: jwks
      ports:
        - protocol: TCP
          port: 8080
`

// baseAgentArgs is the Deployment's args WITHOUT caller identity — the single
// source both the OIDC patch and the restore build from, so they cannot drift.
//
// The list is replaced wholesale by a JSON6902 `replace`, so it must carry every
// flag the pod needs; dropping --redis-url would leave the pod with no session
// store while still looking like a successful patch.
func baseAgentArgs() []string {
	return []string{
		"--grpc-addr=0.0.0.0:8080",
		"--http-addr=0.0.0.0:8081",
		"--redis-url=redis:6379",
		"--session-lease-k8s-namespace=" + k8sNamespace,
		"--headless=true",
		"--posture=auto",
		"--mock",
	}
}

// restoreAgentFromOIDC puts the Deployment back to the unauthenticated baseline
// and removes the IdP.
//
// This is NOT optional hygiene. The Deployment is shared cluster state for the
// whole suite: leaving identity on makes every later spec's unauthenticated
// request 401, which is exactly how the first run of these specs turned three
// passing specs red. A spec that mutates shared state restores it.
func restoreAgentFromOIDC(ctx context.Context) {
	ginkgo.GinkgoHelper()
	argsJSON, err := json.Marshal(baseAgentArgs())
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "marshal the base args")

	ginkgo.By("restoring mecak8s-agent to the unauthenticated baseline")
	patch := fmt.Sprintf(
		`[{"op":"replace","path":"/spec/template/spec/containers/0/args","value":%s}]`, argsJSON)
	out, err := exec.CommandContext(ctx, "kubectl", "patch",
		"deployment/mecak8s-agent", "-n", k8sNamespace,
		"--type=json", "-p", patch).CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"restore patch failed\n--- output ---\n%s", out)

	rollout, err := exec.CommandContext(ctx, "kubectl", "rollout", "status",
		"deployment/mecak8s-agent", "-n", k8sNamespace, "--timeout=180s").CombinedOutput()
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(),
		"restore rollout never completed\n--- output ---\n%s", rollout)
	waitPodsReady()
	agentPods = podNames()

	// Delete the IdP so nothing later trips over it.
	_ = exec.CommandContext(ctx, "kubectl", "delete", "-n", k8sNamespace,
		"deployment/jwks", "service/jwks", "configmap/jwks",
		"networkpolicy/jwks-allow-agent-ingress",
		"networkpolicy/mecak8s-agent-allow-jwks-egress",
		"--ignore-not-found").Run()
}
