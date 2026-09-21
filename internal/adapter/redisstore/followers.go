package redisstore

import (
	"context"
	"errors"
	"sync"
)

// followerRegistry bounds process-local event followers and cancels them before
// the dedicated Redis pool is closed.
type followerRegistry struct {
	mu      sync.Mutex
	limit   int
	closed  bool
	nextID  uint64
	active  map[uint64]context.CancelFunc
	allDone chan struct{}
	once    sync.Once
}

func newFollowerRegistry(limit int) *followerRegistry {
	return &followerRegistry{limit: limit, active: make(map[uint64]context.CancelFunc), allDone: make(chan struct{})}
}

func (r *followerRegistry) admit(parent context.Context) (context.Context, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil, nil, errStoreClosed
	}
	if len(r.active) >= r.limit {
		return nil, nil, errors.New("redisstore: event follow capacity exhausted")
	}
	ctx, cancel := context.WithCancel(parent)
	id := r.nextID
	r.nextID++
	r.active[id] = cancel
	var once sync.Once
	return ctx, func() {
		once.Do(func() {
			cancel()
			r.mu.Lock()
			defer r.mu.Unlock()
			delete(r.active, id)
			if r.closed && len(r.active) == 0 {
				r.once.Do(func() { close(r.allDone) })
			}
		})
	}, nil
}

func (r *followerRegistry) close() <-chan struct{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closed = true
	for _, cancel := range r.active {
		cancel()
	}
	if len(r.active) == 0 {
		r.once.Do(func() { close(r.allDone) })
	}
	return r.allDone
}
