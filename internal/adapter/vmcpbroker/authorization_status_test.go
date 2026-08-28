package vmcpbroker

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestCheckAuthorization_ExpiredStatusDoesNotDeleteRuntimeCorrelation(t *testing.T) {
	runtime, err := NewRuntime([]Route{{
		BackendID: "backend", Protected: true,
		Tool: tool.ToolSpec{Name: "mcp__backend__read", Schema: json.RawMessage(`{"type":"object"}`)},
	}}, func(context.Context, session.SessionID, Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	if _, err := runtime.OpenSession("session"); err != nil {
		t.Fatalf("OpenSession: %v", err)
	}

	target := controlTarget{sessionID: "session", backendID: "backend"}
	runtime.mu.Lock()
	runtime.transactions[target] = authorizationTransaction{handle: "handle", expiresAt: time.Unix(1, 0)}
	runtime.authorizations[target] = "handle"
	runtime.mu.Unlock()
	runtime.SetClock(func() time.Time { return time.Unix(2, 0) })

	status, err := runtime.CheckAuthorization(context.Background(), "session", "mcp__backend__read", "handle")
	if err != nil || status.Status != ConnectionPending {
		t.Fatalf("CheckAuthorization = %+v, %v; want retained pending correlation", status, err)
	}
	runtime.mu.RLock()
	_, transactionPresent := runtime.transactions[target]
	_, authorizationPresent := runtime.authorizations[target]
	runtime.mu.RUnlock()
	if !transactionPresent || !authorizationPresent {
		t.Fatal("status lookup destructively removed authorization correlation")
	}
}
