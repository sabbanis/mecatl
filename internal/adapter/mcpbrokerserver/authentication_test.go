package mcpbrokerserver

import (
	"context"
	"errors"
	"testing"

	brokerv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/broker/v1"
	"github.com/stacklok/mecatl/engine/session"
)

type completeVerifierFake struct {
	readyErr error
	closed   bool
}

func (*completeVerifierFake) Validate(context.Context, string) (*session.Principal, error) {
	return nil, errors.New("not used")
}
func (f *completeVerifierFake) Ready(context.Context) error { return f.readyErr }
func (f *completeVerifierFake) Close() error                { f.closed = true; return nil }

func TestBrokerHostUsesCompleteVerifierForReadinessAndClose(t *testing.T) {
	verifier := &completeVerifierFake{}
	host, err := newBrokerHost(t.Context(), hostConfig{Service: &countingService{}, Verifier: verifier})
	if err != nil {
		t.Fatal(err)
	}
	if !host.ready(t.Context()) {
		t.Fatal("verifier-ready host is not ready")
	}
	verifier.readyErr = errors.New("unavailable")
	if host.ready(t.Context()) {
		t.Fatal("unready verifier left host ready")
	}
	if err := host.close(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !verifier.closed {
		t.Fatal("host did not close verifier")
	}
}

func TestOperationNameUsesGeneratedFullMethodNames(t *testing.T) {
	for method, want := range map[string]string{
		brokerv1.BrokerService_Attach_FullMethodName:                     "attach",
		brokerv1.BrokerService_Commit_FullMethodName:                     "commit",
		brokerv1.BrokerService_Abort_FullMethodName:                      "abort",
		brokerv1.BrokerService_Close_FullMethodName:                      "close",
		brokerv1.BrokerService_Delete_FullMethodName:                     "delete",
		brokerv1.BrokerService_Execute_FullMethodName:                    "execute",
		brokerv1.BrokerService_RequestAuthorization_FullMethodName:       "request_authorization",
		brokerv1.BrokerService_AbortAuthorization_FullMethodName:         "abort_authorization",
		brokerv1.BrokerService_PresentAuthorization_FullMethodName:       "present_authorization",
		brokerv1.BrokerService_AuthorizationStatus_FullMethodName:        "authorization_status",
		brokerv1.BrokerService_CancelAuthorization_FullMethodName:        "cancel_authorization",
		brokerv1.BrokerService_BeginWorkspaceEnrollment_FullMethodName:   "begin_workspace_enrollment",
		brokerv1.BrokerService_ObserveWorkspaceEnrollment_FullMethodName: "observe_workspace_enrollment",
		brokerv1.BrokerService_CancelWorkspaceEnrollment_FullMethodName:  "cancel_workspace_enrollment",
	} {
		if got := operationName(method); got != want {
			t.Errorf("operationName(%q) = %q, want %q", method, got, want)
		}
	}
	if got := operationName("/unknown"); got != "unknown" {
		t.Fatalf("unknown operation = %q", got)
	}
}
