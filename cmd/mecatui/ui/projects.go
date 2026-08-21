package ui

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
)

type projectsView int

const (
	projectsNone projectsView = iota
	projectsList
	projectsDetail
	projectsCreate
	projectsEdit
	projectsConflict
	projectsDelete
)

type projectsState struct {
	view                   projectsView
	loading, actionLoading bool
	err                    error
	projects               []client.Project
	cursor                 int
	nextCursor             string
	selected               client.Project
	sources                []client.ProjectSource
	sourceCursor           int
	name                   textinput.Model
	draftName, draftSource string
	sessions               []client.SessionListItem
	sessionCursor          int
	sessionNextCursor      string
}

type projectsPageMsg struct {
	page   client.ProjectPage
	cursor string
	err    error
}
type projectSourcesMsg struct {
	sources []client.ProjectSource
	err     error
}
type projectMutationMsg struct {
	project client.Project
	deleted bool
	err     error
}
type projectReloadMsg struct {
	project client.Project
	err     error
}
type projectSessionsMsg struct {
	page   client.SessionInventoryPage
	cursor string
	err    error
}
type projectSessionCreatedMsg struct {
	result client.ProjectSessionResult
	err    error
}

func projectPageCmd(ctx context.Context, c client.ProjectClient, cursor string) tea.Cmd {
	return func() tea.Msg { p, e := c.ListProjectPage(ctx, cursor); return projectsPageMsg{p, cursor, e} }
}
func projectSourcesCmd(ctx context.Context, c client.ProjectClient) tea.Cmd {
	return func() tea.Msg { s, e := c.ListProjectSources(ctx); return projectSourcesMsg{s, e} }
}
func projectSessionsCmd(ctx context.Context, c client.ProjectClient, id, cursor string) tea.Cmd {
	return func() tea.Msg {
		p, e := c.ListProjectSessionPage(ctx, id, cursor)
		return projectSessionsMsg{p, cursor, e}
	}
}

func (m Model) openProjects() (tea.Model, tea.Cmd) {
	if m.phase != phaseIdle || m.deps.Projects == nil || !m.caps.Projects {
		return m, nil
	}
	m.ta.Blur()
	m.projects = projectsState{view: projectsList, loading: true}
	return m, tea.Batch(projectPageCmd(m.deps.Ctx, m.deps.Projects, ""), projectSourcesCmd(m.deps.Ctx, m.deps.Projects))
}
func (m Model) runProjects() (tea.Model, tea.Cmd) { return m.openProjects() }

func (m Model) closeProjects() (tea.Model, tea.Cmd) {
	m.projects = projectsState{}
	return m, m.ta.Focus()
}

func projectInput(value, placeholder string) textinput.Model {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.SetWidth(48)
	ti.SetValue(value)
	ti.Focus()
	return ti
}

