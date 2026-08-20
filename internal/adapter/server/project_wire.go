package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/internal/project"
)

const (
	defaultProjectPageSize = 50
	maxProjectPageSize     = 200
)

// GetServerCapabilities exposes the build-time capability snapshot without
// creating a legacy workspace-bearing Session.
func (h *HarnessServer) GetServerCapabilities(_ context.Context, _ *mecatlv1.GetServerCapabilitiesRequest) (*mecatlv1.GetServerCapabilitiesResponse, error) {
	return &mecatlv1.GetServerCapabilitiesResponse{Capabilities: h.svc.capabilities()}, nil
}

// ListProjectSources returns the bounded locator-free working-source inventory.
func (h *HarnessServer) ListProjectSources(ctx context.Context, _ *mecatlv1.ListProjectSourcesRequest) (*mecatlv1.ListProjectSourcesResponse, error) {
	sources, err := h.svc.ListProjectWorkingSources(ctx)
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.ListProjectSourcesResponse{Sources: toProtoProjectSources(sources)}, nil
}

// CreateProject creates a Project from a registered working source.
func (h *HarnessServer) CreateProject(ctx context.Context, req *mecatlv1.CreateProjectRequest) (*mecatlv1.CreateProjectResponse, error) {
	if req.GetProjectId() == "" || req.GetName() == "" || req.GetSourceRef() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id, name, and source_ref are required")
	}
	item, err := h.svc.CreateProject(ctx, req.GetProjectId(), req.GetName(), project.SourceRef(req.GetSourceRef()))
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.CreateProjectResponse{Project: toProtoProject(item)}, nil
}

// GetProject returns one caller-authorized Project.
func (h *HarnessServer) GetProject(ctx context.Context, req *mecatlv1.GetProjectRequest) (*mecatlv1.GetProjectResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}
	item, err := h.svc.GetProject(ctx, req.GetProjectId())
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.GetProjectResponse{Project: toProtoProject(item)}, nil
}

// ListProjects returns one bounded caller-authorized Project page.
func (h *HarnessServer) ListProjects(ctx context.Context, req *mecatlv1.ListProjectsRequest) (*mecatlv1.ListProjectsResponse, error) {
	pageRequest, err := projectPageRequest(req.GetPageSize(), req.GetCursor())
	if err != nil {
		return nil, toStatus(err)
	}
	page, err := h.svc.ListProjects(ctx, pageRequest)
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.ListProjectsResponse{Projects: toProtoProjects(page.Projects), NextCursor: encodeProjectCursor(page.NextCursor), TotalCount: ClampInt32(page.TotalCount)}, nil
}

// ReplaceProject performs a whole-document revision-checked replacement.
func (h *HarnessServer) ReplaceProject(ctx context.Context, req *mecatlv1.ReplaceProjectRequest) (*mecatlv1.ReplaceProjectResponse, error) {
	if req.GetProjectId() == "" || req.GetName() == "" || req.GetSourceRef() == "" || req.GetExpectedRevision() < 1 {
		return nil, status.Error(codes.InvalidArgument, "project_id, name, source_ref, and positive expected_revision are required")
	}
	item, err := h.svc.ReplaceProject(ctx, req.GetProjectId(), req.GetName(), project.SourceRef(req.GetSourceRef()), req.GetExpectedRevision())
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.ReplaceProjectResponse{Project: toProtoProject(item)}, nil
}

// DeleteProject deletes a Project only at its expected revision.
func (h *HarnessServer) DeleteProject(ctx context.Context, req *mecatlv1.DeleteProjectRequest) (*mecatlv1.DeleteProjectResponse, error) {
	if req.GetProjectId() == "" || req.GetExpectedRevision() < 1 {
		return nil, status.Error(codes.InvalidArgument, "project_id and positive expected_revision are required")
	}
	if err := h.svc.DeleteProject(ctx, req.GetProjectId(), req.GetExpectedRevision()); err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	return &mecatlv1.DeleteProjectResponse{}, nil
}

