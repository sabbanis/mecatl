package app

import (
	"context"
	"errors"
	"runtime"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/port"
)

func TestModelOnlyOneShotProfile_Scenario4_ResourceEnvelope(t *testing.T) {
	t.Run("provider request and response bytes", TestBoundedModelOnlyProviderRequestAndResponseBytes)
	t.Run("shared concurrency and queue gate", TestModelOnlyRunGateBoundsConcurrencyAndQueue)
}

func TestBoundedModelOnlyProviderRequestAndResponseBytes(t *testing.T) {
	t.Run("request", func(t *testing.T) {
		limits := DefaultModelOnlyResourceLimits()
		limits.MaxRequestBytes = 1
		provider := boundedModelOnlyProvider{
			inner:  mockllm.New(mockllm.TextTurn("unused")),
			limits: limits,
			gate:   newModelOnlyRunGate(limits),
		}
		if _, err := provider.Stream(context.Background(), port.LLMRequest{}); !errors.Is(err, errModelOnlyRequestBytes) {
			t.Fatalf("Stream error = %v, want request-byte limit", err)
		}
	})

	t.Run("response", func(t *testing.T) {
		limits := DefaultModelOnlyResourceLimits()
		limits.MaxResponseBytes = 1
		provider := boundedModelOnlyProvider{
			inner:  mockllm.New(mockllm.TextTurn("answer")),
			limits: limits,
			gate:   newModelOnlyRunGate(limits),
		}
		stream, err := provider.Stream(context.Background(), port.LLMRequest{})
		if err != nil {
			t.Fatalf("Stream: %v", err)
		}
		var got error
		for _, streamErr := range stream {
			if streamErr != nil {
				got = streamErr
				break
			}
		}
		if !errors.Is(got, errModelOnlyResponseBytes) {
			t.Fatalf("stream error = %v, want response-byte limit", got)
		}
	})
}

func TestModelOnlyRunGateBoundsConcurrencyAndQueue(t *testing.T) {
	limits := DefaultModelOnlyResourceLimits()
	limits.MaxConcurrentRuns = 1
	limits.MaxQueuedRuns = 1
	gate := newModelOnlyRunGate(limits)

	releaseActive, err := gate.acquire(context.Background())
	if err != nil {
		t.Fatalf("acquire active: %v", err)
	}
	waiterAcquired := make(chan func(), 1)
	go func() {
		release, acquireErr := gate.acquire(context.Background())
		if acquireErr == nil {
			waiterAcquired <- release
		}
	}()
	for i := 0; i < 1000 && len(gate.queued) != 1; i++ {
		runtime.Gosched()
	}
	if len(gate.queued) != 1 {
		t.Fatal("waiter did not enter the bounded queue")
	}
	if _, err := gate.acquire(context.Background()); !errors.Is(err, errModelOnlyQueueFull) {
		t.Fatalf("third acquire error = %v, want queue-full", err)
	}
	releaseActive()
	releaseWaiter := <-waiterAcquired
	releaseWaiter()
}
