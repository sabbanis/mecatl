package server_test

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/session"
)

// TestWorkspaceEnrollmentCancelPublishesResolvedEvent covers Part A of
// WORKSPACE-ENROLLMENT-UX-AND-RACE.md: CancelWorkspaceEnrollment must publish
// an EvWorkspaceEnrollmentResolved{Status: Cancelled} live, mirroring
// EvMCPAuthorizationResolved, so an attached client can auto-resolve without
// polling. clearWorkspaceEnrollment (the code under test) is the SAME
// recordWorkspaceEnrollmentEvent chokepoint the ConnectionConnected branch in
// ConnectWorkspaceServices also uses, so this pins the shared plumbing even
// though driving a real ConnectionConnected transition needs the much
// heavier ToolHive OAuth-callback simulation already covered at the
// vmcpbroker package level (bundled_vertical_test.go).
func TestWorkspaceEnrollmentCancelPublishesResolvedEvent(t *testing.T) {
	runtime := bundledEnrollmentRuntime(t, []string{"github"})
	store := memstore.New()
	svc := bundledEnrollmentService(t, store, runtime)
	alice := &session.Principal{Issuer: "https://idp.example", Subject: "alice", GrantType: session.GrantTypeUser}
	ctx := session.WithPrincipal(context.Background(), alice)

	sess, err := svc.CreateSession(ctx, "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	presentation, err := svc.ConnectWorkspaceServices(ctx, sess.ID)
	if err != nil {
		t.Fatalf("ConnectWorkspaceServices: %v", err)
	}

	events, unsubscribe, err := svc.Subscribe(ctx, sess.ID)
	if err != nil {
		t.Fatalf("Subscribe: %v", err)
	}
	defer unsubscribe()

	if _, err := svc.CancelWorkspaceEnrollment(ctx, sess.ID, presentation.ID); err != nil {
		t.Fatalf("CancelWorkspaceEnrollment: %v", err)
	}

	select {
	case ev := <-events:
		if ev.Type != session.EvWorkspaceEnrollmentResolved {
			t.Fatalf("event type = %q, want %q", ev.Type, session.EvWorkspaceEnrollmentResolved)
		}
		if ev.WorkspaceEnrollment == nil {
			t.Fatal("event carries no WorkspaceEnrollment payload")
		}
		if ev.WorkspaceEnrollment.EnrollmentID != presentation.ID {
			t.Fatalf("payload EnrollmentID = %q, want %q", ev.WorkspaceEnrollment.EnrollmentID, presentation.ID)
		}
		if ev.WorkspaceEnrollment.Status != session.WorkspaceEnrollmentCancelled {
			t.Fatalf("payload Status = %q, want %q", ev.WorkspaceEnrollment.Status, session.WorkspaceEnrollmentCancelled)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the published EvWorkspaceEnrollmentResolved event")
	}
}