//nolint:gocyclo // keyboard states are explicit and mutually exclusive
func (m Model) onProjectsKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd, bool) {
	if m.projects.view == projectsNone {
		return m, nil, false
	}
	if m.projects.actionLoading {
		return m, nil, true
	}
	switch m.projects.view {
	case projectsCreate, projectsEdit:
		return m.onProjectFormKey(msg)
	case projectsConflict:
		switch {
		case msg.String() == "r":
			m.projects.actionLoading = true
			id := m.projects.selected.ID
			return m, func() tea.Msg { p, e := m.deps.Projects.GetProject(m.deps.Ctx, id); return projectReloadMsg{p, e} }, true
		case key.Matches(msg, m.keys.Close):
			m.projects.view = projectsEdit
			m.projects.name = projectInput(m.projects.draftName, "project name")
			return m, nil, true
		}
		return m, nil, true
	case projectsDelete:
		switch {
		case msg.String() == "y":
			p := m.projects.selected
			m.projects.actionLoading = true
			return m, func() tea.Msg {
				e := m.deps.Projects.DeleteProject(m.deps.Ctx, p.ID, p.Revision)
				return projectMutationMsg{deleted: e == nil, err: e}
			}, true
		case key.Matches(msg, m.keys.Close), msg.String() == "n":
			m.projects.view = projectsDetail
			return m, nil, true
		}
		return m, nil, true
	case projectsList:
		switch {
		case key.Matches(msg, m.keys.Close):
			mm, c := m.closeProjects()
			return mm, c, true
		case msg.String() == "up":
			if m.projects.cursor > 0 {
				m.projects.cursor--
			}
			return m, nil, true
		case msg.String() == "down":
			if m.projects.cursor < len(m.projects.projects)-1 {
				m.projects.cursor++
			}
			return m, nil, true
		case msg.String() == "c":
			m.projects.view = projectsCreate
			m.projects.name = projectInput("", "project name")
			m.projects.loading = true
			return m, projectSourcesCmd(m.deps.Ctx, m.deps.Projects), true
		case msg.String() == "n" && m.projects.nextCursor != "":
			m.projects.loading = true
			return m, projectPageCmd(m.deps.Ctx, m.deps.Projects, m.projects.nextCursor), true
		case key.Matches(msg, m.keys.Choose):
			if m.projects.cursor < len(m.projects.projects) {
				p := m.projects.projects[m.projects.cursor]
				m.projects.selected = p
				m.projects.view = projectsDetail
				m.projects.loading = true
				m.projects.sessions = nil
				return m, projectSessionsCmd(m.deps.Ctx, m.deps.Projects, p.ID, ""), true
			}
			return m, nil, true
		}
	case projectsDetail:
		switch {
		case key.Matches(msg, m.keys.Close):
			m.projects.view = projectsList
			m.projects.err = nil
			return m, nil, true
		case msg.String() == "up":
			if m.projects.sessionCursor > 0 {
				m.projects.sessionCursor--
			}
			return m, nil, true
		case msg.String() == "down":
			if m.projects.sessionCursor < len(m.projects.sessions)-1 {
				m.projects.sessionCursor++
			}
			return m, nil, true
		case msg.String() == "p" && m.projects.sessionNextCursor != "":
			m.projects.loading = true
			p := m.projects.selected
			return m, projectSessionsCmd(m.deps.Ctx, m.deps.Projects, p.ID, m.projects.sessionNextCursor), true
		case msg.String() == "e":
			p := m.projects.selected
			m.projects.view = projectsEdit
			m.projects.draftName = p.Name
			m.projects.draftSource = p.Working.Ref
			for i, source := range m.projects.sources {
				if source.Ref == p.Working.Ref {
					m.projects.sourceCursor = i
					break
				}
			}
			m.projects.name = projectInput(p.Name, "project name")
			return m, nil, true
		case msg.String() == "d":
			m.projects.view = projectsDelete
			return m, nil, true
		case msg.String() == "s":
			p := m.projects.selected
			m.projects.actionLoading = true
			return m, func() tea.Msg {
				r, e := m.deps.Projects.CreateProjectSession(m.deps.Ctx, p.ID, m.desiredMode(), m.activeModel)
				return projectSessionCreatedMsg{r, e}
			}, true
		case key.Matches(msg, m.keys.Choose):
			if m.projects.sessionCursor < len(m.projects.sessions) {
				row := m.projects.sessions[m.projects.sessionCursor]
				if row.Capabilities.PublicChat {
					m.projects = projectsState{}
					return m.loadSessionTranscript(row, false)
				}
			}
			return m, nil, true
		}
	}
	return m, nil, true
}

