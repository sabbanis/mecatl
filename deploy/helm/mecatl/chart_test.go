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

func TestManagedOwnsBothSeparateWorkloads(t *testing.T) {
	mecatl := render(t, "template", "mecatl", ".", "--set", "global.mecatl.broker.tls.caSecret=broker-workload-ca", "--set", "global.mecatl.broker.tls.caKey=ca.pem", "--set", "global.mecatl.broker.workloadJWT.issuer=https://issuer.example", "--set", "global.mecatl.broker.workloadJWT.jwksURI=https://issuer.example/jwks", "--set", "global.mecatl.broker.workloadJWT.audience=mecabroker", "--set", "global.mecatl.broker.workloadJWT.trustBundleSecret=broker-workload-ca")
	out := mecatl
	if strings.Count(out, "kind: Deployment") != 2 {
		t.Fatalf("managed render deployments = %d, want 2", strings.Count(out, "kind: Deployment"))
	}
	if !strings.Contains(out, "name: mecatl-mecak8s") || !strings.Contains(out, "name: mecatl-mecabroker") {
		t.Fatal("managed render lost deterministic child names")
	}
}

func TestManagedUsesGlobalBrokerTrustAndDerivedIdentity(t *testing.T) {
	out := render(t, "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml")
	for _, want := range []string{
		`"issuer": "https://issuer.example"`,
		`"jwks_uri": "https://issuer.example/jwks"`,
		`"subject": "system:serviceaccount:default:managed-mecak8s"`,
		`"trust_bundle_file": "/var/run/mecabroker/workload-jwt/ca.pem"`,
		`--mcp-broker-address=managed-mecabroker:8443`,
		`--mcp-broker-server-name=managed-mecabroker`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("managed render missing %q", want)
		}
	}
	if strings.Contains(out, "https://issuer.invalid") || strings.Contains(out, "subject: placeholder") {
		t.Fatal("managed render used child workload JWT fallback")
	}
}

func TestManagedRequiresGlobalIssuer(t *testing.T) {
	cmd := exec.Command("helm", "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml", "--set", "global.mecatl.broker.workloadJWT.issuer=")
	if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "workloadJWT issuer") {
		t.Fatalf("managed render accepted a missing global issuer: %s", out)
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
	cmd := exec.Command("helm", "template", "mecatl", ".", "--set", "mode=external", "--set", "global.mecatl.mode=external", "--set", "global.mecatl.mcp.broker.callbackURL=https://broker.example/callback")
	if out, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(out), "external mode") {
		t.Fatalf("external OAuth/callback was accepted: %s", out)
	}
}
