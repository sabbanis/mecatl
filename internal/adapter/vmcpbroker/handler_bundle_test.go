package vmcpbroker

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSessionMCPAuthorization_Scenario2_MountsTrustedHandlers(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	bundle := HandlerBundle{
		Authorization: ok, Token: ok, UpstreamCallback: ok, Discovery: ok,
		JWKS: ok, ProtectedResource: ok, VMCP: ok, Callback: ok,
	}

	mux := http.NewServeMux()
	if err := bundle.Mount(mux, "/broker-callback"); err != nil {
		t.Fatalf("Mount: %v", err)
	}
	for _, path := range []string{
		brokerAuthorizePath, brokerTokenPath, brokerUpstreamCallbackPath,
		brokerDiscoveryPath, brokerJWKSPath, brokerProtectedResourcePath,
		brokerMCPPath, "/broker-callback",
	} {
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "https://broker.invalid"+path, nil))
		if rr.Code != http.StatusNoContent {
			t.Fatalf("%s = %d, want mounted handler status %d", path, rr.Code, http.StatusNoContent)
		}
	}

	if err := bundle.Mount(http.NewServeMux(), brokerMCPPath); err == nil {
		t.Fatal("Mount accepted callback collision with a fixed broker route")
	}
}
