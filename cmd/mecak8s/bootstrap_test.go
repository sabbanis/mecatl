package main

import (
	"context"
	"math"
	"strconv"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/stacklok/mecatl/internal/adapter/k8slease"
)

func TestBootstrapLeaseFencingSequenceFlag(t *testing.T) {
	cfg, err := parseFlags([]string{
		"--bootstrap-lease-fencing-sequence",
		"--session-lease-k8s-namespace", "lease-system",
	})
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}
	if !cfg.bootstrapLeaseFencingSequence {
		t.Fatal("bootstrapLeaseFencingSequence = false, want true")
	}
	if cfg.sessionLeaseK8sNamespace != "lease-system" {
		t.Fatalf("sessionLeaseK8sNamespace = %q, want lease-system", cfg.sessionLeaseK8sNamespace)
	}
	if _, err := parseFlags([]string{
		"--bootstrap-lease-fencing-sequence",
		"--session-lease-k8s-namespace=",
	}); err == nil {
		t.Fatal("bootstrap mode accepted an empty namespace")
	}
}

func TestBootstrapLeaseFencingSequenceUsesAdapterBootstrap(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset()

	if err := bootstrapLeaseFencingSequence(ctx, cs, "lease-system"); err != nil {
		t.Fatalf("bootstrapLeaseFencingSequence: %v", err)
	}
	cm, err := cs.CoreV1().ConfigMaps("lease-system").Get(ctx, k8slease.DefaultSequencerName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get bootstrapped sequence: %v", err)
	}
	want := strconv.FormatUint(uint64(math.MaxInt32), 10)
	if got := cm.Data["last-token"]; got != want {
		t.Fatalf("bootstrapped sequence = %q, want %q", got, want)
	}
}
