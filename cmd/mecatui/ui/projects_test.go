package ui

import (
	"context"
	"errors"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/exp/teatest/v2"
	"google.golang.org/grpc"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/app"
)

type fakeProjects struct {
	projects              []client.Project
	sources               []client.ProjectSource
	sessions              []client.SessionListItem
	createName, createRef string
	replaceName           string
	deleteRevision        int64
	replaceErr            error
}

func (f *fakeProjects) ListProjectSources(context.Context) ([]client.ProjectSource, error) {
	return f.sources, nil
}
func (f *fakeProjects) ListProjectPage(context.Context, string) (client.ProjectPage, error) {
	return client.ProjectPage{Projects: f.projects, TotalCount: len(f.projects)}, nil
}
func (f *fakeProjects) GetProject(_ context.Context, id string) (client.Project, error) {
	for _, p := range f.projects {
		if p.ID == id {
			return p, nil
		}
	}
	return client.Project{}, errors.New("missing")
}
func (f *fakeProjects) CreateProject(_ context.Context, n, r string) (client.Project, error) {
	f.createName, f.createRef = n, r
	p := client.Project{ID: "new", Name: n, Working: client.ProjectSource{Ref: r, Label: "safe"}, Revision: 1}
	f.projects = append(f.projects, p)
	return p, nil
}
func (f *fakeProjects) ReplaceProject(_ context.Context, p client.Project, n, r string) (client.Project, error) {
	f.replaceName = n
	if f.replaceErr != nil {
		return client.Project{}, f.replaceErr
	}
	p.Name = n
	p.Working.Ref = r
	p.Revision++
	return p, nil
}
func (f *fakeProjects) DeleteProject(_ context.Context, _ string, r int64) error {
	f.deleteRevision = r
	return nil
}
func (f *fakeProjects) ListProjectSessionPage(context.Context, string, string) (client.SessionInventoryPage, error) {
	return client.SessionInventoryPage{Sessions: f.sessions, TotalCount: len(f.sessions)}, nil
}
func (*fakeProjects) CreateProjectSession(context.Context, string, string, client.ModelSelection) (client.ProjectSessionResult, error) {
	return client.ProjectSessionResult{SessionID: "project-session"}, nil
}

func projectTestModel(f *fakeProjects, caps client.Capabilities) Model {
	return Model{deps: Deps{Projects: f, Transcript: &fakeSessionTranscriptLoader{}, Ctx: context.Background(), Theme: theme.New("aztec", theme.AztecPalette())}, caps: caps, keys: defaultKeys(), phase: phaseIdle, width: 80}
}
func projectKey(s string) tea.KeyPressMsg {
	if s == "enter" {
		return tea.KeyPressMsg{Code: tea.KeyEnter}
	}
	if s == "esc" {
		return tea.KeyPressMsg{Code: tea.KeyEscape}
	}
	return tea.KeyPressMsg{Code: rune(s[0]), Text: s}
}

func TestInvariant_mecatui_projects_keep_proto_boundary(t *testing.T) {
	body, err := os.ReadFile("projects.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"contracts/gen", "internal/", "workspace", "environmentref", "source_locator"} {
		if strings.Contains(strings.ToLower(string(body)), forbidden) {
			t.Fatalf("projects UI contains forbidden boundary term %q", forbidden)
		}
	}
}

