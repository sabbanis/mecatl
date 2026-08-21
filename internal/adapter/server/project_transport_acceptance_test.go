package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/reflect/protoreflect"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
)

// TestProjectWorkingMVP_Scenario5_EndToEndJourney pins the complete public
// Project lifecycle through the generated gRPC transport, including continued
// use of a Session after its live Project is deleted.
func TestProjectWorkingMVP_Scenario5_EndToEndJourney(t *testing.T) {
	ctx := context.Background()
	svc, source, _, _ := newProjectService(t, false)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	caps, err := client.GetServerCapabilities(ctx, &mecatlv1.GetServerCapabilitiesRequest{})
	if err != nil || !caps.GetCapabilities().GetProjects() {
		t.Fatalf("GetServerCapabilities = %#v, %v", caps, err)
	}
	sources, err := client.ListProjectSources(ctx, &mecatlv1.ListProjectSourcesRequest{})
	if err != nil || len(sources.GetSources()) != 1 || sources.GetSources()[0].GetSourceRef() != string(source.Ref) {
		t.Fatalf("ListProjectSources = %#v, %v", sources, err)
	}
	created, err := client.CreateProject(ctx, &mecatlv1.CreateProjectRequest{ProjectId: "project-1", Name: "First", SourceRef: string(source.Ref)})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if _, err := client.GetProject(ctx, &mecatlv1.GetProjectRequest{ProjectId: "project-1"}); err != nil {
		t.Fatalf("GetProject: %v", err)
	}
	listed, err := client.ListProjects(ctx, &mecatlv1.ListProjectsRequest{})
	if err != nil || listed.GetTotalCount() != 1 {
		t.Fatalf("ListProjects = %#v, %v", listed, err)
	}
	replaced, err := client.ReplaceProject(ctx, &mecatlv1.ReplaceProjectRequest{ProjectId: "project-1", Name: "Renamed", SourceRef: string(source.Ref), ExpectedRevision: created.GetProject().GetRevision()})
	if err != nil || replaced.GetProject().GetRevision() != 2 {
		t.Fatalf("ReplaceProject = %#v, %v", replaced, err)
	}
	createdSession, err := client.CreateSessionFromProject(ctx, &mecatlv1.CreateSessionFromProjectRequest{ProjectId: "project-1"})
	if err != nil || createdSession.GetSessionId() == "" {
		t.Fatalf("CreateSessionFromProject = %#v, %v", createdSession, err)
	}
	page, err := client.ListSessions(ctx, &mecatlv1.ListSessionsRequest{ProjectId: "project-1"})
	if err != nil || len(page.GetSessions()) != 1 || page.GetSessions()[0].GetSessionId() != createdSession.GetSessionId() {
		t.Fatalf("ListSessions(Project) = %#v, %v", page, err)
	}
	if err := runProjectSession(ctx, client, createdSession.GetSessionId()); err != nil {
		t.Fatalf("Converse Project Session: %v", err)
	}
	if _, err := client.DeleteProject(ctx, &mecatlv1.DeleteProjectRequest{ProjectId: "project-1", ExpectedRevision: replaced.GetProject().GetRevision()}); err != nil {
		t.Fatalf("DeleteProject: %v", err)
	}
	if _, err := client.GetSession(ctx, &mecatlv1.GetSessionRequest{SessionId: createdSession.GetSessionId()}); err != nil {
		t.Fatalf("GetSession after Project deletion: %v", err)
	}
	if err := runProjectSession(ctx, client, createdSession.GetSessionId()); err != nil {
		t.Fatalf("continue Project Session after deletion: %v", err)
	}
}

func runProjectSession(ctx context.Context, client mecatlv1.HarnessServiceClient, sessionID string) error {
	stream, err := client.Converse(ctx)
	if err != nil {
		return err
	}
	if err := stream.Send(&mecatlv1.ConverseRequest{Kind: &mecatlv1.ConverseRequest_Prompt{Prompt: &mecatlv1.Prompt{SessionId: sessionID, Text: "hello"}}}); err != nil {
		return err
	}
	for {
		response, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if response.GetEvent().GetResult() != nil {
			return nil
		}
	}
}

