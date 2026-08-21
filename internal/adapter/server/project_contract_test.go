package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

// TestProjectContractWiringSmoke exercises the deployment-neutral Project control
// plane through its generated gRPC surface. It intentionally uses only opaque
// source identifiers; no workspace or environment selector crosses this boundary.
func TestProjectContractWiringSmoke(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	caps, err := client.GetServerCapabilities(context.Background(), &mecatlv1.GetServerCapabilitiesRequest{})
	if err != nil {
		t.Fatalf("GetServerCapabilities: %v", err)
	}
	if !caps.GetCapabilities().GetProjects() {
		t.Fatal("projects capability = false, want true")
	}

	sources, err := client.ListProjectSources(context.Background(), &mecatlv1.ListProjectSourcesRequest{})
	if err != nil {
		t.Fatalf("ListProjectSources: %v", err)
	}
	if len(sources.GetSources()) != 1 || sources.GetSources()[0].GetSourceRef() != string(source.Ref) {
		t.Fatalf("sources = %#v, want registry source %q", sources.GetSources(), source.Ref)
	}

	created, err := client.CreateProject(context.Background(), &mecatlv1.CreateProjectRequest{ProjectId: "project-1", Name: "Project one", SourceRef: string(source.Ref)})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if created.GetProject().GetRevision() != 1 || created.GetProject().GetWorking().GetLabel() != source.Label {
		t.Fatalf("created project = %#v", created.GetProject())
	}
	got, err := client.GetProject(context.Background(), &mecatlv1.GetProjectRequest{ProjectId: "project-1"})
	if err != nil || got.GetProject().GetName() != "Project one" {
		t.Fatalf("GetProject = %#v, %v", got, err)
	}
	listed, err := client.ListProjects(context.Background(), &mecatlv1.ListProjectsRequest{})
	if err != nil || len(listed.GetProjects()) != 1 {
		t.Fatalf("ListProjects = %#v, %v", listed, err)
	}
	replaced, err := client.ReplaceProject(context.Background(), &mecatlv1.ReplaceProjectRequest{ProjectId: "project-1", Name: "Project two", SourceRef: string(source.Ref), ExpectedRevision: 1})
	if err != nil || replaced.GetProject().GetRevision() != 2 {
		t.Fatalf("ReplaceProject = %#v, %v", replaced, err)
	}

	session, err := client.CreateSessionFromProject(context.Background(), &mecatlv1.CreateSessionFromProjectRequest{ProjectId: "project-1"})
	if err != nil {
		t.Fatalf("CreateSessionFromProject: %v", err)
	}
	if session.GetSessionId() == "" {
		t.Fatal("project session id is empty")
	}
	if _, err := client.DeleteProject(context.Background(), &mecatlv1.DeleteProjectRequest{ProjectId: "project-1", ExpectedRevision: 2}); err != nil {
		t.Fatalf("DeleteProject: %v", err)
	}
}

func TestProjectHTTPContractWiringSmoke(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	httpServer := httptest.NewServer(server.NewHTTPHandler(svc))
	defer httpServer.Close()

	resp, err := http.Get(httpServer.URL + "/v1/capabilities")
	if err != nil {
		t.Fatalf("GET capabilities: %v", err)
	}
	defer resp.Body.Close()
	var capabilities struct {
		Projects bool `json:"projects"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&capabilities); err != nil {
		t.Fatalf("decode capabilities: %v", err)
	}
	if resp.StatusCode != http.StatusOK || !capabilities.Projects {
		t.Fatalf("capabilities status/body = %d/%#v", resp.StatusCode, capabilities)
	}

	create, err := http.Post(httpServer.URL+"/v1/projects", "application/json", strings.NewReader(`{"project_id":"project-1","name":"Project one","source_ref":"`+string(source.Ref)+`"}`))
	if err != nil {
		t.Fatalf("POST project: %v", err)
	}
	defer create.Body.Close()
	if create.StatusCode != http.StatusCreated {
		t.Fatalf("POST project status = %d", create.StatusCode)
	}

	session, err := http.Post(httpServer.URL+"/v1/projects/project-1/sessions", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatalf("POST project session: %v", err)
	}
	defer session.Body.Close()
	if session.StatusCode != http.StatusCreated {
		t.Fatalf("POST project session status = %d", session.StatusCode)
	}
}

func TestProjectHTTPMutationRoutesRejectMalformedUTF8(t *testing.T) {
	svc, _, _, _ := newProjectService(t, false)
	handler := server.NewHTTPHandler(svc)
	bad := string([]byte{0xff})
	tests := []struct {
		name, method, path string
		body               []byte
	}{
		{name: "create project", method: http.MethodPost, path: "/v1/projects", body: []byte(`{"project_id":"p","name":"bad` + bad + `","source_ref":"opaque-source"}`)},
		{name: "replace project", method: http.MethodPut, path: "/v1/projects/p", body: []byte(`{"name":"bad` + bad + `","source_ref":"opaque-source","expected_revision":1}`)},
		{name: "delete project", method: http.MethodDelete, path: "/v1/projects/p", body: []byte(`{"expected_revision":1,"ignored":"bad` + bad + `"}`)},
		{name: "create project session", method: http.MethodPost, path: "/v1/projects/p/sessions", body: []byte(`{"model_id":"bad` + bad + `"}`)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(string(tc.body)))
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body=%q", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestProjectContractWiringRepairsSourceStrings(t *testing.T) {
	svc, _, _, registry := newProjectService(t, false)
	registry.source.Label = "bad\xfflabel"
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()

	resp, err := client.ListProjectSources(context.Background(), &mecatlv1.ListProjectSourcesRequest{})
	if err != nil {
		t.Fatalf("ListProjectSources: %v", err)
	}
	if got := resp.GetSources()[0].GetLabel(); !utf8.ValidString(got) {
		t.Fatalf("source label is invalid UTF-8: %q", got)
	}
}