func TestProjectWorkingMVP_Scenario6_MecatuiCapabilityGate(t *testing.T) {
	f := &fakeProjects{}
	if _, ok := builtinByName(client.Capabilities{}, wiredCollaborators{Projects: true}, "projects"); ok {
		t.Fatal("projects exposed without capability")
	}
	if _, ok := builtinByName(client.Capabilities{Projects: true}, wiredCollaborators{Projects: true}, "projects"); !ok {
		t.Fatal("projects hidden")
	}
	m := projectTestModel(f, client.Capabilities{})
	if _, cmd := m.openProjects(); cmd != nil {
		t.Fatal("unsupported server started RPC")
	}
}
func TestProjectWorkingMVP_Scenario6_MecatuiCreatePathFree(t *testing.T) {
	f := &fakeProjects{sources: []client.ProjectSource{{Ref: "opaque-ref", Label: "Working source", Working: true}}}
	m := projectTestModel(f, client.Capabilities{Projects: true})
	m.projects = projectsState{view: projectsCreate, sources: f.sources, name: projectInput("My project", "")}
	mm, cmd, _ := m.onProjectsKey(projectKey("enter"))
	msg := cmd()
	_, _, _ = mm.(Model).updateProjectsMsg(msg)
	if f.createName != "My project" || f.createRef != "opaque-ref" {
		t.Fatalf("create = %q %q", f.createName, f.createRef)
	}
}
func TestProjectWorkingMVP_Scenario6_MecatuiProjectSessions(t *testing.T) {
	row := client.SessionListItem{ID: "s1", Title: "chat", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}}
	f := &fakeProjects{sessions: []client.SessionListItem{row}}
	m := projectTestModel(f, client.Capabilities{Projects: true})
	m.projects = projectsState{view: projectsDetail, selected: client.Project{ID: "p"}, sessions: f.sessions}
	mm, _, handled := m.onProjectsKey(projectKey("enter"))
	if !handled || mm.(Model).sessions.selected.ID != "s1" {
		t.Fatal("project session did not use existing transcript lifecycle")
	}
}
func TestProjectWorkingMVP_Scenario6_MecatuiConflictRecovery(t *testing.T) {
	f := &fakeProjects{replaceErr: client.ErrProjectConflict}
	p := client.Project{ID: "p", Name: "old", Revision: 4, Working: client.ProjectSource{Ref: "r"}}
	m := projectTestModel(f, client.Capabilities{Projects: true})
	m.projects = projectsState{view: projectsEdit, selected: p, sources: []client.ProjectSource{{Ref: "r", Working: true}}, name: projectInput("draft", "")}
	mm, cmd, _ := m.onProjectsKey(projectKey("enter"))
	mm2, _, _ := mm.(Model).updateProjectsMsg(cmd())
	got := mm2.(Model)
	if got.projects.view != projectsConflict || got.projects.draftName != "draft" {
		t.Fatalf("conflict state = %#v", got.projects)
	}
}
func TestProjectWorkingMVP_Scenario6_MecatuiDeleteNonCascading(t *testing.T) {
	f := &fakeProjects{}
	p := client.Project{ID: "p", Name: "P", Revision: 7}
	m := projectTestModel(f, client.Capabilities{Projects: true})
	m.projects = projectsState{view: projectsDelete, selected: p, projects: []client.Project{p}}
	mm, cmd, _ := m.onProjectsKey(projectKey("y"))
	got, _, _ := mm.(Model).updateProjectsMsg(cmd())
	if f.deleteRevision != 7 || got.(Model).projects.view != projectsList || !strings.Contains(got.(Model).statusMsg, "sessions remain") {
		t.Fatal("delete did not preserve non-cascade message")
	}
}

type realProjectSessionCreator struct {
	client    *client.Client
	workspace string
}

func (s realProjectSessionCreator) CreateSession(ctx context.Context, selection client.ModelSelection, mode string) (string, client.Capabilities, client.ResolvedModel, error) {
	return s.CreateSessionInWorkspace(ctx, s.workspace, selection, mode)
}
func (s realProjectSessionCreator) CreateSessionInWorkspace(ctx context.Context, workspace string, selection client.ModelSelection, mode string) (string, client.Capabilities, client.ResolvedModel, error) {
	return s.client.CreateSession(ctx, workspace, client.ModeFromString(mode), selection)
}
func (s realProjectSessionCreator) CreateSessionWithCarryover(ctx context.Context, sourceID string, selection client.ModelSelection, mode string) (string, client.Capabilities, client.ResolvedModel, error) {
	return s.client.CreateSessionWithCarryover(ctx, s.workspace, client.ModeFromString(mode), selection, sourceID)
}
func (s realProjectSessionCreator) CloseSession(ctx context.Context, id string) error {
	return s.client.CloseSession(ctx, id)
}
func (s realProjectSessionCreator) GetSession(ctx context.Context, id string) (client.SessionSnapshot, error) {
	return s.client.GetSession(ctx, id)
}
func (s realProjectSessionCreator) SetMode(ctx context.Context, id, mode string) (string, error) {
	return s.client.SetMode(ctx, id, mode)
}
func (s realProjectSessionCreator) ForkSession(ctx context.Context, id, effort string) (string, error) {
	return s.client.ForkSession(ctx, id, "", effort)
}

func waitProjectUI(t *testing.T, tm *teatest.TestModel, text string) {
	t.Helper()
	teatest.WaitFor(t, tm.Output(), func(out []byte) bool { return strings.Contains(string(out), text) }, teatest.WithDuration(scaleWait(5*time.Second)))
}

func waitProjectPhase(t *testing.T, phases <-chan phase, want phase) {
	t.Helper()
	timer := time.NewTimer(scaleWait(5 * time.Second))
	defer timer.Stop()
	for {
		select {
		case got := <-phases:
			if got == want {
				return
			}
		case <-timer.C:
			t.Fatalf("timed out waiting for phase %s", phaseName(want))
		}
	}
}

