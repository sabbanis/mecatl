package app

import (
	"fmt"

	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/tool"
)

// rootAuthorityForCatalog snapshots the exact assembled catalog and static
// environment posture for a newly-created root. It intentionally accepts only
// composition-owned values; the server persists the resulting opaque canonical
// value without inspecting a catalog or runtime resource.
func rootAuthorityForCatalog(catalog *tool.Catalog, noFS bool) (string, error) {
	if catalog == nil {
		return "", fmt.Errorf("root authority: nil catalog")
	}
	names := make([]string, 0, len(catalog.Tools()))
	for _, candidate := range catalog.Tools() {
		names = append(names, candidate.Spec().Name)
	}
	authority, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools: names,
		Profile: governance.AuthorityProfile{
			FileSystem:  !noFS,
			DirectWrite: !noFS,
		},
	})
	if err != nil {
		return "", fmt.Errorf("root authority: %w", err)
	}
	canonical, err := authority.Canonical()
	if err != nil {
		return "", fmt.Errorf("root authority canonical: %w", err)
	}
	return canonical, nil
}
