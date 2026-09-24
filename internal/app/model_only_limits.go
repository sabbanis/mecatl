package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"time"

	"github.com/stacklok/mecatl/engine/port"
)

var (
	errModelOnlyRequestBytes  = errors.New("model-only request byte limit exceeded")
	errModelOnlyResponseBytes = errors.New("model-only response byte limit exceeded")
	errModelOnlyQueueFull     = errors.New("model-only run queue is full")
)

// ModelOnlyResourceLimits is the complete positive resource envelope required
// by the model-only session profile. Request and response bytes are measured on
// the provider-neutral JSON values at the final model boundary.
type ModelOnlyResourceLimits struct {
	MaxRequestBytes       int
	MaxResponseBytes      int
	MaxEvents             int
	MaxEventBytes         int
	MaxBufferedEventBytes int
	MaxSessionBytes       int
	MaxQueuedRuns         int
	MaxConcurrentRuns     int
	MaxDuration           time.Duration
}

// DefaultModelOnlyResourceLimits returns the daemon's bounded model-only
// envelope. Operators configure every field with the corresponding flags.
func DefaultModelOnlyResourceLimits() ModelOnlyResourceLimits {
	return ModelOnlyResourceLimits{
		MaxRequestBytes:       1 << 20,
		MaxResponseBytes:      4 << 20,
		MaxEvents:             4096,
		MaxEventBytes:         5 << 20,
		MaxBufferedEventBytes: 10 << 20,
		MaxSessionBytes:       8 << 20,
		MaxQueuedRuns:         32,
		MaxConcurrentRuns:     8,
		MaxDuration:           5 * time.Minute,
	}
}

func (l ModelOnlyResourceLimits) validate() error {
	values := []struct {
		name  string
		value int
	}{
		{"max-request-bytes", l.MaxRequestBytes},
		{"max-response-bytes", l.MaxResponseBytes},
		{"max-events", l.MaxEvents},
		{"max-event-bytes", l.MaxEventBytes},
		{"max-buffered-event-bytes", l.MaxBufferedEventBytes},
		{"max-session-bytes", l.MaxSessionBytes},
		{"max-queued-runs", l.MaxQueuedRuns},
		{"max-concurrent-runs", l.MaxConcurrentRuns},
	}
	for _, item := range values {
		if item.value <= 0 {
			return fmt.Errorf("%s must be positive", item.name)
		}
	}
	if l.MaxDuration <= 0 {
		return errors.New("max-duration must be positive")
	}
	if l.MaxEvents < 5 {
		return errors.New("max-events must be at least 5 to reserve the model-only lifecycle and terminal result")
	}
	if l.MaxEventBytes < 4096 {
		return errors.New("max-event-bytes must be at least 4096 so a terminal result always fits")
	}
	if l.MaxBufferedEventBytes < l.MaxEventBytes {
		return errors.New("max-buffered-event-bytes must be at least max-event-bytes")
	}
	if l.MaxEventBytes < l.MaxRequestBytes+4096 || l.MaxEventBytes < l.MaxResponseBytes+4096 {
		return errors.New("max-event-bytes must exceed both request and response byte limits by at least 4096 bytes")
	}
	return nil
}

type modelOnlyRunGate struct {
	active chan struct{}
	queued chan struct{}
}

func newModelOnlyRunGate(limits ModelOnlyResourceLimits) *modelOnlyRunGate {
	if limits.MaxConcurrentRuns <= 0 || limits.MaxQueuedRuns <= 0 {
		return nil
	}
	return &modelOnlyRunGate{
		active: make(chan struct{}, limits.MaxConcurrentRuns),
		queued: make(chan struct{}, limits.MaxQueuedRuns),
	}
}

func (g *modelOnlyRunGate) acquire(ctx context.Context) (func(), error) {
	select {
	case g.active <- struct{}{}:
		return func() { <-g.active }, nil
	default:
	}
	select {
	case g.queued <- struct{}{}:
		defer func() { <-g.queued }()
	default:
		return nil, errModelOnlyQueueFull
	}
	select {
	case g.active <- struct{}{}:
		return func() { <-g.active }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

type boundedModelOnlyProvider struct {
	inner  port.LLMProvider
	limits ModelOnlyResourceLimits
	gate   *modelOnlyRunGate
}

func (p boundedModelOnlyProvider) Capabilities() port.ProviderCapabilities {
	return p.inner.Capabilities()
}

func (p boundedModelOnlyProvider) Stream(ctx context.Context, req port.LLMRequest) (iter.Seq2[port.Chunk, error], error) {
	encoded, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("model-only: encode request: %w", err)
	}
	if len(encoded) > p.limits.MaxRequestBytes {
		return nil, fmt.Errorf("%w: got %d, maximum %d", errModelOnlyRequestBytes, len(encoded), p.limits.MaxRequestBytes)
	}
	release, err := p.gate.acquire(ctx)
	if err != nil {
		return nil, err
	}
	stream, err := p.inner.Stream(ctx, req)
	if err != nil {
		release()
		return nil, err
	}
	return func(yield func(port.Chunk, error) bool) {
		defer release()
		responseBytes := 0
		for chunk, streamErr := range stream {
			if streamErr != nil {
				yield(port.Chunk{}, streamErr)
				return
			}
			chunkBytes, marshalErr := json.Marshal(chunk)
			if marshalErr != nil {
				yield(port.Chunk{}, fmt.Errorf("model-only: encode response chunk: %w", marshalErr))
				return
			}
			responseBytes += len(chunkBytes)
			if responseBytes > p.limits.MaxResponseBytes {
				yield(port.Chunk{}, fmt.Errorf("%w: got %d, maximum %d", errModelOnlyResponseBytes, responseBytes, p.limits.MaxResponseBytes))
				return
			}
			if !yield(chunk, nil) {
				return
			}
		}
	}, nil
}