func TestProjectWorkingMVP_Scenario6_MecatuiEndToEnd(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	root := t.TempDir()
	built, err := app.Build(ctx, app.Config{Workspace: root, StoreDir: t.TempDir(), UseMock: true, NoSoul: true, EnableLocalProjects: true})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(built.Close)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	grpcServer := grpc.NewServer()
	mecatlv1.RegisterHarnessServiceServer(grpcServer, server.NewHarnessServer(built.Service))
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(func() {
		grpcServer.Stop()
		_ = listener.Close()
	})

	cl, err := client.Dial(client.DialConfig{Server: listener.Addr().String()})
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	t.Cleanup(func() { _ = cl.Close() })

	// Capability discovery is deliberately session-free: no ordinary or Project
	// Session exists until after this call has advertised the path-free surface.
	caps, err := cl.GetServerCapabilities(ctx)
	if err != nil || !caps.Projects {
		t.Fatalf("session-free capabilities = %+v, %v", caps, err)
	}
	if sessions, listErr := cl.ListSessions(ctx); listErr != nil || len(sessions) != 0 {
		t.Fatalf("capability discovery created sessions: %+v, %v", sessions, listErr)
	}

	phases := make(chan phase, 64)
	lastPhase := phase(-1)
	m := New(Deps{
		Session: realProjectSessionCreator{client: cl, workspace: root}, Capabilities: cl, Conv: cl, Projects: cl, Sessions: cl, Transcript: cl,
		Theme: theme.New("aztec", theme.AztecPalette()), Workspace: root, Mode: "default", Ctx: ctx, NoAltScreen: true,
		onPhase: func(p phase) {
			if p != lastPhase {
				lastPhase = p
				phases <- p
			}
		},
	})
	tm := teatest.NewTestModel(t, m, teatest.WithInitialTermSize(100, 30))
	waitProjectPhase(t, phases, phaseIdle)
	startupSessions, err := cl.ListSessions(ctx)
	if err != nil || len(startupSessions) != 1 {
		t.Fatalf("startup sessions = %+v, %v", startupSessions, err)
	}
	startupID := startupSessions[0].ID

	// Empty inventory → create → list/detail, all through Bubble Tea commands and
	// the real cmd/mecatui/client over the in-process gRPC server.
	tm.Type("/projects")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "No projects yet")
	tm.Send(projectKey("c"))
	waitProjectUI(t, tm, "create project")
	tm.Type("Original")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "No sessions yet")

	page, err := cl.ListProjectPage(ctx, "")
	if err != nil || len(page.Projects) != 1 || page.Projects[0].Name != "Original" {
		t.Fatalf("created Project page = %+v, %v", page, err)
	}
	projectDoc := page.Projects[0]

	// Rename through the form, then force a stale-revision conflict from a second
	// real client operation while the draft is open. Reload preserves and saves it.
	tm.Send(projectKey("e"))
	waitProjectUI(t, tm, "edit project")
	tm.Send(tea.KeyPressMsg{Code: 'u', Mod: tea.ModCtrl})
	tm.Type("Renamed")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "revision 2")

	tm.Send(projectKey("e"))
	waitProjectUI(t, tm, "edit project")
	tm.Send(tea.KeyPressMsg{Code: 'u', Mod: tea.ModCtrl})
	tm.Type("Draft after conflict")
	latest, err := cl.GetProject(ctx, projectDoc.ID)
	if err != nil {
		t.Fatalf("GetProject before conflict: %v", err)
	}
	if _, err = cl.ReplaceProject(ctx, latest, "External rename", latest.Working.Ref); err != nil {
		t.Fatalf("external ReplaceProject: %v", err)
	}
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "Revision conflict")
	tm.Send(projectKey("r"))
	waitProjectUI(t, tm, "name: > Draft after conflict")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "revision 4")

	// Create a Project Session from detail. The UI rebinds to that new session.
	tm.Send(projectKey("s"))
	waitProjectPhase(t, phases, phaseConnecting)
	waitProjectPhase(t, phases, phaseIdle)
	filtered, err := cl.ListProjectSessionPage(ctx, projectDoc.ID, "")
	if err != nil || len(filtered.Sessions) != 1 || filtered.Sessions[0].ProjectID != projectDoc.ID {
		t.Fatalf("filtered Project sessions = %+v, %v", filtered, err)
	}
	projectSessionID := filtered.Sessions[0].ID
	if _, err := cl.RenameSession(ctx, projectSessionID, "Project chat only"); err != nil {
		t.Fatalf("RenameSession: %v", err)
	}

	// Re-open and continue from the filtered row. The unrelated startup session is
	// absent from the panel, and transcript continuation does not create another.
	tm.Type("/projects")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "> Draft after conflict")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "Project chat only")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectPhase(t, phases, phaseReplay)
	waitProjectPhase(t, phases, phaseIdle)
	filtered, err = cl.ListProjectSessionPage(ctx, projectDoc.ID, "")
	if err != nil || len(filtered.Sessions) != 1 || filtered.Sessions[0].ID != projectSessionID {
		t.Fatalf("continued Project sessions = %+v, %v", filtered, err)
	}

	// Delete only the Project document. Its captured Session remains globally
	// navigable and authoritative after the UI confirms the non-cascading action.
	tm.Type("/projects")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "> Draft after conflict")
	tm.Send(tea.KeyPressMsg{Code: tea.KeyEnter})
	waitProjectUI(t, tm, "Project chat only")
	tm.Send(projectKey("d"))
	waitProjectUI(t, tm, "Sessions are not deleted")
	tm.Send(projectKey("y"))
	waitProjectUI(t, tm, "sessions remain in /sessions")
	if _, err := cl.GetSessionTranscript(ctx, projectSessionID); err != nil {
		t.Fatalf("Project Session cascaded with Project delete: %v", err)
	}
	all, err := cl.ListSessions(ctx)
	if err != nil || len(all) != 2 {
		t.Fatalf("global sessions after delete = %+v, %v", all, err)
	}
	var sawStartup, sawProject bool
	for _, item := range all {
		sawStartup = sawStartup || item.ID == startupID
		sawProject = sawProject || item.ID == projectSessionID && item.ProjectID == projectDoc.ID
	}
	if !sawStartup || !sawProject {
		t.Fatalf("global navigation lost sessions: %+v", all)
	}

	tm.Send(tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl})
	tm.Send(tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl})
	tm.WaitFinished(t, teatest.WithFinalTimeout(scaleWait(5*time.Second)))
	final := tm.FinalModel(t).(Model)
	if !final.caps.Projects || final.sessionID != projectSessionID {
		t.Fatalf("final UI binding/capabilities = session %q caps %+v", final.sessionID, final.caps)
	}
}

