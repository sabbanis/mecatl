package server

import (
	"errors"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/port"
)

func TestModelOnlyProfileCannotBeScheduled(t *testing.T) {
	mgr := &scheduleManager{}
	err := mgr.validateScheduleProfile(port.ScheduleSpec{Profile: string(ProfileModelOnly)})
	if !errors.Is(err, ErrInvalidArgument) || !strings.Contains(err.Error(), "one-shot") {
		t.Fatalf("validate model-only schedule = %v, want one-shot InvalidArgument", err)
	}
}
