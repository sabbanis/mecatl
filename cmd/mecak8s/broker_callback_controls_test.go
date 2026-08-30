package main

import (
	"net/http"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestMecak8sBrokerCallbackCannotShadowControls(t *testing.T) {
	ok := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})
	bundle := vmcpbroker.HandlerBundle{
		Authorization:     ok,
		Token:             ok,
		UpstreamCallback:  ok,
		Discovery:         ok,
		JWKS:              ok,
		ProtectedResource: ok,
		VMCP:              ok,
		Callback:          ok,
	}

	for _, callbackPath := range []string{"/", "/v1/sessions", "/callback/", "/drain"} {
		t.Run(callbackPath, func(t *testing.T) {
			if err := prepareBrokerHTTP(http.NewServeMux(), "127.0.0.1:8081", true, false, bundle, callbackPath); err == nil {
				t.Fatalf("callback path %q must fail before the API/control fallback is mounted", callbackPath)
			}
		})
	}
}