func TestProjectWorkingMVP_Scenario6_MecatuiViewStates(t *testing.T) {
	states := []struct {
		name string
		st   projectsState
		caps client.Capabilities
	}{
		{"list", projectsState{view: projectsList, projects: []client.Project{{Name: "Alpha", Working: client.ProjectSource{Label: "Repository"}}}}, client.Capabilities{Projects: true}},
		{"empty", projectsState{view: projectsList}, client.Capabilities{Projects: true}},
		{"loading", projectsState{view: projectsList, loading: true}, client.Capabilities{Projects: true}},
		{"detail", projectsState{view: projectsDetail, selected: client.Project{Name: "bad\x1b[31m", Revision: 1}}, client.Capabilities{Projects: true}},
		{"create", projectsState{view: projectsCreate, name: projectInput("", ""), sources: []client.ProjectSource{{Label: "Repository"}}}, client.Capabilities{Projects: true}},
		{"edit", projectsState{view: projectsEdit, name: projectInput("draft", ""), sources: []client.ProjectSource{{Label: "Repository"}}}, client.Capabilities{Projects: true}},
		{"conflict", projectsState{view: projectsConflict, draftName: "draft"}, client.Capabilities{Projects: true}},
		{"delete", projectsState{view: projectsDelete, selected: client.Project{Name: "P"}}, client.Capabilities{Projects: true}},
		{"unsupported", projectsState{view: projectsList}, client.Capabilities{}},
		{"error-action-loading", projectsState{view: projectsList, err: errors.New("boom\x1b"), actionLoading: true}, client.Capabilities{Projects: true}},
	}
	var golden strings.Builder
	for i, tc := range states {
		out := renderProjectsOverlay(theme.New("aztec", theme.AztecPalette()), tc.st, tc.caps, 24)
		if strings.Contains(out, "\x1b[31m") {
			t.Fatalf("state %d leaked controls", i)
		}
		golden.WriteString("=== " + tc.name + " ===\n" + stripANSIstr(out) + "\n")
	}
	if !strings.Contains(golden.String(), "not supported") {
		t.Fatal("unsupported state absent")
	}
	compareGolden(t, "projects_states.golden", []byte(golden.String()))
}
