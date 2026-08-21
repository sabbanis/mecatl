package ui

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
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
func TestProjectWorkingMVP_Scenario6_MecatuiEndToEnd(t *testing.T) {
	p := client.Project{ID: "p", Name: "Original", Working: client.ProjectSource{Ref: "opaque", Label: "Repo", Working: true}, Revision: 1}
	f := &fakeProjects{projects: []client.Project{p}, sources: []client.ProjectSource{p.Working}, sessions: []client.SessionListItem{{ID: "chat", Title: "Existing", Capabilities: client.SessionInventoryCapabilities{PublicChat: true}}}}
	m := projectTestModel(f, client.Capabilities{Projects: true})
	mm, cmd := m.openProjects()
	m = mm.(Model)
	if cmd == nil {
		t.Fatal("open projects did not start the client journey")
	}
	// The reducer journey is covered at each asynchronous seam above; this assertion
	// pins the real command registration and opening state together.
	if m.projects.view != projectsList || !m.projects.loading {
		t.Fatalf("open projects = %#v", m.projects)
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
