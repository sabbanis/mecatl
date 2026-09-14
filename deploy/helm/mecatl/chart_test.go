package mecatl_test

import (
	"os/exec"
	"strings"
	"testing"
)

func render(t *testing.T, args ...string) string {
	t.Helper()
	if _, err := exec.LookPath("helm"); err != nil {
		t.Skip("helm is required")
	}
	cmd := exec.Command("helm", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("helm template: %v\n%s", err, out)
	}
	return string(out)
}

func renderedResource(out, source string) string {
	start := strings.Index(out, "# Source: "+source)
	if start < 0 {
		return ""
	}
	resource := out[start:]
	if end := strings.Index(resource, "\n---"); end >= 0 {
		return resource[:end]
	}
	return resource
}

func TestManagedOwnsBothSeparateWorkloads(t *testing.T) {
	mecatl := render(t, "template", "mecatl", ".", "--set", "global.mecatl.broker.tls.caSecret=broker-workload-ca", "--set", "global.mecatl.broker.tls.caKey=ca.pem", "--set", "global.mecatl.broker.tls.serverName=", "--set", "global.mecatl.broker.workloadJWT.audience=mecabroker", "--set", "global.mecatl.broker.workloadJWT.lifetimeSeconds=600")
	out := mecatl
	if strings.Count(out, "kind: Deployment") != 2 {
		t.Fatalf("managed render deployments = %d, want 2", strings.Count(out, "kind: Deployment"))
	}
	if !strings.Contains(out, "name: mecatl-mecak8s") || !strings.Contains(out, "name: mecatl-mecabroker") {
		t.Fatal("managed render lost deterministic child names")
	}
}

func TestManagedUsesKubernetesWorkloadJWTBootstrapByDefault(t *testing.T) {
	out := render(t, "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml")
	for _, want := range []string{
		`"discovery_url": "https://kubernetes.default.svc/.well-known/openid-configuration"`,
		`"jwks_uri": "https://kubernetes.default.svc/openid/v1/jwks"`,
		`"token_file": "/var/run/mecabroker/workload-jwt/token"`,
		`"subject": "system:serviceaccount:default:managed-mecak8s"`,
		`name: kube-root-ca.crt`,
		`serviceAccountToken:`,
		`nonResourceURLs:`,
		`- /.well-known/openid-configuration`,
		`- /openid/v1/jwks`,
		`automountServiceAccountToken: false`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("managed bootstrap render missing %q", want)
		}
	}
	bundle := renderedResource(out, "mecatl/charts/mecabroker/templates/deployment.yaml")
	serviceAccountToken := bundle[strings.Index(bundle, "serviceAccountToken:"):]
	if strings.Contains(strings.Split(serviceAccountToken, "expirationSeconds:")[0], "audience:") {
		t.Fatal("managed bootstrap default unexpectedly rendered a token audience")
	}
	brokerConfig := renderedResource(out, "mecatl/charts/mecabroker/templates/configmap.yaml")
	workloadJWT := brokerConfig[strings.Index(brokerConfig, `"workload_jwt":`):]
	if strings.Contains(workloadJWT, `"issuer":`) {
		t.Fatal("managed bootstrap broker config contains an explicit workload JWT issuer")
	}
}

func TestManagedKubernetesBootstrapAcceptsExplicitAPIAudience(t *testing.T) {
	out := render(t, "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", "global.mecatl.broker.workloadJWT.kubernetesBootstrap.apiAudience=https://api.example")
	bundle := renderedResource(out, "mecatl/charts/mecabroker/templates/deployment.yaml")
	serviceAccountToken := bundle[strings.Index(bundle, "serviceAccountToken:"):]
	if !strings.Contains(strings.Split(serviceAccountToken, "expirationSeconds:")[0], `audience: "https://api.example"`) {
		t.Fatal("managed bootstrap did not render the explicit API token audience")
	}
}
func TestManagedUsesCompleteExternalWorkloadJWTTrust(t *testing.T) {
	out := render(t, "template", "managed", ".", "-f", "ci/managed-external-workload-jwt-values.yaml")
	for _, want := range []string{
		`"issuer": "https://issuer.example"`,
		`"jwks_uri": "https://issuer.example/jwks"`,
		`"subject": "system:serviceaccount:default:managed-mecak8s"`,
		`"trust_bundle_file": "/var/run/mecabroker/workload-jwt/ca.pem"`,
		`secretName: broker-workload-ca`,
		`--mcp-broker-address=managed-mecabroker:8443`,
		`--mcp-broker-server-name=managed-mecabroker`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("managed external trust render missing %q", want)
		}
	}
	brokerConfig := renderedResource(out, "mecatl/charts/mecabroker/templates/configmap.yaml")
	brokerDeployment := renderedResource(out, "mecatl/charts/mecabroker/templates/deployment.yaml")
	if strings.Contains(brokerConfig, `"kubernetes_bootstrap":`) || strings.Contains(brokerDeployment, `serviceAccountToken:`) || renderedResource(out, "mecatl/charts/mecabroker/templates/kubernetes-bootstrap-rbac.yaml") != "" {
		t.Fatal("managed external trust render contains bootstrap artifact")
	}
}

