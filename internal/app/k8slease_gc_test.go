package app

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/k8slease"
)

type scriptedK8sLeaseSweeper struct {
	mu      sync.Mutex
	calls   int
	results []k8slease.SweepResult
	errors  []error
	called  chan struct{}
	block   bool
}

func (s *scriptedK8sLeaseSweeper) Sweep(ctx context.Context) (k8slease.SweepResult, error) {
	s.mu.Lock()
	index := s.calls
	s.calls++
	var result k8slease.SweepResult
	var err error
	if index < len(s.results) {
		result = s.results[index]
	}
	if index < len(s.errors) {
		err = s.errors[index]
	}
	block := s.block
	s.mu.Unlock()
	select {
	case s.called <- struct{}{}:
	default:
	}
	if block {
		<-ctx.Done()
		return result, ctx.Err()
	}
	return result, err
}

func TestK8sLeaseGCWorkerRepeatsSweepAndEmitsAggregates(t *testing.T) {
	sweeper := &scriptedK8sLeaseSweeper{
		results: []k8slease.SweepResult{
			{Cardinality: 9, Candidates: 3, Deleted: 2, Failures: 1},
			{Cardinality: 7, Candidates: 1, Deleted: 1},
		},
		errors: []error{errors.New("partial list"), nil},
		called: make(chan struct{}, 4),
	}
	type observation struct {
		objects, backlog, deleted, failures int64
		success                             bool
	}
	observed := make(chan observation, 4)
	cfg := Config{
		Diagnostics:               port.NopDiagnostics{},
		SessionLeaseK8sGCInterval: time.Millisecond,
		SessionLeaseK8sGCMetricsEmitter: func(objects, backlog, deleted, failures int64, success bool) {
			observed <- observation{objects, backlog, deleted, failures, success}
		},
	}
	closeWorker := startK8sLeaseGCWorker(context.Background(), cfg, sweeper)
	defer closeWorker()

	var got []observation
	for len(got) < 2 {
		select {
		case item := <-observed:
			got = append(got, item)
		case <-time.After(time.Second):
			t.Fatal("timed out waiting for two Lease GC sweeps")
		}
	}
	closeWorker()

	sweeper.mu.Lock()
	calls := sweeper.calls
	sweeper.mu.Unlock()
	if calls < 2 {
		t.Fatalf("sweep calls = %d, want at least two", calls)
	}
	if got[0].success || got[0].failures != 1 || got[0].deleted != 2 {
		t.Errorf("first observation = %+v, want partial failure aggregates", got[0])
	}
	if !got[1].success || got[1].objects != 7 || got[1].backlog != 1 || got[1].deleted != 1 {
		t.Errorf("second observation = %+v, want successful complete aggregates", got[1])
	}
}

func TestK8sLeaseGCWorkerCloseCancelsAndJoinsActiveSweep(t *testing.T) {
	sweeper := &scriptedK8sLeaseSweeper{called: make(chan struct{}, 1), block: true}
	emitted := make(chan struct{}, 1)
	closeWorker := startK8sLeaseGCWorker(context.Background(), Config{
		Diagnostics:               port.NopDiagnostics{},
		SessionLeaseK8sGCInterval: time.Hour,
		SessionLeaseK8sGCMetricsEmitter: func(_, _, _, _ int64, _ bool) {
			emitted <- struct{}{}
		},
	}, sweeper)
	select {
	case <-sweeper.called:
	case <-time.After(time.Second):
		t.Fatal("startup sweep did not begin")
	}

	done := make(chan struct{})
	go func() {
		closeWorker()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker close did not cancel and join the active sweep")
	}
	select {
	case <-emitted:
		t.Fatal("shutdown cancellation was reported as a collector failure")
	default:
	}
}
