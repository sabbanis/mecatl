package main

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestInvariant_remote_mcp_broker_requires_verified_ownership(t *testing.T) {
	bundle := vmcpbroker.HandlerBundle{VMCP: okHandler{}}

	for _, tc := range []struct {
		name        string
		addr        string
		identity    bool
		ownerlessOK bool
		wantErr     bool
	}{
		{name: "network without verified identity", addr: "0.0.0.0:8081", wantErr: true},
		{name: "network with verified identity", addr: "0.0.0.0:8081", identity: true},
		{name: "mecak8s refuses ownerless loopback", addr: "127.0.0.1:8081", wantErr: true},
		{name: "explicit single-user loopback permits ownerless", addr: "127.0.0.1:8081", ownerlessOK: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := validateBrokerControlOwnership(tc.addr, tc.identity, tc.ownerlessOK, bundle)
			if tc.wantErr {
				if err == nil {
					t.Fatal("ownerless broker controls were accepted")
				}
				if !strings.Contains(err.Error(), "verified caller identity") {
					t.Fatalf("error %q does not state the verified identity requirement", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateBrokerControlOwnership: %v", err)
			}
		})
	}
}

type okHandler struct{}

func (okHandler) ServeHTTP(http.ResponseWriter, *http.Request) {}
