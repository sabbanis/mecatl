package session

// ProjectSourceBinding is the opaque source identity and safe display label a
// Project Session captured at creation. It contains no backend locator or live
// environment details.
type ProjectSourceBinding struct {
	SourceRef       string `json:"source_ref"`
	LabelAtCreation string `json:"label_at_creation"`
}

// ProjectBinding is the immutable Project association captured by a Project
// Session. It records creation-time metadata only; the aggregate never resolves
// sources, authorizes Project access, or interprets the binding.
type ProjectBinding struct {
	ProjectID             string                 `json:"project_id"`
	ProjectNameAtCreation string                 `json:"project_name_at_creation"`
	ProjectRevision       int                    `json:"project_revision"`
	Working               ProjectSourceBinding   `json:"working"`
	References            []ProjectSourceBinding `json:"references"`
}

// Clone returns an independent copy, preserving nil.
func (b *ProjectBinding) Clone() *ProjectBinding {
	if b == nil {
		return nil
	}
	clone := *b
	if b.References != nil {
		clone.References = append([]ProjectSourceBinding(nil), b.References...)
	}
	return &clone
}

// ProjectProvenance is the safe compact projection of a captured Project
// binding. It deliberately excludes source and environment identities.
type ProjectProvenance struct {
	ProjectID              string
	ProjectNameAtCreation  string
	WorkingLabelAtCreation string
}

// Provenance returns the compact, locator-free projection for inventory
// surfaces. A nil binding returns the zero value.
func (b *ProjectBinding) Provenance() ProjectProvenance {
	if b == nil {
		return ProjectProvenance{}
	}
	return ProjectProvenance{
		ProjectID:              b.ProjectID,
		ProjectNameAtCreation:  b.ProjectNameAtCreation,
		WorkingLabelAtCreation: b.Working.LabelAtCreation,
	}
}

// ProjectProvenance returns the compact, locator-free projection for inventory
// surfaces. An ordinary or legacy Session returns the zero value.
func (s *Session) ProjectProvenance() ProjectProvenance {
	return s.Project.Provenance()
}
