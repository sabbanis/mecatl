package server_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

func TestBundledWorkspaceEnrollment_Scenario11_ClientControlsFailClosed(t *testing.T) {
	runtime := bundledEnrollmentRuntime(t, []string{"github", "slack"})
	store := memstore.New()
	svc := bundledEnrollmentService(t, store, runtime)
	alice := &session.Principal{Issuer: "https://idp.example", Subject: "alice", GrantType: session.GrantTypeUser}
	bob := &session.Principal{Issuer: alice.Issuer, Subject: "bob", GrantType: session.GrantTypeUser}
	aliceCtx := session.WithPrincipal(context.Background(), alice)
	sess, err := svc.CreateSession(aliceCtx, "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	pending, err := svc.ConnectWorkspaceServices(aliceCtx, sess.ID)
	if err != nil {
		t.Fatalf("ConnectWorkspaceServices: %v", err)
	}

	if _, err := svc.CancelWorkspaceEnrollment(session.WithPrincipal(context.Background(), bob), sess.ID, pending.ID); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign-owner cancel = %v, want ErrNotFound", err)
	}
	if _, err := svc.RetryWorkspaceEnrollment(aliceCtx, sess.ID, "stale-id"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("stale retry = %v, want ErrFailedPrecondition", err)
	}
	if _, err := svc.CancelWorkspaceEnrollment(aliceCtx, sess.ID, pending.ID+":github"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("individually-targeted cancel = %v, want ErrFailedPrecondition", err)
	}
	cancelled, err := svc.CancelWorkspaceEnrollment(aliceCtx, sess.ID, pending.ID)
	if err != nil || cancelled.Status != "cancelled" {
		t.Fatalf("bundle cancel = %+v, %v", cancelled, err)
	}
	if _, err := svc.CancelWorkspaceEnrollment(aliceCtx, sess.ID, pending.ID); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("duplicate cancel = %v, want ErrFailedPrecondition", err)
	}
	if runtime.ProtectedCatalogueReady(sess.ID) {
		t.Fatal("cancelled control admitted a protected catalogue")
	}
	second, err := svc.ConnectWorkspaceServices(aliceCtx, sess.ID)
	if err != nil {
		t.Fatalf("ConnectWorkspaceServices after cancel: %v", err)
	}
	retried, err := svc.RetryWorkspaceEnrollment(aliceCtx, sess.ID, second.ID)
	if err != nil || retried.ID == "" || retried.ID == second.ID || retried.Status != "pending" {
		t.Fatalf("whole-bundle retry = %+v, %v; prior=%q", retried, err, second.ID)
	}
	if runtime.ProtectedCatalogueReady(sess.ID) {
		t.Fatal("retried pending bundle admitted a protected catalogue")
	}
}
