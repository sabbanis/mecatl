package app

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/k8slease"
)

const k8sLeaseGCSweepTimeout = 30 * time.Second

type k8sLeaseSweeper interface {
	Sweep(context.Context) (k8slease.SweepResult, error)
}

// startK8sLeaseGC owns the collectible Kubernetes Lease worker. A positive
// interval is an explicit request, so selecting any other lease backend fails
// instead of silently skipping cleanup.
func startK8sLeaseGC(parent context.Context, cfg Config, lease port.SessionLease) (func(), error) {
	if cfg.SessionLeaseK8sGCInterval <= 0 {
		return func() {}, nil
	}
	k8s, ok := lease.(*k8slease.Lease)
	if !ok {
		return nil, errors.New("kubernetes session Lease GC requires the Kubernetes Lease backend")
	}
	return startK8sLeaseGCWorker(parent, cfg, k8s.Collector(cfg.SessionLeaseK8sGCGrace)), nil
}

func startK8sLeaseGCWorker(parent context.Context, cfg Config, collector k8sLeaseSweeper) func() {
	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	go func() {
		defer close(done)
		sweep := func() {
			passCtx, passCancel := context.WithTimeout(ctx, k8sLeaseGCSweepTimeout)
			started := time.Now()
			result, err := collector.Sweep(passCtx)
			passCancel()
			if ctx.Err() != nil {
				return
			}
			if emit := cfg.SessionLeaseK8sGCMetricsEmitter; emit != nil {
				emit(result.Cardinality, result.Candidates, result.Deleted, result.Failures, err == nil)
			}
			if err != nil && ctx.Err() == nil {
				cfg.diag().Log(context.Background(), port.LevelWarn, "Kubernetes session Lease GC sweep failed",
					"failures", result.Failures, "duration", time.Since(started), "err", err)
				return
			}
			if result.Deleted > 0 {
				cfg.diag().Log(context.Background(), port.LevelInfo, "Kubernetes session Lease GC sweep completed",
					"objects", result.Cardinality, "deleted", result.Deleted, "duration", time.Since(started))
			}
		}

		sweep()
		ticker := time.NewTicker(cfg.SessionLeaseK8sGCInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				sweep()
			}
		}
	}()

	return sync.OnceFunc(func() {
		cancel()
		<-done
	})
}
