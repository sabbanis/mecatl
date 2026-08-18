package agentfs

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestADR_0226_AuthorityAttenuation_Scenario5_ManagedLocalDefinitionNarrowsChild(t *testing.T) {
	ceiling, err := governance.NewAuthority(governance.AuthoritySpec{Tools: []string{"Read"}})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := ceiling.Canonical()
	if err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	writeDef(t, dir, "reviewer.md", "---\nname: reviewer\ndescription: review\nauthority: '"+raw+"'\n---\nbody")
	defs, skips, err := (DirSource{Dir: dir, Tier: tool.AgentOriginExplicit}).Agents(context.Background())
	if err != nil {
		t.Fatalf("Agents: %v", err)
	}
	if len(skips) != 0 || len(defs) != 1 {
		t.Fatalf("Agents = %d defs, %d skips; want one definition without skips", len(defs), len(skips))
	}
	def := defs[0].Def
	declared := def.ManagedAuthorityCeiling()
	if declared == nil || *declared != raw {
		t.Fatalf("ManagedAuthorityCeiling() = %#v, want %q", declared, raw)
	}
	for _, origin := range []tool.AgentOrigin{tool.AgentOriginProject, tool.AgentOriginUser, tool.AgentOriginDriver} {
		unmanaged := def
		unmanaged.Origin = origin
		if ceiling := unmanaged.ManagedAuthorityCeiling(); ceiling != nil {
			t.Fatalf("%s definition established managed ceiling %q", origin, *ceiling)
		}
	}
	resolved, err := governance.ParseAuthority(*declared)
	if err != nil {
		t.Fatalf("ParseAuthority: %v", err)
	}
	child, err := governance.UnrestrictedAuthority().Intersect(resolved)
	if err != nil {
		t.Fatalf("intersect parent and definition ceiling: %v", err)
	}
	if !child.AllowsTool("Read") || child.AllowsTool("Write") {
		t.Fatal("child authority did not narrow to the managed definition ceiling")
	}

	bound, err := child.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	childSession := session.New("child", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(0, 0))
	if err := childSession.BindAuthority(bound, string(def.Origin)+":"+def.Name); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	snapshot, err := sessnap.Marshal(childSession)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if strings.Contains(string(snapshot), dir) {
		t.Fatalf("snapshot leaked local definition path %q", dir)
	}
	restored, err := sessnap.Unmarshal(snapshot)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	_, identity, legacy := restored.AuthorityBound()
	if identity != "explicit:reviewer" || legacy {
		t.Fatalf("AuthorityBound identity = %q, legacy=%t; want safe explicit:reviewer identity", identity, legacy)
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario5_DefinitionCeilingPresenceIsPreserved(t *testing.T) {
	valid, err := governance.NewAuthority(governance.AuthoritySpec{Tools: []string{"Read"}})
	if err != nil {
		t.Fatal(err)
	}
	validRaw, err := valid.Canonical()
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name string
		yaml string
		want *string
		err  bool
	}{
		{name: "absent", yaml: "", want: nil},
		{name: "present empty", yaml: "authority: \"\"", want: ptr(""), err: true},
		{name: "malformed", yaml: "authority: not-an-authority", want: ptr("not-an-authority"), err: true},
		{name: "valid", yaml: "authority: '" + validRaw + "'", want: ptr(validRaw)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			writeDef(t, dir, "reviewer.md", "---\nname: reviewer\ndescription: review\n"+tc.yaml+"\n---\nbody")
			defs, skips, err := (DirSource{Dir: dir, Tier: tool.AgentOriginExplicit}).Agents(context.Background())
			if err != nil {
				t.Fatalf("Agents: %v", err)
			}
			if len(skips) != 0 || len(defs) != 1 {
				t.Fatalf("Agents = %d defs, %d skips; want one definition without skips", len(defs), len(skips))
			}
			def := defs[0].Def
			if !sameOptionalString(def.AuthorityCeiling, tc.want) {
				t.Fatalf("AuthorityCeiling = %#v, want %#v", def.AuthorityCeiling, tc.want)
			}
			if tc.want != nil {
				_, err := governance.ParseAuthority(*def.AuthorityCeiling)
				if (err != nil) != tc.err {
					t.Fatalf("ParseAuthority error = %v, want error=%t", err, tc.err)
				}
			}
		})
	}
}

func ptr(s string) *string { return &s }

func sameOptionalString(got, want *string) bool {
	if got == nil || want == nil {
		return got == want
	}
	return *got == *want
}
