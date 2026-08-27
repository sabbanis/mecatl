package main

import (
	"testing"

	"github.com/stacklok/mecatl/engine/port"
)

func TestSessionMCPAuthorization_Scenario1_Mecak8sAuthorityDefault(t *testing.T) {
	cfg, err := parseFlags(nil)
	if err != nil {
		t.Fatal(err)
	}
	got := appConfig(cfg, port.NopDiagnostics{}, observability{})
	if got.MCPAuthorityDefault != "broker" || !got.MCPBrokerSupported {
		t.Fatalf("authority defaults = (%q, %t)", got.MCPAuthorityDefault, got.MCPBrokerSupported)
	}
}
