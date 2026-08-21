package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/adapter/eventsource"
	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/projectstore"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/app"
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

func TestProjectWorkingMVP_Scenario3_ProjectEditsAreProspective(t *testing.T) {
	svc, source, _, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Before", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ReplaceProject(context.Background(), created.ID, "After", source.Ref, created.Revision); err != nil {
		t.Fatal(err)
	}
	if sess.Project == nil || sess.Project.ProjectNameAtCreation != "Before" || sess.Project.ProjectRevision != 1 {
		t.Fatalf("captured binding changed after Project replace: %#v", sess.Project)
	}
	if got := sess.ProjectProvenance(); got.ProjectID != created.ID || got.ProjectNameAtCreation != "Before" || got.WorkingLabelAtCreation != source.Label {
		t.Fatalf("compact provenance = %#v", got)
	}
}

func TestProjectWorkingMVP_Scenario3_ProjectDeletePreservesSessions(t *testing.T) {
	svc, source, store, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteProject(context.Background(), created.ID, created.Revision); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{}); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("new Session after deletion = %v, want not found", err)
	}
	persisted, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("existing Session deleted: %v", err)
	}
	if persisted.Project == nil || persisted.Project.ProjectID != created.ID || persisted.Project.ProjectNameAtCreation != "Project" {
		t.Fatalf("existing Session rebound after deletion: %#v", persisted.Project)
	}
}

