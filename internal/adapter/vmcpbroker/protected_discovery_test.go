package vmcpbroker

import (
	"errors"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

func TestDiscoverAnonymousRoutesRejectsProtectedProfiles(t *testing.T) {
	profile := protectedConstructionProfile("protected")

	_, err := discoverAnonymousRoutes(t.Context(), []permconfig.MCPServerProfile{profile}, nil)
	if !errors.Is(err, ErrInvalidRoute) {
		t.Fatalf("discoverAnonymousRoutes protected error = %v, want ErrInvalidRoute", err)
	}
}
