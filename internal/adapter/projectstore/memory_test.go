package projectstore_test

import (
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/project"
	"github.com/stacklok/mecatl/internal/project/projectconformance"
)

func TestMemoryStoreConformance(t *testing.T) {
	projectconformance.Run(t, func(*testing.T) project.Store {
		return projectstore.NewMemory()
	})
}
