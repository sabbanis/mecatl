package server_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/project"
	"github.com/stacklok/mecatl/internal/project/projectconformance"
)

// TestProjectWorkingMVP_Scenario1_CapabilityBootstrapMatrix pins Projects to the
// ownerless local control-plane posture; configured seams alone are insufficient
// when caller ownership is enforced.
func TestProjectWorkingMVP_Scenario1_CapabilityBootstrapMatrix(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name        string
		ownership   bool
		withFactory bool
		want        bool
	}{
		{name: "ownerless complete wiring", want: true, withFactory: true},
		{name: "missing session factory", want: false},
		{name: "ownership enforced", ownership: true, want: false, withFactory: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			svc, _, _, _ := newProjectServiceWithFactory(t, tt.ownership, tt.withFactory)
			client, cleanup := dialGRPC(t, svc)
			defer cleanup()

			got, err := client.GetServerCapabilities(context.Background(), &mecatlv1.GetServerCapabilitiesRequest{})
			if err != nil {
				t.Fatalf("GetServerCapabilities: %v", err)
			}
			if got.GetCapabilities().GetProjects() != tt.want {
				t.Fatalf("projects capability = %v, want %v", got.GetCapabilities().GetProjects(), tt.want)
			}
		})
	}
}

func TestInvariant_project_source_discovery_is_locator_free(t *testing.T) {
	svc, _, _, registry := newProjectService(t, false)
	registry.source = project.WorkingSource{Ref: "opaque-id", Label: "Working copy"}
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	got, err := client.ListProjectSources(context.Background(), &mecatlv1.ListProjectSourcesRequest{})
	if err != nil || len(got.Sources) != 1 || got.Sources[0].GetSourceRef() != "opaque-id" || got.Sources[0].GetLabel() != "Working copy" || !got.Sources[0].GetWorking() {
		t.Fatalf("sources = %#v, %v", got, err)
	}
	for _, forbidden := range []string{"/project", "environment", "password", "token"} {
		if strings.Contains(strings.ToLower(got.String()), forbidden) {
			t.Fatalf("locator leaked: %s", got)
		}
	}
}

func TestProjectWorkingMVP_Scenario1_CreateValidatedServerOwnedFields(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	got, err := svc.CreateProject(context.Background(), "one", "Project one", source.Ref)
	if err != nil || got.Owner != nil || got.Revision != 1 || got.Working.Label != source.Label {
		t.Fatalf("Create = %#v, %v", got, err)
	}
	if _, err := svc.CreateProject(context.Background(), "bad", " bad", source.Ref); !errors.Is(err, server.ErrInvalidArgument) {
		t.Fatalf("invalid name = %v", err)
	}
	if _, err := svc.CreateProject(context.Background(), "unknown", "Project", "forged"); !errors.Is(err, project.ErrSourceNotFound) {
		t.Fatalf("unknown source = %v", err)
	}
	if _, err := svc.CreateProject(context.Background(), "two", "Project two", source.Ref); err != nil {
		t.Fatalf("same source = %v", err)
	}
}

func TestProjectWorkingMVP_Scenario1_ReplaceCAS(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "one", "Original", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, name := range []string{"first", "second"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			_, err := svc.ReplaceProject(context.Background(), created.ID, name, source.Ref, 1)
			results <- err
		}(name)
	}
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		if err == nil {
			wins++
		} else if !errors.Is(err, project.ErrConflict) {
			t.Fatalf("Replace = %v", err)
		}
	}
	got, err := svc.GetProject(context.Background(), created.ID)
	if err != nil || wins != 1 || got.Revision != 2 || (got.Name != "first" && got.Name != "second") {
		t.Fatalf("CAS = %#v, %d, %v", got, wins, err)
	}
}

