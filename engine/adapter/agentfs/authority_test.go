package agentfs

import (
	"context"
	"testing"
)

func TestAgentAuthorityCeilingPreservesOmissionAndExplicitMalformedValue(t *testing.T) {
	dir := t.TempDir()
	writeDef(t, dir, "omitted.md", "---\nname: omitted\ndescription: inherits\n---\nbody")
	writeDef(t, dir, "malformed.md", "---\nname: malformed\ndescription: denies\nauthority: \"\"\n---\nbody")

	src, skips, err := NewFSSource(context.Background(), DirSource{Dir: dir, Label: "explicit"})
	if err != nil || len(skips) != 0 {
		t.Fatalf("NewFSSource: err=%v skips=%v", err, skips)
	}
	defs, err := src.ListAgentDefs(context.Background())
	if err != nil {
		t.Fatalf("ListAgentDefs: %v", err)
	}
	if len(defs) != 2 {
		t.Fatalf("ListAgentDefs returned %d defs, want 2", len(defs))
	}
	if defs[1].AuthorityCeiling != nil {
		t.Fatalf("omitted ceiling = %q, want nil", *defs[1].AuthorityCeiling)
	}
	if defs[0].AuthorityCeiling == nil || string(*defs[0].AuthorityCeiling) != "" {
		t.Fatalf("explicit malformed ceiling = %v, want present empty value", defs[0].AuthorityCeiling)
	}
}
