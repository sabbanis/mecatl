package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/yaml"
)

func TestManagedMCPRenderedBrokerConfigAdmitsStrictParser(t *testing.T) {
	cmd := exec.Command("helm", "template", "production", "../../deploy/helm/mecabroker", "-f", "../../deploy/helm/mecabroker/ci/managed-mcp-values.yaml")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("helm template: %v\n%s", err, output)
	}
	var configMap corev1.ConfigMap
	for _, document := range strings.Split(string(output), "\n---") {
		var candidate corev1.ConfigMap
		if yaml.Unmarshal([]byte(document), &candidate) == nil && candidate.Kind == "ConfigMap" && candidate.Data["broker.json"] != "" {
			configMap = candidate
			break
		}
	}
	if configMap.Data == nil {
		t.Fatal("rendered chart has no broker.json ConfigMap entry")
	}
	var rendered map[string]any
	if err := json.Unmarshal([]byte(configMap.Data["broker.json"]), &rendered); err != nil {
		t.Fatalf("rendered broker.json: %v", err)
	}
	profiles := rendered["profiles"].([]any)
	oauth := profiles[0].(map[string]any)["oauth"].(map[string]any)
	if oauth["client_mode"] != "preregistered" {
		t.Fatalf("rendered managed MCP client_mode = %v", oauth["client_mode"])
	}
	secret := filepath.Join(t.TempDir(), "client-secret")
	if err := os.WriteFile(secret, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	configMap.Data["broker.json"] = strings.Replace(configMap.Data["broker.json"], oauth["client_secret_file"].(string), secret, 1)
	configPath := filepath.Join(t.TempDir(), "broker.json")
	if err := os.WriteFile(configPath, []byte(configMap.Data["broker.json"]), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := readConfig(configPath)
	if err != nil {
		t.Fatalf("rendered broker.json rejected by strict parser: %v", err)
	}
	toolHive := cfg.toolHive()
	if len(toolHive.Profiles) != 1 || toolHive.Profiles[0].OAuth == nil || toolHive.Profiles[0].OAuth.ClientID != "broker-client" || toolHive.Profiles[0].OAuth.ClientSecretFile != secret {
		t.Fatalf("rendered config to ToolHive mapping = %#v", toolHive.Profiles)
	}
}

func validBrokerConfig() fileConfig {
	cfg := fileConfig{APIVersion: brokerAPIVersion, CallbackURL: "https://broker.example/callback"}
	cfg.Listener.PublicAddress, cfg.Listener.TLSCertFile, cfg.Listener.TLSKeyFile = ":8443", "cert", "key"
	cfg.WorkloadJWT.Issuer, cfg.WorkloadJWT.JWKSURI, cfg.WorkloadJWT.Audience, cfg.WorkloadJWT.Subject, cfg.WorkloadJWT.TrustBundleFile = "https://issuer.example", "https://issuer.example/jwks", "audience", "subject", "ca.pem"
	cfg.WorkloadJWT.MaxJWKSStaleness = duration(time.Minute)
	cfg.Drain.PropagationDelay, cfg.Drain.Timeout, cfg.Drain.ListenerShutdownTimeout = duration(time.Second), duration(time.Second), duration(time.Second)
	cfg.Transport.RPCDeadline, cfg.Transport.ExecuteDeadline, cfg.Transport.HandleIdleTimeout, cfg.Transport.SweepInterval, cfg.Transport.CleanupTimeout = duration(time.Second), duration(time.Second), duration(time.Second), duration(time.Second), duration(time.Second)
	cfg.Runtime.LogicalRetention = duration(time.Second)
	cfg.Transport.MaxHandles, cfg.Transport.MaxOwners, cfg.Transport.MaxReceipts, cfg.Transport.MaxReceiptBytes, cfg.Transport.MaxPendingControls, cfg.Transport.MaxActiveExecutes, cfg.Runtime.MaxLogicalSessions, cfg.Runtime.MaxPendingAuthStates = 1, 1, 1, 1, 1, 1, 1, 1
	return cfg
}

func TestParseFlagsWithLoggingAcceptsInvalidLevelWithWarning(t *testing.T) {
	original := os.Args
	t.Cleanup(func() { os.Args = original })
	os.Args = []string{"mecabroker", "--log-level=verbose"}
	_, level, warning, err := parseFlagsWithLogging()
	if err == nil || level.String() != "INFO" || !strings.Contains(warning, "invalid --log-level") {
		t.Fatalf("invalid log level = level:%s warning:%q error:%v", level, warning, err)
	}
}

func TestKubernetesWorkloadJWTBootstrapConfiguration(t *testing.T) {
	cfg := validBrokerConfig()
	cfg.Profiles = []fileProfile{{Name: "public", URL: "https://mcp.example", Auth: "none"}}
	cfg.WorkloadJWT.Issuer, cfg.WorkloadJWT.JWKSURI = "", ""
	cfg.WorkloadJWT.KubernetesBootstrap = &fileKubernetesBootstrap{
		DiscoveryURL: "https://kubernetes.default.svc/.well-known/openid-configuration",
		JWKSURI:      "https://kubernetes.default.svc/openid/v1/jwks",
		TokenFile:    "/var/run/secrets/kubernetes.io/serviceaccount/token",
	}
	if err := cfg.validate(); err != nil {
		t.Fatalf("bootstrap configuration rejected: %v", err)
	}
	production := cfg.workloadJWTConfig([]byte("ca"))
	if production.Issuer != "" || production.JWKSURI != "" || production.KubernetesBootstrap == nil || production.KubernetesBootstrap.DiscoveryURL != cfg.WorkloadJWT.KubernetesBootstrap.DiscoveryURL {
		t.Fatalf("bootstrap production mapping = %#v", production)
	}
	cfg.WorkloadJWT.Issuer = "https://issuer.example"
	if err := cfg.validate(); err == nil {
		t.Fatal("bootstrap and explicit issuer were accepted together")
	}
}

func TestToolHiveRejectsCIMDConfiguration(t *testing.T) {
	const cimd = "https://client.example/metadata.json"
	cfg := validBrokerConfig()
	cfg.Profiles = []fileProfile{{
		Name: "private", URL: "https://mcp.example/mcp", Auth: "oauth",
		OAuth: &fileOAuth{Issuer: "https://issuer.example", ClientMode: "cimd", CIMDDocumentURL: cimd},
	}}
	if err := cfg.validate(); err == nil || err.Error() != unsupportedCIMDError {
		t.Fatalf("CIMD validation error = %v, want %q", err, unsupportedCIMDError)
	}
}

func TestBrokerRejectsUnsupportedOAuthNetworkSettings(t *testing.T) {
	cfg := validBrokerConfig()
	cfg.Profiles = []fileProfile{{
		Name: "private", URL: "https://mcp.example/mcp", Auth: "oauth",
		OAuth: &fileOAuth{Issuer: "https://issuer.example", ClientID: "client", Network: &fileOAuthNetwork{MaxRedirects: 1}},
	}}
	if err := cfg.validate(); err == nil || !strings.Contains(err.Error(), "OAuth network settings are unsupported") {
		t.Fatalf("validate error = %v, want actionable unsupported-network error", err)
	}
}

func TestBrokerRejectsDuplicateProfileNamesCaseInsensitively(t *testing.T) {
	cfg := validBrokerConfig()
	cfg.Profiles = []fileProfile{{
		Name: "Public", URL: "https://one.example/mcp", Auth: "none",
	}, {
		Name: "public", URL: "https://two.example/mcp", Auth: "none",
	}}
	if err := cfg.validate(); err == nil || !strings.Contains(err.Error(), "duplicate broker profile name") {
		t.Fatalf("validate error = %v, want duplicate-name error", err)
	}
}

func TestBrokerOAuthClientModeUnionIsStrict(t *testing.T) {
	cases := []struct {
		name  string
		oauth fileOAuth
		want  string
	}{
		{"missing mode", fileOAuth{ClientID: "id", ClientSecretFile: "/missing"}, "client_mode"},
		{"preregistered missing secret", fileOAuth{ClientMode: "preregistered", ClientID: "id"}, "requires client_id and client_secret_file"},
		{"preregistered with dcr", fileOAuth{ClientMode: "preregistered", ClientID: "id", ClientSecretFile: "/secret", DCRDiscoveryURL: "https://issuer.example/dcr"}, "cannot include CIMD or DCR"},
		{"cimd missing url", fileOAuth{ClientMode: "cimd"}, "CIMD OAuth client_mode is unsupported by mecabroker; use preregistered or dcr"},
		{"cimd with secret", fileOAuth{ClientMode: "cimd", CIMDDocumentURL: "https://client.example/meta", ClientSecretFile: "/secret"}, "CIMD OAuth client_mode is unsupported by mecabroker; use preregistered or dcr"},
		{"dcr missing url", fileOAuth{ClientMode: "dcr"}, "requires dcr_discovery_url"},
		{"dcr missing endpoints", fileOAuth{ClientMode: "dcr", DCRDiscoveryURL: "https://issuer.example/dcr", Issuer: "https://issuer.example"}, "requires explicit authorization_endpoint and token_endpoint"},
		{"dcr with client", fileOAuth{ClientMode: "dcr", DCRDiscoveryURL: "https://issuer.example/dcr", ClientID: "id", AuthorizationEndpoint: "https://issuer.example/authorize", TokenEndpoint: "https://issuer.example/token"}, "cannot include client credentials"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := validBrokerConfig()
			cfg.Profiles = []fileProfile{{Name: "private", URL: "https://mcp.example/mcp", Auth: "oauth", OAuth: &tc.oauth}}
			if err := cfg.validate(); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("validate error = %v, want %q", err, tc.want)
			}
		})
	}

	secret := t.TempDir() + "/client-secret"
	if err := os.WriteFile(secret, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := validBrokerConfig()
	cfg.Profiles = []fileProfile{{Name: "private", URL: "https://mcp.example/mcp", Auth: "oauth", OAuth: &fileOAuth{Issuer: "https://issuer.example", ClientMode: "preregistered", ClientID: "id", ClientSecretFile: secret}}}
	if err := cfg.validate(); err != nil {
		t.Fatalf("valid preregistered profile rejected: %v", err)
	}
}
