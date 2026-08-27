package main

import "testing"

func TestSessionMCPAuthorization_Scenario1_MecatuiAuthorityDefault(t *testing.T) {
	cfg, err := parseFlags(nil)
	if err != nil {
		t.Fatal(err)
	}
	got := embeddedConfig(cfg, nil)
	if got.MCPAuthorityDefault != "global" || !got.MCPBrokerSupported {
		t.Fatalf("authority defaults = (%q, %t)", got.MCPAuthorityDefault, got.MCPBrokerSupported)
	}
}
