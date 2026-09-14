package mecabroker_test

import (
	"os/exec"
	"strings"
	"testing"
)

func TestMecabrokerRejectsCompetingMigrationSources(t *testing.T) {
	for name, sets := range map[string]string{
		"legacy profiles and mcp servers": `profiles=[{"name":"legacy","url":"https://legacy.example/mcp","auth":"none"}],mcp.servers=[{"name":"new","url":"https://new.example/mcp","auth":{"mode":"oauth"}}]`,
		"duplicate names":                 `mcp.servers=[{"name":"same","url":"https://one.example/mcp","auth":{"mode":"oauth"}},{"name":"SAME","url":"https://two.example/mcp","auth":{"mode":"oauth"}}]`,
	} {
		t.Run(name, func(t *testing.T) {
			cmd := exec.Command("helm", "template", "test", ".", "-f", "ci/production-values.yaml", "--set", sets)
			out, err := cmd.CombinedOutput()
			if err == nil {
				t.Fatalf("accepted competing migration sources:\n%s", out)
			}
		})
	}
}

func TestMecabrokerRejectsUnsupportedOAuthNetworkControlsAtRender(t *testing.T) {
	cmd := exec.Command("helm", "template", "test", ".", "-f", "ci/production-values.yaml", "--set", "mcp.broker.callbackURL=https://broker.example/callback", "--set", "callbackURL=https://broker.invalid/callback", "--set-json", `profiles=[]`, "--set-json", `mcp.servers=[{"name":"new","url":"https://new.example/mcp","auth":{"mode":"oauth","oauth":{"client":{"mode":"dcr","dcr":{"discoveryURL":"https://issuer.example/dcr"}},"upstream":{"mode":"oauth2","oauth2":{"authorizationEndpoint":"https://issuer.example/authorize","tokenEndpoint":"https://issuer.example/token"}},"scopes":["read"],"issuer":"https://issuer.example","network":{"additionalOrigins":["https://other.example"],"privateOrigins":[],"maxRedirects":1}}}}]`)
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "network is unsupported by mecabroker") {
		t.Fatalf("network controls were not rejected at render: err=%v output=%s", err, out)
	}
}

func TestMecabrokerRequiresNestedCallbackForServerMigration(t *testing.T) {
	cmd := exec.Command("helm", "template", "test", ".", "-f", "ci/production-values.yaml", "--set-json", `profiles=[]`, "--set-json", `mcp.servers=[{"name":"new","url":"https://new.example/mcp","auth":{"mode":"oauth","oauth":{"client":{"mode":"dcr","dcr":{"discoveryURL":"https://issuer.example/dcr"}},"upstream":{"mode":"oauth2","oauth2":{"authorizationEndpoint":"https://issuer.example/authorize","tokenEndpoint":"https://issuer.example/token"}},"scopes":["read"],"issuer":"https://issuer.example","network":{"additionalOrigins":[],"privateOrigins":[],"maxRedirects":0}}}}]`)
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "mcp.broker.callbackURL is required") {
		t.Fatalf("accepted migration without nested callback: err=%v output=%s", err, out)
	}
}

func TestMecak8sRemoteBrokerRejectsDirectNone(t *testing.T) {
	cmd := exec.Command("helm", "template", "test", "../mecak8s", "--set", "image.digest=sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "--set", "mockProvider=true", "--set", "redis.local.enabled=true", "--set", "remoteBroker.address=broker.mecatl.svc:8443", "--set", "remoteBroker.caSecret=broker-ca", "--set", "remoteBroker.caKey=ca.pem", "--set", "remoteBroker.serverName=broker.example", "--set", "remoteBroker.workloadJWT.audience=mecabroker", "--set-json", `mcp.servers=[{"name":"public","url":"https://public.example/mcp","auth":{"mode":"none"}}]`)
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "remoteBroker cannot be combined with auth.mode none or staticBearer") {
		t.Fatalf("accepted remote broker plus direct server: err=%v output=%s", err, out)
	}
}
func TestMecabrokerRejectsUnsupportedCIMDAtRender(t *testing.T) {
	cmd := exec.Command("helm", "template", "test", ".", "-f", "ci/production-values.yaml", "--set", "mcp.broker.callbackURL=https://broker.example/callback", "--set", "callbackURL=https://broker.invalid/callback", "--set-json", `profiles=[]`, "--set-json", `mcp.servers=[{"name":"new","url":"https://client.example/mcp","auth":{"mode":"oauth","oauth":{"client":{"mode":"cimd","cimd":{"documentURL":"https://client.example/metadata.json"}},"upstream":{"mode":"oauth2","oauth2":{"authorizationEndpoint":"https://issuer.example/authorize","tokenEndpoint":"https://issuer.example/token"}},"scopes":["read"],"network":{"additionalOrigins":[],"privateOrigins":[],"maxRedirects":0}}}}]`)
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "CIMD OAuth client_mode is unsupported by mecabroker; use preregistered or dcr") {
		t.Fatalf("accepted unsupported CIMD: err=%v output=%s", err, out)
	}
}

func TestMecak8sRemoteBrokerRejectsDirectStaticBearer(t *testing.T) {
	cmd := exec.Command("helm", "template", "test", "../mecak8s", "--set", "image.digest=sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "--set", "mockProvider=true", "--set", "redis.local.enabled=true", "--set", "remoteBroker.address=broker.mecatl.svc:8443", "--set", "remoteBroker.caSecret=broker-ca", "--set", "remoteBroker.caKey=ca.pem", "--set", "remoteBroker.serverName=broker.example", "--set", "remoteBroker.workloadJWT.audience=mecabroker", "--set-json", `mcp.servers=[{"name":"private","url":"https://private.example/mcp","auth":{"mode":"staticBearer","staticBearer":{"secretKeyRef":{"name":"private-token","key":"token"}}}}]`)
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "remoteBroker cannot be combined with auth.mode none or staticBearer") {
		t.Fatalf("accepted remote broker plus static bearer: err=%v output=%s", err, out)
	}
}
