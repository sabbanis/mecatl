package mecabroker_test

import (
	"strings"
	"testing"
)

func TestManagedMCPValuesProjectOAuthProfileAndSecretReference(t *testing.T) {
	rendered := renderChart(t, "template", "managed", ".", "-f", "ci/managed-mcp-values.yaml")
	config := configMapFromRender(t, rendered).Data["broker.json"]
	for _, want := range []string{
		`"callback_url": "https://broker.example.invalid/oauth/complete"`,
		`"name": "github"`,
		`"authorization_endpoint": "https://github.example/login/oauth/authorize"`,
		`"request_refresh_token": true`,
		`"client_secret_file": "/var/run/mecabroker/mcp-oauth/0/client-secret"`,
	} {
		if !strings.Contains(config, want) {
			t.Fatalf("managed broker config missing %q:\n%s", want, config)
		}
	}
	if strings.Contains(config, "client-secret") && strings.Contains(config, "github-oauth") {
		t.Fatal("broker ConfigMap contains a Secret name or value")
	}
	deployment := deploymentFromRender(t, rendered)
	var found bool
	for _, volume := range deployment.Spec.Template.Spec.Volumes {
		if volume.Name == "mcp-oauth-client-secret-0" && volume.Secret != nil && volume.Secret.SecretName == "github-oauth" {
			found = true
		}
	}
	if !found {
		t.Fatalf("managed broker did not project the referenced OAuth Secret: %#v", deployment.Spec.Template.Spec.Volumes)
	}
}
