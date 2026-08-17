package server_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

func TestADR_0224_AuthorityAttenuation_Scenario6_PeerForkAuthorizesBeforeCopyingSourceMaximum(t *testing.T) {
	t.Parallel()

	svc, store := newAuthorityForkService(t, false)
	bound, err := governance.NewAuthority(governance.AuthoritySpec{
		Tools: []string{"Read"}, Profile: governance.AuthorityProfile{FileSystem: true, Isolated: true},
	})
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	canonical, err := bound.Canonical()
	if err != nil {
		t.Fatalf("Canonical: %v", err)
	}
	src := session.New("source", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))
	if err := src.BindAuthority(canonical, "operator:reviewer"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	src.EnvironmentRef = session.EnvironmentRef{Kind: session.EnvKindMem, ID: "/ws"}
	if err := store.Save(context.Background(), src); err != nil {
		t.Fatalf("Save source: %v", err)
	}

	forkID, err := svc.ForkSession(context.Background(), src.ID, "", "")
	if err != nil {
		t.Fatalf("ForkSession: %v", err)
	}
	forked, err := store.Load(context.Background(), forkID)
	if err != nil {
		t.Fatalf("Load fork: %v", err)
	}
	gotBound, gotIdentity, legacy := forked.AuthorityBound()
	if gotBound != canonical || gotIdentity != "operator:reviewer" || legacy {
		t.Fatalf("fork authority = (%q, %q, %t)", gotBound, gotIdentity, legacy)
	}
	if forked.EnvironmentRef != src.EnvironmentRef {
		t.Fatalf("fork environment ref = %+v, want %+v", forked.EnvironmentRef, src.EnvironmentRef)
	}
}

func TestADR_0224_AuthorityAttenuation_Scenario7_OwnershipPrecedesAuthorityParsing(t *testing.T) {
	t.Parallel()

	svc, store := newAuthorityForkService(t, true)
	owner := &session.Principal{Issuer: "issuer", Subject: "owner"}
	src := session.New("foreign", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))
	if err := src.RestoreLabels(owner, ""); err != nil {
		t.Fatalf("RestoreLabels: %v", err)
	}
	if err := store.Save(context.Background(), src); err != nil {
		t.Fatalf("Save source: %v", err)
	}
	foreign := session.WithPrincipal(context.Background(), &session.Principal{Issuer: "issuer", Subject: "foreign"})
	if _, err := svc.ForkSession(foreign, src.ID, "", ""); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("ForkSession foreign error = %v, want ErrNotFound", err)
	}
}

func newAuthorityForkService(t *testing.T, ownershipEnforced bool) (*server.Service, *memstore.Store) {
	t.Helper()
	store := memstore.New()
	eng := agent.NewEngine(agent.Deps{
		LLM:     mockllm.New(mockllm.TextTurn("unused")),
		Catalog: tool.NewCatalog(),
		Policy:  permpolicy.NewPolicy(nil, nil),
		Model:   "test-model",
	})
	svc, err := server.NewService(server.Config{
		Engine:            eng,
		Store:             store,
		Workspaces:        func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		Now:               func() time.Time { return time.Unix(0, 0) },
		OwnershipEnforced: ownershipEnforced,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc, store
}