// TestProjectWorkingMVP_Scenario5_TransportParity keeps Project errors and
// successful creation equivalent between generated gRPC and browser HTTP.
func TestProjectWorkingMVP_Scenario5_TransportParity(t *testing.T) {
	for _, tt := range []struct {
		name       string
		ownership  bool
		prepare    func(t *testing.T, svc *server.Service, source project.WorkingSource, registry *projectRegistry)
		grpc       func(context.Context, mecatlv1.HarnessServiceClient) error
		httpMethod string
		httpPath   string
		httpBody   string
		wantGRPC   codes.Code
		wantHTTP   int
	}{
		{name: "missing project", grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.GetProject(ctx, &mecatlv1.GetProjectRequest{ProjectId: "missing"})
			return err
		}, httpMethod: http.MethodGet, httpPath: "/v1/projects/missing", wantGRPC: codes.NotFound, wantHTTP: http.StatusNotFound},
		{name: "invalid create name", grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.CreateProject(ctx, &mecatlv1.CreateProjectRequest{ProjectId: "p", Name: " bad", SourceRef: "opaque-source"})
			return err
		}, httpMethod: http.MethodPost, httpPath: "/v1/projects", httpBody: `{"project_id":"p","name":" bad","source_ref":"opaque-source"}`, wantGRPC: codes.InvalidArgument, wantHTTP: http.StatusBadRequest},
		{name: "invalid source", grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.CreateProject(ctx, &mecatlv1.CreateProjectRequest{ProjectId: "p", Name: "Valid", SourceRef: "unknown"})
			return err
		}, httpMethod: http.MethodPost, httpPath: "/v1/projects", httpBody: `{"project_id":"p","name":"Valid","source_ref":"unknown"}`, wantGRPC: codes.InvalidArgument, wantHTTP: http.StatusBadRequest},
		{name: "stale replace", prepare: createProjectFixture, grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.ReplaceProject(ctx, &mecatlv1.ReplaceProjectRequest{ProjectId: "p", Name: "Changed", SourceRef: "opaque-source", ExpectedRevision: 9})
			return err
		}, httpMethod: http.MethodPut, httpPath: "/v1/projects/p", httpBody: `{"name":"Changed","source_ref":"opaque-source","expected_revision":9}`, wantGRPC: codes.Aborted, wantHTTP: http.StatusConflict},
		{name: "stale delete", prepare: createProjectFixture, grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.DeleteProject(ctx, &mecatlv1.DeleteProjectRequest{ProjectId: "p", ExpectedRevision: 9})
			return err
		}, httpMethod: http.MethodDelete, httpPath: "/v1/projects/p", httpBody: `{"expected_revision":9}`, wantGRPC: codes.Aborted, wantHTTP: http.StatusConflict},
		{name: "invalid project page cursor", grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.ListProjects(ctx, &mecatlv1.ListProjectsRequest{Cursor: "%%%"})
			return err
		}, httpMethod: http.MethodGet, httpPath: "/v1/projects?cursor=not-base64", wantGRPC: codes.InvalidArgument, wantHTTP: http.StatusBadRequest},
		{name: "foreign ownership deployment is unavailable", ownership: true, grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.GetProject(ctx, &mecatlv1.GetProjectRequest{ProjectId: "foreign"})
			return err
		}, httpMethod: http.MethodGet, httpPath: "/v1/projects/foreign", wantGRPC: codes.Unimplemented, wantHTTP: http.StatusNotImplemented},
		{name: "unavailable captured source", prepare: func(t *testing.T, svc *server.Service, source project.WorkingSource, registry *projectRegistry) {
			createProjectFixture(t, svc, source, registry)
			registry.resolveErr = io.ErrUnexpectedEOF
		}, grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.CreateSessionFromProject(ctx, &mecatlv1.CreateSessionFromProjectRequest{ProjectId: "p"})
			return err
		}, httpMethod: http.MethodPost, httpPath: "/v1/projects/p/sessions", httpBody: `{}`, wantGRPC: codes.FailedPrecondition, wantHTTP: http.StatusPreconditionFailed},
		{name: "successful project session", prepare: createProjectFixture, grpc: func(ctx context.Context, c mecatlv1.HarnessServiceClient) error {
			_, err := c.CreateSessionFromProject(ctx, &mecatlv1.CreateSessionFromProjectRequest{ProjectId: "p"})
			return err
		}, httpMethod: http.MethodPost, httpPath: "/v1/projects/p/sessions", httpBody: `{}`, wantGRPC: codes.OK, wantHTTP: http.StatusCreated},
	} {
		t.Run(tt.name, func(t *testing.T) {
			svc, source, _, registry := newProjectService(t, tt.ownership)
			if tt.prepare != nil {
				tt.prepare(t, svc, source, registry)
			}
			client, cleanup := dialGRPC(t, svc)
			defer cleanup()
			if got := status.Code(tt.grpc(context.Background(), client)); got != tt.wantGRPC {
				t.Fatalf("gRPC code = %s, want %s", got, tt.wantGRPC)
			}
			if tt.httpMethod == "" {
				return
			}
			httpServer := httptest.NewServer(server.NewHTTPHandler(svc))
			defer httpServer.Close()
			req, err := http.NewRequest(tt.httpMethod, httpServer.URL+tt.httpPath, strings.NewReader(tt.httpBody))
			if err != nil {
				t.Fatal(err)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tt.wantHTTP {
				t.Fatalf("HTTP status = %d, want %d", resp.StatusCode, tt.wantHTTP)
			}
		})
	}
}