func TestInvariant_project_session_restart_uses_captured_binding(t *testing.T) {
	svc, source, _, registry := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	validated := false
	registry.afterResolve = func() { validated = true }
	svc.DropSessionEngineForTest(sess.ID)

	run, err := svc.StartRun(context.Background(), sess.ID, "continue")
	if err != nil {
		t.Fatalf("restart run entry: %v", err)
	}
	if got := drainServerRun(run); got != "ok" {
		t.Fatalf("restart reply = %q, want ok", got)
	}
	if !validated {
		t.Fatal("run entry did not validate the captured SourceRef through the rebuilt registry")
	}

	t.Run("real Build reattaches the original canonical binding", func(t *testing.T) {
		root, storeDir := t.TempDir(), t.TempDir()
		first, err := app.Build(context.Background(), app.Config{
			Workspace: root, StoreDir: storeDir, UseMock: true, NoSoul: true, EnableLocalProjects: true,
		})
		if err != nil {
			t.Fatalf("first Build: %v", err)
		}
		working, err := first.Service.ListProjectWorkingSources(context.Background())
		if err != nil || len(working) != 1 {
			first.Close()
			t.Fatalf("first source registry = %#v, %v", working, err)
		}
		projectDoc, err := first.Service.CreateProject(context.Background(), "restart-project", "Restart", working[0].Ref)
		if err != nil {
			first.Close()
			t.Fatal(err)
		}
		original, err := first.Service.CreateSessionFromProject(context.Background(), projectDoc.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
		if err != nil {
			first.Close()
			t.Fatal(err)
		}
		originalRef := original.EnvironmentRef
		first.Close()

		second, err := app.Build(context.Background(), app.Config{
			Workspace: root, StoreDir: storeDir, UseMock: true, NoSoul: true, EnableLocalProjects: true,
		})
		if err != nil {
			t.Fatalf("second Build: %v", err)
		}
		defer second.Close()
		restarted, err := second.Service.GetSession(context.Background(), original.ID)
		if err != nil {
			t.Fatal(err)
		}
		if restarted.Project == nil || restarted.Project.Working.SourceRef != string(working[0].Ref) || restarted.EnvironmentRef != originalRef {
			t.Fatalf("restarted capture = %#v, ref = %#v; want source %q, ref %#v", restarted.Project, restarted.EnvironmentRef, working[0].Ref, originalRef)
		}
		run, err := second.Service.StartRun(context.Background(), original.ID, "continue")
		if err != nil {
			t.Fatalf("restarted Project Session run: %v", err)
		}
		drainServerRun(run)
		second.Service.FinishRun(original.ID, run)
	})
}

func TestProjectWorkingMVP_Scenario3_SourceRevocationFailsClosed(t *testing.T) {
	svc, source, _, registry := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	svc.DropSessionEngineForTest(sess.ID)
	registry.source.Ref = "different-registration"

	if _, err := svc.StartRun(context.Background(), sess.ID, "must not execute"); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("changed registration run = %v, want failed precondition", err)
	}
	persisted, err := svc.GetSession(context.Background(), sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Project == nil || persisted.Project.Working.SourceRef != string(source.Ref) || persisted.EnvironmentRef != sess.EnvironmentRef {
		t.Fatalf("failed revocation rewrote capture: %#v, ref %#v", persisted.Project, persisted.EnvironmentRef)
	}
	registry.source.Ref = source.Ref
	run, err := svc.StartRun(context.Background(), sess.ID, "restored")
	if err != nil {
		t.Fatalf("exact original registration did not restore Session: %v", err)
	}
	drainServerRun(run)
	svc.FinishRun(sess.ID, run)
}

func TestProjectWorkingMVP_Scenario3_ForkInheritsCapturedBinding(t *testing.T) {
	svc, source, store, _ := newProjectService(t, false)
	created, err := svc.CreateProject(context.Background(), "project-1", "Project", source.Ref)
	if err != nil {
		t.Fatal(err)
	}
	sess, err := svc.CreateSessionFromProject(context.Background(), created.ID, session.ModeDefault, session.Limits{}, server.ProviderSelector{})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteProject(context.Background(), created.ID, created.Revision); err != nil {
		t.Fatalf("delete live Project before fork: %v", err)
	}
	forkID, err := svc.ForkSession(context.Background(), sess.ID, "", "")
	if err != nil {
		t.Fatal(err)
	}
	forked, err := store.Load(context.Background(), forkID)
	if err != nil {
		t.Fatal(err)
	}
	if forked.Project == nil || forked.Project.ProjectID != sess.Project.ProjectID ||
		forked.Project.ProjectNameAtCreation != sess.Project.ProjectNameAtCreation ||
		forked.Project.ProjectRevision != sess.Project.ProjectRevision ||
		forked.Project.Working != sess.Project.Working ||
		forked.EnvironmentRef != sess.EnvironmentRef {
		t.Fatalf("fork binding = %#v, ref = %#v; want %#v, %#v", forked.Project, forked.EnvironmentRef, sess.Project, sess.EnvironmentRef)
	}
}

func TestProjectWorkingMVP_Scenario3_LegacySnapshotCompatibility(t *testing.T) {
	svc, _, store, _ := newProjectService(t, false)
	legacy := session.New("legacy", session.ModeDefault, "/project", session.Limits{}, time.Unix(1, 0))
	if err := store.Save(context.Background(), legacy); err != nil {
		t.Fatal(err)
	}
	got, err := svc.GetSession(context.Background(), legacy.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Project != nil {
		t.Fatalf("legacy snapshot Project = %#v", got.Project)
	}
	if _, err := svc.StartRun(context.Background(), legacy.ID, "continue"); err != nil {
		t.Fatalf("legacy run = %v", err)
	}

	snap, err := sessnap.Of(legacy)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(snap)
	if err != nil {
		t.Fatal(err)
	}
	var decoded sessnap.Snapshot
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	restored, err := decoded.Restore()
	if err != nil || restored.Project != nil {
		t.Fatalf("legacy sessnap restore = %#v, %v", restored, err)
	}
	folded, err := eventsource.Fold(eventsource.SessionMeta{
		ID: "legacy-event", Mode: session.ModeDefault, Workspace: "/project", Limits: session.Limits{}, CreatedAt: time.Unix(1, 0),
	}, func(func(session.Event, error) bool) {})
	if err != nil || folded.Project != nil {
		t.Fatalf("legacy event metadata fold = %#v, %v", folded, err)
	}
}