func TestProjectWorkingMVP_Scenario1_DeleteCASNonCascading(t *testing.T) {
	svc, source, sessions, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "one", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, "", session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteProject(context.Background(), created.ID, 0); !errors.Is(err, project.ErrConflict) {
		t.Fatalf("stale Delete = %v", err)
	}
	if err := svc.DeleteProject(context.Background(), created.ID, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := sessions.Load(context.Background(), sess.ID); err != nil {
		t.Fatalf("delete cascaded Session: %v", err)
	}
	if _, err := svc.ListProjectWorkingSources(context.Background()); err != nil {
		t.Fatalf("delete cascaded source: %v", err)
	}
}

func TestProjectWorkingMVP_Scenario1_BoundedProjectPagination(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	for _, id := range []string{"a", "b", "c"} {
		if _, err := svc.CreateProject(context.Background(), id, id, source.Ref); err != nil {
			t.Fatal(err)
		}
	}
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	first, err := client.ListProjects(context.Background(), &mecatlv1.ListProjectsRequest{PageSize: 1})
	if err != nil || len(first.Projects) != 1 || first.TotalCount != 3 || first.NextCursor == "" {
		t.Fatalf("first = %#v, %v", first, err)
	}
	second, err := client.ListProjects(context.Background(), &mecatlv1.ListProjectsRequest{PageSize: 999, Cursor: first.NextCursor})
	if err != nil || len(second.Projects) != 2 || second.TotalCount != 3 {
		t.Fatalf("second = %#v, %v", second, err)
	}
}

func TestProjectWorkingMVP_Scenario1_ProjectStoreConformance(t *testing.T) {
	projectconformance.Run(t, func(*testing.T) project.Store { return projectstore.NewMemory() })
	projectconformance.Run(t, func(t *testing.T) project.Store {
		store, err := projectstore.NewLocal(t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		return store
	})
}

func TestInvariant_project_session_creation_has_no_client_environment_selector(t *testing.T) {
	fields := (&mecatlv1.CreateSessionFromProjectRequest{}).ProtoReflect().Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		name := string(fields.Get(i).Name())
		for _, forbidden := range []string{"workspace", "profile", "source", "environment", "path", "reference", "carryover"} {
			if strings.Contains(name, forbidden) {
				t.Fatalf("request exposes %q", name)
			}
		}
	}
}

func TestProjectWorkingMVP_Scenario2_AtomicProjectCapture(t *testing.T) {
	svc, source, _, registry := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "one", "Before", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	registry.afterResolve = func() {
		registry.afterResolve = nil
		_, _ = svc.ReplaceProject(context.Background(), created.ID, "After", source.Ref, 1)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, "", session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if sess.Project.ProjectNameAtCreation != "Before" || sess.Project.ProjectRevision != 1 {
		t.Fatalf("mixed capture = %#v", sess.Project)
	}
}

func TestProjectWorkingMVP_Scenario2_DurableCapturedBinding(t *testing.T) {
	svc, source, store, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "one", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, "", session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	durable, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if durable.Project == nil || durable.Project.ProjectID != created.ID || durable.Project.ProjectNameAtCreation != created.Name || durable.Project.ProjectRevision != 1 || durable.Project.Working.SourceRef != string(source.Ref) || durable.Project.Working.LabelAtCreation != source.Label || durable.Project.References == nil || len(durable.Project.References) != 0 || durable.EnvironmentRef != sess.EnvironmentRef || durable.Workspace != "/project" {
		t.Fatalf("durable binding = %#v", durable)
	}
}

func TestInvariant_project_source_ref_is_not_authority(t *testing.T) {
	svc, source, _, registry := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "one", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	registry.source.Ref = "removed"
	if _, err := svc.CreateSessionFromProject(context.Background(), created.ID, "", session.Limits{}, server.ProviderSelector{}); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("removed source = %v", err)
	}
}

func TestProjectWorkingMVP_Scenario2_LegacyCreateUnchanged(t *testing.T) {
	svc, _, store, _ := newProjectService(t, false)
	client, cleanup := dialGRPC(t, svc)
	defer cleanup()
	resp, err := client.CreateSession(context.Background(), &mecatlv1.CreateSessionRequest{Workspace: "/legacy"})
	if err != nil {
		t.Fatal(err)
	}
	durable, err := store.Load(context.Background(), session.SessionID(resp.SessionId))
	if err != nil {
		t.Fatal(err)
	}
	if durable.Project != nil {
		t.Fatalf("legacy Project = %#v", durable.Project)
	}
}
