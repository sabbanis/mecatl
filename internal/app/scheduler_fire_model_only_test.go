package app

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

func TestSchedulerFireRejectsPersistedModelOnlyProfile(t *testing.T) {
	fire := makeFireFunc(nil, nil, time.Minute, nil)
	got, err := fire(context.Background(), port.Schedule{
		Spec: port.ScheduleSpec{
			Name:    "forbidden-model-only",
			Profile: string(server.ProfileModelOnly),
		},
	}, time.Unix(0, 0))
	if err == nil || !strings.Contains(err.Error(), "one-shot") {
		t.Fatalf("fire error = %v, want one-shot rejection", err)
	}
	if got.Stop != session.StopError {
		t.Fatalf("fire stop = %q, want %q", got.Stop, session.StopError)
	}
}