func TestManagedRejectsPartialExternalWorkloadJWTTrust(t *testing.T) {
	cmd := exec.Command("helm", "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", "global.mecatl.broker.workloadJWT.issuer=https://issuer.example")
	if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "external trust requires issuer, jwksURI, and trustBundleSecret together") {
		t.Fatalf("managed render accepted partial global workload JWT trust: %s", out)
	}
}

func TestManagedBootstrapCanUsePreprovisionedRBAC(t *testing.T) {
	out := render(t, "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", "global.mecatl.broker.workloadJWT.kubernetesBootstrap.createRBAC=false")
	if strings.Contains(out, "kind: ClusterRole") || strings.Contains(out, "kind: ClusterRoleBinding") {
		t.Fatal("managed bootstrap rendered chart-owned RBAC when createRBAC=false")
	}
	if !strings.Contains(out, "serviceAccountToken:") || !strings.Contains(out, "name: kube-root-ca.crt") {
		t.Fatal("managed bootstrap omitted token or API CA when createRBAC=false")
	}
}

func TestManagedRejectsIdentityOverrides(t *testing.T) {
	for _, set := range []string{
		"mecak8s.remoteBroker.address=other:8443",
		"mecak8s.remoteBroker.caSecret=other-ca",
		"mecak8s.remoteBroker.caKey=other.pem",
		"mecak8s.remoteBroker.serverName=other",
		"mecak8s.remoteBroker.workloadJWT.audience=other",
		"mecak8s.remoteBroker.workloadJWT.lifetimeSeconds=601",
		"mecak8s.nameOverride=other-agent",
		"mecak8s.fullnameOverride=other-agent",
		"mecabroker.nameOverride=other-broker",
		"mecabroker.fullnameOverride=other-broker",
	} {
		cmd := exec.Command("helm", "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", "mecak8s.image.digest=sha256:0000000000000000000000000000000000000000000000000000000000000000", "--set", set)
		if out, err := cmd.CombinedOutput(); err == nil {
			t.Fatalf("managed identity override %q was accepted: %s", set, out)
		}
	}
}

func TestGlobalMCPSchemaRejectsInvalidClientMode(t *testing.T) {
	for _, set := range []string{
		"global.mecatl.mcp.servers[0].auth.oauth.client.mode=invalid",
		"global.mecatl.mcp.servers[0].auth.oauth.client.unexpected=value",
	} {
		cmd := exec.Command("helm", "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", set)
		if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "mecatl") {
			t.Fatalf("invalid global MCP value %q was accepted: %s", set, out)
		}
	}
}
func TestExternalOmitsBrokerResources(t *testing.T) {
	out := render(t, "template", "external", ".", "-f", "ci/external-values.yaml")
	if strings.Contains(out, "mecabroker") {
		t.Fatal("external render contains broker resources")
	}
	if strings.Count(out, "kind: Deployment") != 1 {
		t.Fatalf("external render deployments = %d, want 1", strings.Count(out, "kind: Deployment"))
	}
}

func TestMCPInputRejectsExternalOAuth(t *testing.T) {
	cmd := exec.Command("helm", "template", "mecatl", ".", "-f", "ci/external-values.yaml", "--set", "global.mecatl.mcp.broker.callbackURL=https://broker.example/callback")
	if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "external mode") {
		t.Fatalf("external OAuth/callback was accepted: %s", out)
	}
}
