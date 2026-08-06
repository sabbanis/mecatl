package mcp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// getHostileServer wraps a healthy MCP POST endpoint with a GET-hostile edge:
// every standalone GET gets a 200 text/event-stream response that is closed
// immediately (no events, no retry hints) — the gateway shape that kills the
// SDK's standalone SSE stream while POST request/response traffic stays
// healthy. The counter records how many GETs arrived.
type getHostileServer struct {
	url  string
	gets *atomic.Int32
}

func newGetHostileServer(t *testing.T) *getHostileServer {
	t.Helper()
	// The healthy POST half reuses the package's established echo-server
	// handler (it also registers the test resources/prompts, inert here —
	// these tests only call echo + count GETs + assert reconnect diag).
	mcpHandler := newMCPHandler()
	gets := new(atomic.Int32)
	wrapped := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			gets.Add(1)
			// 200 + the SSE content type, then close: the friendliest possible
			// "accepted then dropped" — a hostile gateway shape the SDK cannot
			// distinguish from a flaky stream, so its reconnect loop retries.
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusOK)
			return
		}
		mcpHandler.ServeHTTP(w, r)
	})
	httpSrv := httptest.NewServer(wrapped)
	t.Cleanup(httpSrv.Close)
	return &getHostileServer{url: httpSrv.URL, gets: gets}
}

// TestGetHostileGatewayReconnectsTransparently is the CHARACTERIZATION test
// for the issue's claim (ADR 0083): against a GET-hostile gateway with the
// standalone SSE stream ENABLED (the ADR 0057 default), the SDK's SSE
// reconnect loop exhausts its retry budget and fails the WHOLE connection —
// POST included — so the next tool call rides the ADR 0056 withSession →
// reconnect path and succeeds transparently, with exactly one reconnecting/
// reconnected diagnostic pair. The session is recovered, not permanently
// lost, but the reconnect pays a fresh initialize (a new Mcp-Session-Id:
// server-side session state is lost) and, against a still-hostile gateway,
// the cycle repeats (chronic churn + one unlucky call paying the dial).
func TestGetHostileGatewayReconnectsTransparently(t *testing.T) {
	diag := &recordingDiag{}
	h := newGetHostileServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	s, err := Connect(ctx, ServerConfig{Name: "rs", URL: h.url, Timeout: 2 * time.Second}, diag)
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	// Baseline: POST works even though the initial GET was closed.
	res := callEcho(context.Background(), t, s, "first")
	if res.IsError || res.Content != "echo:first" {
		t.Fatalf("baseline echo = %+v, want echo:first", res)
	}

	// The SDK's handleSSE retries the dropped GET (default maxRetries=5), then
	// fails the whole connection. Wait for the budget to exhaust: 6 GETs total
	// (1 initial + 5 retries).
	eventually(t, 30*time.Second, func() bool { return h.gets.Load() >= 6 },
		"the SSE reconnect budget never exhausted (want >= 6 GETs)")

	// The next call must transparently reconnect and succeed — the ADR 0056
	// mitigation the issue's "loses the MCP session" overstates.
	res = callEcho(context.Background(), t, s, "second")
	if res.IsError || res.Content != "echo:second" {
		t.Fatalf("post-kill echo = %+v, want echo:second via transparent reconnect", res)
	}
	if got := diag.count("mcp server reconnecting"); got != 1 {
		t.Errorf("reconnecting lines = %d, want exactly 1", got)
	}
	if got := diag.count("mcp server reconnected"); got != 1 {
		t.Errorf("reconnected lines = %d, want exactly 1", got)
	}
	if got := diag.count("mcp server reconnect failed"); got != 0 {
		t.Errorf("reconnect-failed lines = %d, want 0", got)
	}

	// The reconnected session re-opens the GET (the stream is still enabled),
	// so against a still-hostile gateway the churn repeats — the honest
	// residual cost ADR 0083's opt-out exists to stop.
	eventually(t, 5*time.Second, func() bool { return h.gets.Load() >= 7 },
		"the reconnected session never re-opened the standalone GET")
}

// TestDisableNotificationsOptsOutOfStandaloneGET is the ADR 0083 fix test:
// connected with ServerConfig.DisableNotifications against the SAME
// GET-hostile gateway, the client NEVER opens the standalone GET (zero GETs
// observed across calls), the tool call succeeds on the first try, and no
// reconnect diagnostic fires — the kill→reconnect→kill churn is gone. The
// trade-off (honest): list-changed notifications for this server no longer
// arrive; the cached tool/resource/prompt snapshot is static until a
// reconnect (the pre-ADR-0057 contract).
func TestDisableNotificationsOptsOutOfStandaloneGET(t *testing.T) {
	diag := &recordingDiag{}
	h := newGetHostileServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	s, err := Connect(ctx, ServerConfig{
		Name:                 "rs",
		URL:                  h.url,
		Timeout:              2 * time.Second,
		DisableNotifications: true,
	}, diag)
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	// Several calls, all first-try successes; give any would-be GET a window.
	for _, text := range []string{"a", "b", "c"} {
		res := callEcho(context.Background(), t, s, text)
		if res.IsError || res.Content != "echo:"+text {
			t.Fatalf("echo(%q) = %+v, want echo:%s", text, res, text)
		}
	}
	// A GET, if one were opened, would be retried by the SDK within this
	// window (its initial retry backoff is sub-second); 3s is generous.
	time.Sleep(3 * time.Second)

	if got := h.gets.Load(); got != 0 {
		t.Errorf("standalone GETs observed = %d, want 0 (DisableNotifications must suppress the stream)", got)
	}
	if got := diag.count("mcp server reconnecting"); got != 0 {
		t.Errorf("reconnecting lines = %d, want 0 (no kill → no churn)", got)
	}
}