// CreateSessionFromProject captures an authorized Project binding into a new Session.
func (h *HarnessServer) CreateSessionFromProject(ctx context.Context, req *mecatlv1.CreateSessionFromProjectRequest) (*mecatlv1.CreateSessionFromProjectResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}
	sel := ProviderSelector{ProviderID: req.GetProviderId(), ModelID: req.GetModelId(), ReasoningEffort: req.GetReasoningEffort()}
	sess, err := h.svc.CreateSessionFromProject(ctx, req.GetProjectId(), modeFromProto(req.GetMode()), limitsFromProto(req.GetLimits()), sel)
	if err != nil {
		return nil, toStatus(projectTransportError(err))
	}
	caps := h.svc.SessionCapabilities(sess.ID)
	return &mecatlv1.CreateSessionFromProjectResponse{
		SessionId: string(sess.ID), Capabilities: h.svc.capabilities(),
		SessionCapabilities: &mecatlv1.SessionCapabilities{Image: caps.Image, Audio: caps.Audio},
		ResolvedModel:       resolvedModelToProto(h.svc.ResolvedModel(sess.ID)),
	}, nil
}

func toProtoProjectSource(source project.WorkingSource) *mecatlv1.ProjectSource {
	return &mecatlv1.ProjectSource{SourceRef: valid(string(source.Ref)), Label: valid(source.Label), Working: true}
}

func toProtoProjectSources(sources []project.WorkingSource) []*mecatlv1.ProjectSource {
	out := make([]*mecatlv1.ProjectSource, 0, len(sources))
	for _, source := range sources {
		out = append(out, toProtoProjectSource(source))
	}
	return out
}

func toProtoProject(item project.Project) *mecatlv1.Project {
	return &mecatlv1.Project{ProjectId: valid(item.ID), Name: valid(item.Name), Working: toProtoProjectSource(item.Working), Revision: item.Revision, CreatedAtUnix: item.CreatedAt.Unix(), UpdatedAtUnix: item.UpdatedAt.Unix()}
}

func toProtoProjects(items []project.Project) []*mecatlv1.Project {
	out := make([]*mecatlv1.Project, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoProject(item))
	}
	return out
}

type projectCursorWire struct {
	UpdatedAtUnix int64  `json:"updated_at_unix"`
	ID            string `json:"id"`
}

func projectPageRequest(size int32, encoded string) (project.PageRequest, error) {
	limit := int(size)
	if limit <= 0 {
		limit = defaultProjectPageSize
	}
	if limit > maxProjectPageSize {
		limit = maxProjectPageSize
	}
	request := project.PageRequest{Limit: limit}
	if encoded == "" {
		return request, nil
	}
	var cursor projectCursorWire
	bytes, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil || json.Unmarshal(bytes, &cursor) != nil || cursor.ID == "" {
		return project.PageRequest{}, fmt.Errorf("%w: invalid project cursor", ErrInvalidArgument)
	}
	request.Cursor = &project.Cursor{UpdatedAt: time.Unix(cursor.UpdatedAtUnix, 0), ID: cursor.ID}
	return request, nil
}

func encodeProjectCursor(cursor *project.Cursor) string {
	if cursor == nil {
		return ""
	}
	bytes, err := json.Marshal(projectCursorWire{UpdatedAtUnix: cursor.UpdatedAt.Unix(), ID: cursor.ID})
	if err != nil {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}

// projectTransportError maps all Project seam failures to typed public errors.
// Unknown adapter failures remain a stable internal error so private locators never
// escape through either transport.
func projectTransportError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, project.ErrUnsupported):
		return project.ErrUnsupported
	case errors.Is(err, project.ErrConflict), errors.Is(err, project.ErrAlreadyExists):
		return project.ErrConflict
	case errors.Is(err, project.ErrNotFound), errors.Is(err, ErrNotFound):
		return ErrNotFound
	case errors.Is(err, project.ErrSourceNotFound):
		return ErrInvalidArgument
	case errors.Is(err, ErrInvalidArgument), errors.Is(err, ErrFailedPrecondition):
		return err
	default:
		return ErrInternal
	}
}
