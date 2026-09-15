package app

import (
	"context"
	"testing"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

func TestBuildSessionLeasePassesK8sDomainToAdapter(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	clientFactory := func() (kubernetes.Interface, error) { return clientset, nil }

	build := func(domain string) (port.SessionLease, string) {
		t.Helper()
		lease, owner, closeLease, err := buildSessionLease(Config{
			SessionLeaseK8sNamespace: "shared",
			SessionLeaseK8sDomain:    domain,
			SessionLeaseTTL:          30 * time.Second,
		}, nil, clientFactory)
		if err != nil {
			t.Fatalf("buildSessionLease(%q): %v", domain, err)
		}
		t.Cleanup(closeLease)
		return lease, owner
	}

	leaseA, ownerA := build("release-a")
	leaseB, ownerB := build("release-b")
	for _, id := range []session.SessionID{"same-session", port.SchedulerLeaderLeaseID} {
		if _, err := leaseA.Acquire(context.Background(), id, ownerA); err != nil {
			t.Fatalf("domain A Acquire(%q): %v", id, err)
		}
		if _, err := leaseB.Acquire(context.Background(), id, ownerB); err != nil {
			t.Fatalf("domain B Acquire(%q): %v", id, err)
		}
	}
}