func (m Model) onProjectFormKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd, bool) {
	if key.Matches(msg, m.keys.Close) {
		if m.projects.view == projectsEdit {
			m.projects.view = projectsDetail
		} else {
			m.projects.view = projectsList
		}
		return m, nil, true
	}
	if msg.String() == "up" && m.projects.sourceCursor > 0 {
		m.projects.sourceCursor--
		return m, nil, true
	}
	if msg.String() == "down" && m.projects.sourceCursor < len(m.projects.sources)-1 {
		m.projects.sourceCursor++
		return m, nil, true
	}
	if key.Matches(msg, m.keys.Choose) {
		name := m.projects.name.Value()
		if name == "" || len(m.projects.sources) == 0 {
			return m, nil, true
		}
		src := m.projects.sources[m.projects.sourceCursor].Ref
		m.projects.draftName = name
		m.projects.draftSource = src
		m.projects.actionLoading = true
		if m.projects.view == projectsCreate {
			return m, func() tea.Msg {
				p, e := m.deps.Projects.CreateProject(m.deps.Ctx, name, src)
				return projectMutationMsg{project: p, err: e}
			}, true
		}
		displayed := m.projects.selected
		return m, func() tea.Msg {
			p, e := m.deps.Projects.ReplaceProject(m.deps.Ctx, displayed, name, src)
			return projectMutationMsg{project: p, err: e}
		}, true
	}
	var cmd tea.Cmd
	m.projects.name, cmd = m.projects.name.Update(msg)
	m.projects.draftName = m.projects.name.Value()
	return m, cmd, true
}

//nolint:gocyclo // each asynchronous Project message has one explicit state transition
func (m Model) updateProjectsMsg(msg tea.Msg) (tea.Model, tea.Cmd, bool) {
	switch v := msg.(type) {
	case projectsPageMsg:
		m.projects.loading = false
		m.projects.err = v.err
		if v.err == nil {
			if v.cursor == "" {
				m.projects.projects = nil
			}
			m.projects.projects = append(m.projects.projects, v.page.Projects...)
			m.projects.nextCursor = v.page.NextCursor
		}
		return m, nil, true
	case projectSourcesMsg:
		m.projects.loading = false
		m.projects.err = v.err
		if v.err == nil {
			m.projects.sources = v.sources
		}
		return m, nil, true
	case projectSessionsMsg:
		m.projects.loading = false
		m.projects.err = v.err
		if v.err == nil {
			if v.cursor == "" {
				m.projects.sessions = nil
			}
			m.projects.sessions = append(m.projects.sessions, v.page.Sessions...)
			m.projects.sessionNextCursor = v.page.NextCursor
		}
		return m, nil, true
	case projectMutationMsg:
		m.projects.actionLoading = false
		if v.err != nil {
			if errors.Is(v.err, client.ErrProjectConflict) {
				m.projects.view = projectsConflict
			} else {
				m.projects.err = v.err
			}
			return m, nil, true
		}
		if v.deleted {
			id := m.projects.selected.ID
			out := m.projects.projects[:0]
			for _, p := range m.projects.projects {
				if p.ID != id {
					out = append(out, p)
				}
			}
			m.projects.projects = out
			m.projects.view = projectsList
			m.projects.selected = client.Project{}
			m.statusMsg = "project deleted; its sessions remain in /sessions"
			return m, nil, true
		}
		m.projects.selected = v.project
		found := false
		for i := range m.projects.projects {
			if m.projects.projects[i].ID == v.project.ID {
				m.projects.projects[i] = v.project
				found = true
			}
		}
		if !found {
			m.projects.projects = append([]client.Project{v.project}, m.projects.projects...)
		}
		m.projects.view = projectsDetail
		m.projects.loading = true
		return m, projectSessionsCmd(m.deps.Ctx, m.deps.Projects, v.project.ID, ""), true
	case projectReloadMsg:
		m.projects.actionLoading = false
		if v.err != nil {
			m.projects.err = v.err
			return m, nil, true
		}
		m.projects.selected = v.project
		m.projects.view = projectsEdit
		m.projects.name = projectInput(m.projects.draftName, "project name")
		return m, nil, true
	case projectSessionCreatedMsg:
		m.projects.actionLoading = false
		if v.err != nil {
			m.projects.err = v.err
			return m, nil, true
		}
		m = m.endRun("")
		m = m.resetSession()
		m = m.bindSessionID("")
		m.projects = projectsState{}
		m.phase = phaseConnecting
		m.restartedThisRun = true
		return m, func() tea.Msg {
			return client.SessionReadyMsg{SessionID: v.result.SessionID, Capabilities: v.result.Capabilities, ResolvedModel: v.result.ResolvedModel, Mode: m.desiredMode()}
		}, true
	}
	return m, nil, false
}

