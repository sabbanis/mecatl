package server_test

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/session"
)

func TestSessionMCPAuthorization_Scenario3_PersistsBrokerEnrollment(t *testing.T) {
	store := memstore.New()
	runtime := scenario3Runtime(t)
	defer func() { _ = runtime.Close() }()

	svc := scenario3Service(t, store, runtime, nil)
	defer svc.Close()
	sess, err := svc.CreateSession(context.Background(), "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	persisted, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !persisted.BrokerEnrolled {
		t.Fatal("persisted BrokerEnrolled = false, want true")
	}
	if got, want := persisted.BrokerToolNames, []string{"mcp__calendar__list"}; len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("persisted BrokerToolNames = %v, want %v", got, want)
	}
}
