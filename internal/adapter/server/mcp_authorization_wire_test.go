package server

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/session"
)

// TestInvariant_mcp_authorization_events_are_safe_correlation_only pins the
// wire event grammar: both required and resolved events carry status and safe
// correlation only, never the browser transaction or effective call arguments.
func TestInvariant_mcp_authorization_events_are_safe_correlation_only(t *testing.T) {
	t.Parallel()

	ev := toProto(session.Event{
		Type: session.EvMCPAuthorizationRequired,
		MCPAuthorization: &session.MCPAuthorizationPayload{
			AuthorizationID: "authorization-1",
			Backend:         "github",
			Call:            "call-1",
			ExpiresAt:       time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC),
			Status:          session.MCPAuthorizationPending,
		},
	})

	got := ev.GetMcpAuthorization()
	require.NotNil(t, got)
	require.Equal(t, "pending", got.GetStatus())
	require.Equal(t, "authorization-1", got.GetAuthorizationId())
	require.Equal(t, "github", got.GetBackend())
	require.Equal(t, "call-1", got.GetCallId())
	for _, forbidden := range []string{"url", "argument", "code", "verifier", "token", "tsid", "secret"} {
		fields := got.ProtoReflect().Descriptor().Fields()
		for i := 0; i < fields.Len(); i++ {
			fd := fields.Get(i)
			require.NotContains(t, strings.ToLower(string(fd.Name())), forbidden)
		}
	}
}

// TestSessionMCPAuthorization_Scenario9_WireControlParity drives the actual HTTP
// SSE and gRPC streaming endpoints through the same real Runtime-backed Service.
// Each transport must relay the authoritative Service status rather than infer it.
func TestSessionMCPAuthorization_Scenario9_WireControlParity(t *testing.T) {
	cases := []struct {
		name   string
		action string
		setup  func(*serviceAuthorizationFixture)
		status string
	}{
		{name: "pending", action: "recheck", status: "pending"},
		{name: "connected", action: "recheck", setup: func(f *serviceAuthorizationFixture) { f.connect(t) }, status: "connected"},
		{name: "expired", action: "recheck", setup: func(f *serviceAuthorizationFixture) {
			f.svc.cfg.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }
		}, status: "expired"},
		{name: "cancelled", action: "cancel", status: "cancelled"},
	}
	for _, tc := range cases {
		t.Run(tc.name+"/http", func(t *testing.T) {
			fixture := newServiceAuthorizationFixture(t)
			if tc.setup != nil {
				tc.setup(fixture)
			}
			events := mcpAuthorizationHTTPControl(t, fixture, tc.action)
			assertMCPAuthorizationStatus(t, events, tc.status)
		})
		t.Run(tc.name+"/grpc", func(t *testing.T) {
			fixture := newServiceAuthorizationFixture(t)
			if tc.setup != nil {
				tc.setup(fixture)
			}
			events := mcpAuthorizationGRPCControl(t, fixture, tc.action)
			assertMCPAuthorizationStatus(t, events, tc.status)
		})
	}

	for _, transport := range []string{"http", "grpc"} {
		t.Run("bad id/"+transport, func(t *testing.T) {
			fixture := newServiceAuthorizationFixture(t)
			if transport == "http" {
				srv := httptest.NewServer(NewHTTPHandler(fixture.svc))
				defer srv.Close()
				response, err := http.Post(srv.URL+"/v1/sessions/unknown/mcp-authorizations/unknown:recheck", "application/json", nil)
				require.NoError(t, err)
				defer response.Body.Close()
				require.Equal(t, http.StatusNotFound, response.StatusCode)
				malformed, err := http.Post(srv.URL+"/v1/sessions/"+string(fixture.id)+"/mcp-authorizations/:recheck", "application/json", nil)
				require.NoError(t, err)
				defer malformed.Body.Close()
				require.Equal(t, http.StatusBadRequest, malformed.StatusCode)
				return
			}
			client, cleanup := dialMCPAuthorizationGRPC(t, fixture.svc)
			defer cleanup()
			stream, err := client.RecheckMCPAuthorization(t.Context(), &mecatlv1.MCPAuthorizationControlRequest{SessionId: "unknown", AuthorizationId: "unknown"})
			require.NoError(t, err)
			_, err = stream.Recv()
			require.Error(t, err)
			require.Contains(t, err.Error(), "not found")
			malformed, err := client.RecheckMCPAuthorization(t.Context(), &mecatlv1.MCPAuthorizationControlRequest{})
			require.NoError(t, err)
			_, err = malformed.Recv()
			require.Error(t, err)
			require.Contains(t, err.Error(), "invalid")
		})
	}
}