func createProjectFixture(t *testing.T, svc *server.Service, source project.WorkingSource, _ *projectRegistry) {
	t.Helper()
	if _, err := svc.CreateProject(context.Background(), "p", "Project", source.Ref); err != nil {
		t.Fatal(err)
	}
}

// TestProjectWorkingMVP_Scenario5_StudioContractIsPathFree pins the generated,
// standalone Studio surface: it can discover and manage Projects without a
// client-supplied filesystem or internal binding projection.
func TestProjectWorkingMVP_Scenario5_StudioContractIsPathFree(t *testing.T) {
	serviceDesc := (&mecatlv1.GetServerCapabilitiesRequest{}).ProtoReflect().Descriptor().ParentFile().Services().ByName("HarnessService")
	for _, method := range []protoreflect.Name{"GetServerCapabilities", "ListProjectSources", "CreateProject", "GetProject", "ListProjects", "ReplaceProject", "DeleteProject", "CreateSessionFromProject"} {
		if serviceDesc.Methods().ByName(method) == nil {
			t.Fatalf("missing Studio RPC %q", method)
		}
	}
	for _, message := range []protoreflect.ProtoMessage{&mecatlv1.Project{}, &mecatlv1.ProjectSource{}, &mecatlv1.CreateSessionFromProjectRequest{}, &mecatlv1.CreateSessionFromProjectResponse{}} {
		fields := message.ProtoReflect().Descriptor().Fields()
		for i := 0; i < fields.Len(); i++ {
			name := string(fields.Get(i).Name())
			for _, forbidden := range []string{"path", "workspace", "environment", "binding", "owner", "profile", "reference", "locator"} {
				if strings.Contains(name, forbidden) {
					t.Fatalf("%s exposes %q", message.ProtoReflect().Descriptor().FullName(), name)
				}
			}
		}
	}
}

// TestInvariant_project_proto_strings_and_errors_are_safe pins the protobuf
// boundary: producer strings are repaired and adapter locator failures never
// become ordinary transport response text.
func TestInvariant_project_proto_strings_and_errors_are_safe(t *testing.T) {
	svc, source, _, registry := newProjectService(t, false)
	if _, err := svc.CreateProject(context.Background(), "p", "Project", source.Ref); err != nil {
		t.Fatal(err)
	}
	registry.source.Label = "label\xff"
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	sources, err := client.ListProjectSources(context.Background(), &mecatlv1.ListProjectSourcesRequest{})
	if err != nil || !utf8.ValidString(sources.GetSources()[0].GetLabel()) || !utf8.ValidString(sources.GetSources()[0].GetSourceRef()) {
		t.Fatalf("ListProjectSources = %#v, %v", sources, err)
	}
	registry.resolveErr = errors.New("open /private/project/root: permission denied")
	httpServer := httptest.NewServer(server.NewHTTPHandler(svc))
	defer httpServer.Close()
	resp, err := http.Post(httpServer.URL+"/v1/projects/p/sessions", "application/json", bytes.NewBufferString(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusPreconditionFailed || strings.Contains(strings.ToLower(body["error"]), "project") || strings.Contains(body["error"], "/private/project/root") {
		t.Fatalf("unsafe locator error = status %d body %#v", resp.StatusCode, body)
	}
}
