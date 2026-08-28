package server_test

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// TestMCPAuthorizationParkedRelayLifecycle exercises the real HTTP SSE relay:
// a park is sent as its own event, closes without fabricating result, removes
// the live run, and preserves the authorizing aggregate state.
func TestMCPAuthorizationParkedRelayLifecycle(t *testing.T) {
	protected := &parkedAuthorizationTool{scriptTool: scriptTool{name: "mcp__configured__read", readOnly: true, content: "must not execute"}}
	llm := mockllm.New(mockllm.ToolCallTurn(call("call-1", protected.name, `{}`)))
	svc := newService(t, llm, allowRules(), protected)
	srv := httptest.NewServer(server.NewHTTPHandler(svc))
	defer srv.Close()

	id := createHTTPSession(t, srv)
	resp, err := http.Post(srv.URL+"/v1/sessions/"+id+"/prompt", "application/json", strings.NewReader(`{"text":"go"}`))
	if err != nil {
		t.Fatalf("POST prompt: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("prompt status = %d, want 200", resp.StatusCode)
	}
	events := parseSSE(t, bufio.NewReader(resp.Body))
	if !hasType(events, "mcp.authorization.required") || hasType(events, "result") {
		t.Fatalf("SSE events = %+v, want authorization required and no terminal result", events)
	}
	if protected.ran() {
		t.Fatal("protected tool executed while authorization was parked")
	}
	stored, err := svc.GetSession(t.Context(), session.SessionID(id))
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if stored.State != session.StateAuthorizing {
		t.Fatalf("session state = %s, want authorizing", stored.State)
	}
	if got := svc.ParkedCompletions(); got != 1 {
		t.Fatalf("HTTP parked completions = %d, want 1", got)
	}

	t.Run("grpc", func(t *testing.T) {
		protected := &parkedAuthorizationTool{scriptTool: scriptTool{name: "mcp__configured__read", readOnly: true, content: "must not execute"}}
		svc := newService(t, mockllm.New(mockllm.ToolCallTurn(call("call-1", protected.name, `{}`))), allowRules(), protected)
		client, cleanup := dialGRPC(t, svc)
		defer cleanup()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		created, err := client.CreateSession(ctx, &mecatlv1.CreateSessionRequest{Workspace: "/ws"})
		if err != nil {
			t.Fatalf("CreateSession: %v", err)
		}
		stream, err := client.Converse(ctx)
		if err != nil {
			t.Fatalf("Converse: %v", err)
		}
		if err := stream.Send(&mecatlv1.ConverseRequest{Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{SessionId: created.GetSessionId(), Text: "go"}}}); err != nil {
			t.Fatalf("Send prompt: %v", err)
		}
		if err := stream.CloseSend(); err != nil {
			t.Fatalf("CloseSend: %v", err)
		}
		events := recvAll(t, stream)
		if !hasType(events, "mcp.authorization.required") || hasType(events, "result") {
			t.Fatalf("gRPC events = %+v, want authorization required and no terminal result", events)
		}
		if got := svc.ParkedCompletions(); got != 1 {
			t.Fatalf("gRPC parked completions = %d, want 1", got)
		}
		if _, ok := svc.LookupRun(session.SessionID(created.GetSessionId())); ok {
			t.Fatal("gRPC relay retained parked run after drain")
		}
	})
}