func mcpAuthorizationHTTPControl(t *testing.T, fixture *serviceAuthorizationFixture, action string) []*mecatlv1.Event {
	t.Helper()
	srv := httptest.NewServer(NewHTTPHandler(fixture.svc))
	defer srv.Close()
	response, err := http.Post(srv.URL+"/v1/sessions/"+string(fixture.id)+"/mcp-authorizations/"+fixture.control.AuthorizationID+":"+action, "application/json", nil)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	return readMCPAuthorizationSSE(t, response.Body)
}

func mcpAuthorizationGRPCControl(t *testing.T, fixture *serviceAuthorizationFixture, action string) []*mecatlv1.Event {
	t.Helper()
	client, cleanup := dialMCPAuthorizationGRPC(t, fixture.svc)
	defer cleanup()
	request := &mecatlv1.MCPAuthorizationControlRequest{SessionId: string(fixture.id), AuthorizationId: fixture.control.AuthorizationID}
	var stream grpc.ServerStreamingClient[mecatlv1.Event]
	var err error
	if action == "cancel" {
		stream, err = client.CancelMCPAuthorization(t.Context(), request)
	} else {
		stream, err = client.RecheckMCPAuthorization(t.Context(), request)
	}
	require.NoError(t, err)
	var events []*mecatlv1.Event
	for {
		event, err := stream.Recv()
		if err == io.EOF {
			return events
		}
		require.NoError(t, err)
		events = append(events, event)
	}
}

func dialMCPAuthorizationGRPC(t *testing.T, svc *Service) (mecatlv1.HarnessServiceClient, func()) {
	t.Helper()
	listener := bufconn.Listen(1 << 20)
	grpcServer := grpc.NewServer()
	mecatlv1.RegisterHarnessServiceServer(grpcServer, NewHarnessServer(svc))
	go func() { _ = grpcServer.Serve(listener) }()
	conn, err := grpc.NewClient("passthrough:///mcp-authorization", grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
		return listener.DialContext(ctx)
	}), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	return mecatlv1.NewHarnessServiceClient(conn), func() {
		_ = conn.Close()
		grpcServer.Stop()
		_ = listener.Close()
	}
}

func readMCPAuthorizationSSE(t *testing.T, body io.Reader) []*mecatlv1.Event {
	t.Helper()
	var events []*mecatlv1.Event
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		data, ok := strings.CutPrefix(scanner.Text(), "data: ")
		if !ok {
			continue
		}
		var event mecatlv1.Event
		require.NoError(t, json.Unmarshal([]byte(data), &event))
		events = append(events, &event)
	}
	require.NoError(t, scanner.Err())
	return events
}

func assertMCPAuthorizationStatus(t *testing.T, events []*mecatlv1.Event, want string) {
	t.Helper()
	require.NotEmpty(t, events)
	got := events[0].GetMcpAuthorization()
	require.NotNil(t, got)
	require.Equal(t, want, got.GetStatus())
	if want == "pending" {
		return
	}
	for _, event := range events[1:] {
		if event.GetType() == "result" {
			return
		}
	}
	t.Fatalf("%s control did not relay its continuation events: %v", want, events)
}

// TestInvariant_mcp_authorization_control_returns_locked_status proves a control
// response is selected while the Service owns the session lock. A later clock
// observation must not relabel a cancellation as expiry after the aggregate has
// already been durably resolved.
func TestInvariant_mcp_authorization_control_returns_locked_status(t *testing.T) {
	const id session.SessionID = "locked-control-status"
	svc, _, runtime := lifecycleAuthorizationService(t, id)
	t.Cleanup(func() { _ = runtime.Close() })

	beforeExpiry := time.Now()
	afterExpiry := beforeExpiry.Add(2 * time.Hour)
	calls := 0
	svc.cfg.Now = func() time.Time {
		calls++
		if calls == 1 {
			return beforeExpiry
		}
		return afterExpiry
	}

	result, err := svc.ControlMCPAuthorization(t.Context(), id, MCPAuthorizationControl{
		SessionID: id, AuthorizationID: "authorization-exact",
	}, true)
	require.NoError(t, err)
	require.NotNil(t, result.Run)
	require.NotNil(t, result.Event.MCPAuthorization)
	require.Equal(t, session.MCPAuthorizationCancelled, result.Event.MCPAuthorization.Status)
}
