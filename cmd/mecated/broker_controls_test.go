package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

// TestMecatedBrokerHandlerMounting pins command-root ownership of broker routes:
// an empty bundle is a no-op, a supplied bundle mounts only through Mount, and a
// callback collision fails before the API mux can start serving an ambiguous route.
func TestMecatedBrokerHandlerMounting(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("GET /v1/sessions", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusAccepted) })
	if err := prepareBrokerHTTP(mux, "127.0.0.1:8081", false, vmcpbroker.HandlerBundle{}, ""); err != nil {
		t.Fatalf("empty bundle must be a no-op: %v", err)
	}

	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	bundle := vmcpbroker.HandlerBundle{Authorization: ok, Token: ok, UpstreamCallback: ok, Discovery: ok, JWKS: ok, ProtectedResource: ok, VMCP: ok, Callback: ok}
	if err := prepareBrokerHTTP(mux, "127.0.0.1:8081", false, bundle, "/exact/callback"); err != nil {
		t.Fatalf("mount broker bundle: %v", err)
	}
	for path, want := range map[string]int{"/healthz": http.StatusNoContent, "/v1/sessions": http.StatusAccepted, "/v1/mcp/broker/mcp": http.StatusOK, "/exact/callback": http.StatusOK} {
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "https://localhost"+path, nil))
		if rr.Code != want {
			t.Fatalf("%s = %d, want %d", path, rr.Code, want)
		}
	}
	collision := http.NewServeMux()
	collision.HandleFunc("/exact/callback", func(http.ResponseWriter, *http.Request) {})
	if err := prepareBrokerHTTP(collision, "127.0.0.1:8081", false, bundle, "/exact/callback"); err == nil {
		t.Fatal("callback collision must fail startup")
	}
}
