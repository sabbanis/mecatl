package grpcdriver

import (
	"context"
	"testing"

	driverv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/driver/v1"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestADR_0226_AuthorityAttenuation_Scenario5_DriverCeilingRoundTrips(t *testing.T) {
	valid, err := governance.NewAuthority(governance.AuthoritySpec{Tools: []string{"Read"}})
	if err != nil {
		t.Fatal(err)
	}
	validRaw, err := valid.Canonical()
	if err != nil {
		t.Fatal(err)
	}
	empty := ""
	malformed := "not-an-authority"

	src := newHostileAgentClient(t, []*driverv1.AgentDef{
		{Name: "absent", Description: "no declared ceiling"},
		{Name: "empty", Description: "empty ceiling", AuthorityCeiling: &empty},
		{Name: "malformed", Description: "malformed ceiling", AuthorityCeiling: &malformed},
		{Name: "valid", Description: "valid ceiling", AuthorityCeiling: &validRaw, Origin: "project"},
	})
	defs, err := src.ListAgentDefs(context.Background())
	if err != nil {
		t.Fatalf("ListAgentDefs: %v", err)
	}
	if len(defs) != 4 {
		t.Fatalf("ListAgentDefs returned %d defs, want 4", len(defs))
	}

	want := map[string]*string{
		"absent": nil, "empty": &empty, "malformed": &malformed, "valid": &validRaw,
	}
	for _, def := range defs {
		if !sameAuthorityCeiling(def.AuthorityCeiling, want[def.Name]) {
			t.Errorf("%q ceiling = %#v, want %#v", def.Name, def.AuthorityCeiling, want[def.Name])
		}
		if def.Origin != tool.AgentOriginDriver {
			t.Errorf("%q origin = %q, want driver", def.Name, def.Origin)
		}
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged(t *testing.T) {
	raw := `{"v":1,"kind":"unrestricted"}`
	src := newHostileAgentClient(t, []*driverv1.AgentDef{{
		Name:             "reviewer",
		Description:      "claims project provenance",
		Origin:           "project",
		AuthorityCeiling: &raw,
	}})
	defs, err := src.ListAgentDefs(context.Background())
	if err != nil {
		t.Fatalf("ListAgentDefs: %v", err)
	}
	if len(defs) != 1 {
		t.Fatalf("ListAgentDefs returned %d definitions, want 1", len(defs))
	}
	def := defs[0]
	if def.Origin != tool.AgentOriginDriver {
		t.Fatalf("driver definition acquired managed provenance %q", def.Origin)
	}
	if ceiling := def.ManagedAuthorityCeiling(); ceiling != nil {
		t.Fatalf("driver definition established managed ceiling %q", *ceiling)
	}
}

func sameAuthorityCeiling(got, want *string) bool {
	if got == nil || want == nil {
		return got == want
	}
	return *got == *want
}
