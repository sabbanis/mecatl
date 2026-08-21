package client

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
)

const projectPageSize int32 = 50

// ErrProjectConflict reports an optimistic-revision conflict. Callers must
// explicitly reload before attempting another mutation.
var ErrProjectConflict = errors.New("project changed on the server")

// ProjectSource is locator-free metadata for a server-advertised working source.
type ProjectSource struct {
	Ref     string
	Label   string
	Working bool
}

// Project is the proto-free public projection of one durable Project.
type Project struct {
	ID        string
	Name      string
	Working   ProjectSource
	Revision  int64
	CreatedAt int64
	UpdatedAt int64
}

// ProjectPage is one independently paged Project inventory response.
type ProjectPage struct {
	Projects   []Project
	NextCursor string
	TotalCount int
}

// ProjectSessionResult carries the existing session-lifecycle bootstrap values.
type ProjectSessionResult struct {
	SessionID     string
	Capabilities  Capabilities
	ResolvedModel ResolvedModel
}

// ProjectClient is the complete path-free Project surface consumed by the UI.
type ProjectClient interface {
	ListProjectSources(context.Context) ([]ProjectSource, error)
	ListProjectPage(context.Context, string) (ProjectPage, error)
	GetProject(context.Context, string) (Project, error)
	CreateProject(context.Context, string, string) (Project, error)
	ReplaceProject(context.Context, Project, string, string) (Project, error)
	DeleteProject(context.Context, string, int64) error
	ListProjectSessionPage(context.Context, string, string) (SessionInventoryPage, error)
	CreateProjectSession(context.Context, string, string, ModelSelection) (ProjectSessionResult, error)
}

func projectSourceFromProto(s *mecatlv1.ProjectSource) ProjectSource {
	if s == nil {
		return ProjectSource{}
	}
	return ProjectSource{Ref: s.GetSourceRef(), Label: validText(s.GetLabel()), Working: s.GetWorking()}
}

func projectFromProto(p *mecatlv1.Project) Project {
	if p == nil {
		return Project{}
	}
	return Project{ID: p.GetProjectId(), Name: validText(p.GetName()), Working: projectSourceFromProto(p.GetWorking()), Revision: p.GetRevision(), CreatedAt: p.GetCreatedAtUnix(), UpdatedAt: p.GetUpdatedAtUnix()}
}

func projectErr(op string, err error) error {
	if status.Code(err) == codes.Aborted {
		return fmt.Errorf("%s: %w", op, ErrProjectConflict)
	}
	return fmt.Errorf("%s: %w", op, err)
}

// ListProjectSources returns only eligible working sources.
func (c *Client) ListProjectSources(ctx context.Context) ([]ProjectSource, error) {
	resp, err := c.svc.ListProjectSources(ctx, &mecatlv1.ListProjectSourcesRequest{})
	if err != nil {
		return nil, projectErr("list project sources", err)
	}
	out := make([]ProjectSource, 0, len(resp.GetSources()))
	for _, s := range resp.GetSources() {
		if v := projectSourceFromProto(s); v.Working {
			out = append(out, v)
		}
	}
	return out, nil
}

// ListProjectPage returns one bounded Project page.
func (c *Client) ListProjectPage(ctx context.Context, cursor string) (ProjectPage, error) {
	resp, err := c.svc.ListProjects(ctx, &mecatlv1.ListProjectsRequest{PageSize: projectPageSize, Cursor: cursor})
	if err != nil {
		return ProjectPage{}, projectErr("list projects", err)
	}
	if resp.GetNextCursor() != "" && resp.GetNextCursor() == cursor {
		return ProjectPage{}, errors.New("list projects: server repeated cursor")
	}
	out := make([]Project, 0, len(resp.GetProjects()))
	for _, p := range resp.GetProjects() {
		out = append(out, projectFromProto(p))
	}
	return ProjectPage{Projects: out, NextCursor: resp.GetNextCursor(), TotalCount: int(resp.GetTotalCount())}, nil
}

// GetProject reloads one Project by opaque ID.
func (c *Client) GetProject(ctx context.Context, id string) (Project, error) {
	resp, err := c.svc.GetProject(ctx, &mecatlv1.GetProjectRequest{ProjectId: id})
	if err != nil {
		return Project{}, projectErr("get project", err)
	}
	return projectFromProto(resp.GetProject()), nil
}

func newProjectID() (string, error) {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "project-" + hex.EncodeToString(b[:]), nil
}

// CreateProject creates a Project from a name and opaque advertised source reference.
func (c *Client) CreateProject(ctx context.Context, name, sourceRef string) (Project, error) {
	id, err := newProjectID()
	if err != nil {
		return Project{}, fmt.Errorf("create project id: %w", err)
	}
	resp, err := c.svc.CreateProject(ctx, &mecatlv1.CreateProjectRequest{ProjectId: id, Name: name, SourceRef: sourceRef})
	if err != nil {
		return Project{}, projectErr("create project", err)
	}
	return projectFromProto(resp.GetProject()), nil
}

// ReplaceProject replaces a Project using the displayed revision.
func (c *Client) ReplaceProject(ctx context.Context, displayed Project, name, sourceRef string) (Project, error) {
	resp, err := c.svc.ReplaceProject(ctx, &mecatlv1.ReplaceProjectRequest{ProjectId: displayed.ID, Name: name, SourceRef: sourceRef, ExpectedRevision: displayed.Revision})
	if err != nil {
		return Project{}, projectErr("replace project", err)
	}
	return projectFromProto(resp.GetProject()), nil
}

// DeleteProject deletes only the Project at the displayed revision.
func (c *Client) DeleteProject(ctx context.Context, id string, revision int64) error {
	_, err := c.svc.DeleteProject(ctx, &mecatlv1.DeleteProjectRequest{ProjectId: id, ExpectedRevision: revision})
	if err != nil {
		return projectErr("delete project", err)
	}
	return nil
}

// ListProjectSessionPage returns one Session page filtered by Project ID.
func (c *Client) ListProjectSessionPage(ctx context.Context, projectID, cursor string) (SessionInventoryPage, error) {
	resp, err := c.svc.ListSessions(ctx, &mecatlv1.ListSessionsRequest{PageSize: sessionInventoryPageSize, Cursor: cursor, ProjectId: projectID})
	if err != nil {
		return SessionInventoryPage{}, projectErr("list project sessions", err)
	}
	if resp.GetNextCursor() != "" && resp.GetNextCursor() == cursor {
		return SessionInventoryPage{}, errors.New("list project sessions: server repeated cursor")
	}
	return SessionInventoryPage{Sessions: listSessionsFromProto(resp.GetSessions()), NextCursor: resp.GetNextCursor(), TotalCount: int(resp.GetTotalCount())}, nil
}

// CreateProjectSession creates a Session from the server-owned Project binding.
func (c *Client) CreateProjectSession(ctx context.Context, projectID, mode string, sel ModelSelection) (ProjectSessionResult, error) {
	resp, err := c.svc.CreateSessionFromProject(ctx, &mecatlv1.CreateSessionFromProjectRequest{ProjectId: projectID, Mode: ModeFromString(mode), ProviderId: sel.ProviderID, ModelId: sel.ModelID, ReasoningEffort: sel.ReasoningEffort})
	if err != nil {
		return ProjectSessionResult{}, projectErr("create project session", err)
	}
	return ProjectSessionResult{SessionID: resp.GetSessionId(), Capabilities: capabilitiesFrom(resp.GetCapabilities()), ResolvedModel: resolvedModelFrom(resp.GetResolvedModel())}, nil
}

var _ ProjectClient = (*Client)(nil)
