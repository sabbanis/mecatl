package project

import (
	"strings"
	"testing"
	"time"
)

func TestProjectValidate_RejectsInvalidServerOwnedValues(t *testing.T) {
	valid := Project{
		ID:        "project-1",
		Name:      "Working project",
		Working:   WorkingSource{Ref: SourceRef("source-1"), Label: "Canonical root"},
		Revision:  1,
		CreatedAt: time.Unix(1_700_000_000, 0).UTC(),
		UpdatedAt: time.Unix(1_700_000_000, 0).UTC(),
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid project rejected: %v", err)
	}

	for name, mutate := range map[string]func(*Project){
		"empty id":        func(p *Project) { p.ID = "" },
		"empty name":      func(p *Project) { p.Name = "" },
		"control name":    func(p *Project) { p.Name = "bad\nname" },
		"long name":       func(p *Project) { p.Name = strings.Repeat("a", MaxNameRunes+1) },
		"empty source":    func(p *Project) { p.Working.Ref = "" },
		"empty label":     func(p *Project) { p.Working.Label = "" },
		"zero revision":   func(p *Project) { p.Revision = 0 },
		"zero created at": func(p *Project) { p.CreatedAt = time.Time{} },
		"zero updated at": func(p *Project) { p.UpdatedAt = time.Time{} },
	} {
		t.Run(name, func(t *testing.T) {
			candidate := valid
			mutate(&candidate)
			if err := candidate.Validate(); err == nil {
				t.Fatal("Validate accepted an invalid project")
			}
		})
	}
}
