package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/stacklok/mecatl/engine/session"
)

var (
	// ErrRunEventCountLimit reports that a run exhausted its published-event budget.
	ErrRunEventCountLimit = errors.New("agent: run event count limit exceeded")
	// ErrRunEventBytesLimit reports that one encoded event exceeded its byte budget.
	ErrRunEventBytesLimit = errors.New("agent: run event byte limit exceeded")
	// ErrSessionBytesLimit reports that recording another conversation message would
	// exceed the configured per-session byte budget.
	ErrSessionBytesLimit = errors.New("agent: session byte limit exceeded")
	// ErrRunDurationLimit is the cause installed by the engine-owned run deadline.
	ErrRunDurationLimit = errors.New("agent: run duration limit exceeded")
	// ErrRunScopedToolsDisabled reports an attempt to add a host-owned tool to an
	// engine profile that forbids every tool surface.
	ErrRunScopedToolsDisabled = errors.New("agent: run-scoped tools are disabled")
)

// runResourceLimits serializes event admission across the run's ordinary loop
// and its out-of-band child emitters. One event slot is always reserved for the
// terminal result, so a limit crossing is observable instead of closing the
// stream silently.
type runResourceLimits struct {
	mu            sync.Mutex
	maxEvents     int
	maxEventBytes int
	events        int
	cause         error
}

func newRunResourceLimits(maxEvents, maxEventBytes int) *runResourceLimits {
	if maxEvents <= 0 && maxEventBytes <= 0 {
		return nil
	}
	return &runResourceLimits{maxEvents: maxEvents, maxEventBytes: maxEventBytes}
}

func eventBufferCapacity(maxEventBytes, maxBufferedEventBytes int) int {
	const defaultCapacity = 64
	if maxEventBytes <= 0 || maxBufferedEventBytes <= 0 {
		return defaultCapacity
	}
	capacity := maxBufferedEventBytes / maxEventBytes
	if capacity < 1 {
		return 1
	}
	if capacity > defaultCapacity {
		return defaultCapacity
	}
	return capacity
}

func (r *Run) sequenceAndAdmit(ev session.Event) (session.Event, bool) {
	ev.Seq = r.seq.Add(1)
	// The run labels its own events with run-scoped identity. Seq answers "where
	// in this run", RunID answers "which run". Stamping before measurement makes
	// the byte ceiling cover the exact domain event handed to relays and sinks.
	ev.RunID = r.runID
	if r.resource == nil {
		return ev, true
	}

	encoded, err := json.Marshal(ev)
	if err != nil {
		r.failResourceLimit(fmt.Errorf("%w: encode event: %v", ErrRunEventBytesLimit, err))
		return ev, false
	}

	r.resource.mu.Lock()
	terminal := ev.Type == session.EvResult
	if r.resource.cause != nil && !terminal {
		r.resource.mu.Unlock()
		return ev, false
	}
	var cause error
	if r.resource.maxEventBytes > 0 && len(encoded) > r.resource.maxEventBytes {
		cause = fmt.Errorf("%w: got %d, maximum %d", ErrRunEventBytesLimit, len(encoded), r.resource.maxEventBytes)
	} else if r.resource.maxEvents > 0 {
		limit := r.resource.maxEvents
		if !terminal {
			limit-- // reserve the final slot for EvResult
		}
		if r.resource.events >= limit {
			cause = fmt.Errorf("%w: maximum %d", ErrRunEventCountLimit, r.resource.maxEvents)
		}
	}
	if cause == nil {
		r.resource.events++
		r.resource.mu.Unlock()
		return ev, true
	}
	if r.resource.cause == nil {
		r.resource.cause = cause
	}
	r.resource.mu.Unlock()
	r.cancelForResourceLimit()
	return ev, false
}

func (r *Run) failResourceLimit(cause error) {
	if r.resource == nil || cause == nil {
		return
	}
	r.resource.mu.Lock()
	if r.resource.cause == nil {
		r.resource.cause = cause
	}
	r.resource.mu.Unlock()
	r.cancelForResourceLimit()
}

func (r *Run) cancelForResourceLimit() {
	// Resource exhaustion is engine-owned cancellation. Arm the same bounded
	// unwedge used by caller cancellation without taking closureMu: event
	// admission can run while emitAuthorizationRequired holds that mutex.
	r.armHardAbort()
	if r.cancel != nil {
		r.cancel()
	}
}

func (r *Run) resourceLimitCause() error {
	if r.resource == nil {
		return nil
	}
	r.resource.mu.Lock()
	defer r.resource.mu.Unlock()
	return r.resource.cause
}

func runResourceCause(ctx context.Context, r *Run) error {
	if cause := r.resourceLimitCause(); cause != nil {
		return cause
	}
	if errors.Is(context.Cause(ctx), ErrRunDurationLimit) {
		return ErrRunDurationLimit
	}
	return nil
}

func (e *Engine) checkSessionMessageBytes(sess *session.Session, next session.Message) error {
	if e.deps.MaxSessionBytes <= 0 {
		return nil
	}
	messages := make([]session.Message, 0, len(sess.Conversation.Messages)+1)
	messages = append(messages, sess.Conversation.Messages...)
	messages = append(messages, next)
	encoded, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("%w: encode conversation: %v", ErrSessionBytesLimit, err)
	}
	if len(encoded) > e.deps.MaxSessionBytes {
		return fmt.Errorf("%w: got %d, maximum %d", ErrSessionBytesLimit, len(encoded), e.deps.MaxSessionBytes)
	}
	return nil
}
