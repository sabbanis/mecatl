package main

import "testing"

func TestSessionMCPAuthorization_Scenario1_MecatequiAuthorityDefault(t *testing.T) {
	flags, err := parseFlags([]string{"--prompt", "x"})
	if err != nil {
		t.Fatal(err)
	}
	got := appConfig(flags, newDiagnostics(), observability{})
	if got.MCPAuthorityDefault != "global" || got.MCPBrokerSupported {
		t.Fatalf("authority defaults = (%q, %t)", got.MCPAuthorityDefault, got.MCPBrokerSupported)
	}
}