func safeProjectText(s string, n int) string {
	s = sanitizeTerminal(s)
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:max(1, n-1)]) + "…"
}

//nolint:gocyclo // rendering mirrors the closed overlay-state enum
func renderProjectsOverlay(th theme.Theme, st projectsState, caps client.Capabilities, width int) string {
	var b strings.Builder
	b.WriteString(th.Style("title").Render("projects") + "\n")
	if !caps.Projects {
		return b.String() + th.Style("muted").Render("Projects are not supported by this server.")
	}
	if st.loading {
		b.WriteString(th.Style("muted").Render("loading…") + "\n")
	}
	if st.err != nil {
		b.WriteString(th.Style("errorText").Render(safeProjectText(st.err.Error(), max(12, width-4))) + "\n")
	}
	if st.actionLoading {
		b.WriteString(th.Style("muted").Render("saving… (actions disabled)") + "\n")
	}
	switch st.view {
	case projectsCreate, projectsEdit:
		label := "create project"
		if st.view == projectsEdit {
			label = "edit project"
		}
		b.WriteString(label + "\nname: " + st.name.View() + "\nworking source:\n")
		for i, s := range st.sources {
			mark := "  "
			if i == st.sourceCursor {
				mark = "> "
			}
			b.WriteString(mark + safeProjectText(s.Label, max(8, width-6)) + "\n")
		}
		b.WriteString("\n↑/↓ source · enter save · esc back")
	case projectsConflict:
		b.WriteString(th.Style("errorText").Render("Revision conflict: the project changed on the server.") + "\nYour draft is retained.\nr: reload latest revision · esc: back to draft")
	case projectsDelete:
		b.WriteString("Delete " + safeProjectText(st.selected.Name, max(8, width-10)) + "?\nSessions are not deleted and remain in /sessions.\ny: confirm · n/esc: back")
	case projectsDetail:
		p := st.selected
		b.WriteString(safeProjectText(p.Name, max(8, width-2)) + "\n" + safeProjectText(p.Working.Label, max(8, width-2)) + fmt.Sprintf(" · revision %d\n\n", p.Revision))
		if len(st.sessions) == 0 && !st.loading {
			b.WriteString(th.Style("muted").Render("No sessions yet. Press s to create one.") + "\n")
		}
		for i, s := range st.sessions {
			mark := "  "
			if i == st.sessionCursor {
				mark = "> "
			}
			title := s.Title
			if title == "" {
				title = s.ID
			}
			b.WriteString(mark + safeProjectText(title, max(8, width-8)) + "  " + safeProjectText(s.State, 12) + "\n")
		}
		b.WriteString("\nenter continue · s new session · e edit · d delete · p more · esc back")
	default:
		if len(st.projects) == 0 && !st.loading {
			b.WriteString(th.Style("muted").Render("No projects yet. Press c to create one.") + "\n")
		}
		for i, p := range st.projects {
			mark := "  "
			if i == st.cursor {
				mark = "> "
			}
			b.WriteString(mark + safeProjectText(p.Name, max(8, width-8)) + "  " + safeProjectText(p.Working.Label, 20) + "\n")
		}
		b.WriteString("\n↑/↓ select · enter open · c create · n more · esc close")
	}
	return ansi.Hardwrap(b.String(), max(1, width), false)
}
