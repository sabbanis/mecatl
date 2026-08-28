package server

import (
	"sync"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
)

type mcpAuthorizationManualTimer struct{ stopped bool }

func (t *mcpAuthorizationManualTimer) Stop() bool {
	t.stopped = true
	return true
}

func TestSessionMCPAuthorization_Scenario7_ExpiryTimerOwnershipAndCleanup(t *testing.T) {
	const id session.SessionID = "timer-owner"
	svc, _, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })

	var mu sync.Mutex
	var callbacks []func()
	var timers []*mcpAuthorizationManualTimer
	svc.cfg.MCPAuthorizationTimer = func(_ time.Duration, callback func()) MCPAuthorizationTimer {
		mu.Lock()
		defer mu.Unlock()
		timer := &mcpAuthorizationManualTimer{}
		timers = append(timers, timer)
		callbacks = append(callbacks, callback)
		return timer
	}

	svc.scheduleMCPAuthorizationExpiry(id)
	svc.scheduleMCPAuthorizationExpiry(id)
	mu.Lock()
	if len(callbacks) != 2 || !timers[0].stopped {
		mu.Unlock()
		t.Fatalf("timers = %d, first stopped = %t; want replacement ownership", len(callbacks), len(timers) > 0 && timers[0].stopped)
	}
	first, second := callbacks[0], callbacks[1]
	mu.Unlock()

	first()
	svc.mu.Lock()
	if len(svc.authorizationExpiry) != 1 {
		svc.mu.Unlock()
		t.Fatal("stale timer removed current owner entry")
	}
	svc.mu.Unlock()

	second()
	svc.mu.Lock()
	defer svc.mu.Unlock()
	if len(svc.authorizationExpiry) != 0 {
		t.Fatalf("timer entry retained after callback: %d", len(svc.authorizationExpiry))
	}
	if _, ok := svc.authorizationExpiry[id]; ok {
		t.Fatal("timer key retained after callback")
	}

}
