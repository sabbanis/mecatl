package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/project"
)

type projectBody struct {
	ProjectID        string    `json:"project_id,omitempty"`
	Name             string    `json:"name"`
	SourceRef        string    `json:"source_ref"`
	ExpectedRevision int64     `json:"expected_revision,omitempty"`
	Mode             string    `json:"mode,omitempty"`
	Limits           *limitsIn `json:"limits,omitempty"`
	ProviderID       string    `json:"provider_id,omitempty"`
	ModelID          string    `json:"model_id,omitempty"`
	ReasoningEffort  string    `json:"reasoning_effort,omitempty"`
}

func (h *HTTPHandler) getServerCapabilities(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.capabilities())
}

func (h *HTTPHandler) listProjectSources(w http.ResponseWriter, r *http.Request) {
	sources, err := h.svc.ListProjectWorkingSources(r.Context())
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Sources any `json:"sources"`
	}{Sources: toProtoProjectSources(sources)})
}

func (h *HTTPHandler) createProject(w http.ResponseWriter, r *http.Request) {
	var body projectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.ProjectID == "" || body.Name == "" || body.SourceRef == "" {
		writeServiceError(w, ErrInvalidArgument)
		return
	}
	item, err := h.svc.CreateProject(r.Context(), body.ProjectID, body.Name, project.SourceRef(body.SourceRef))
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	writeJSON(w, http.StatusCreated, struct {
		Project any `json:"project"`
	}{Project: toProtoProject(item)})
}

func (h *HTTPHandler) getProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeServiceError(w, ErrInvalidArgument)
		return
	}
	item, err := h.svc.GetProject(r.Context(), id)
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Project any `json:"project"`
	}{Project: toProtoProject(item)})
}

func (h *HTTPHandler) listProjects(w http.ResponseWriter, r *http.Request) {
	size, err := projectPageSize(r.URL.Query().Get("page_size"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	request, err := projectPageRequest(size, r.URL.Query().Get("cursor"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	page, err := h.svc.ListProjects(r.Context(), request)
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Projects   any    `json:"projects"`
		NextCursor string `json:"next_cursor,omitempty"`
		TotalCount int32  `json:"total_count"`
	}{Projects: toProtoProjects(page.Projects), NextCursor: encodeProjectCursor(page.NextCursor), TotalCount: ClampInt32(page.TotalCount)})
}

func (h *HTTPHandler) replaceProject(w http.ResponseWriter, r *http.Request) {
	var body projectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if r.PathValue("id") == "" || body.Name == "" || body.SourceRef == "" || body.ExpectedRevision < 1 {
		writeServiceError(w, ErrInvalidArgument)
		return
	}
	item, err := h.svc.ReplaceProject(r.Context(), r.PathValue("id"), body.Name, project.SourceRef(body.SourceRef), body.ExpectedRevision)
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Project any `json:"project"`
	}{Project: toProtoProject(item)})
}

func (h *HTTPHandler) deleteProject(w http.ResponseWriter, r *http.Request) {
	var body projectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if r.PathValue("id") == "" || body.ExpectedRevision < 1 {
		writeServiceError(w, ErrInvalidArgument)
		return
	}
	if err := h.svc.DeleteProject(r.Context(), r.PathValue("id"), body.ExpectedRevision); err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) createSessionFromProject(w http.ResponseWriter, r *http.Request) {
	var body projectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		writeServiceError(w, ErrInvalidArgument)
		return
	}
	var limits session.Limits
	if body.Limits != nil {
		limits = session.Limits{MaxTurns: body.Limits.MaxTurns, MaxToolCalls: body.Limits.MaxToolCalls, MaxConsecutiveFailures: body.Limits.MaxConsecutiveFailures}
	}
	sess, err := h.svc.CreateSessionFromProject(r.Context(), id, modeFromString(body.Mode), limits, ProviderSelector{ProviderID: body.ProviderID, ModelID: body.ModelID, ReasoningEffort: body.ReasoningEffort})
	if err != nil {
		writeServiceError(w, projectTransportError(err))
		return
	}
	caps := h.svc.SessionCapabilities(sess.ID)
	writeJSON(w, http.StatusCreated, createSessionResp{SessionID: string(sess.ID), Capabilities: capabilitiesJSON(h.svc.capabilities()), SessionCapabilities: &sessionCapabilitiesJSON{Image: caps.Image, Audio: caps.Audio}, ResolvedModel: resolvedModelToJSON(h.svc.ResolvedModel(sess.ID))})
}

func projectPageSize(raw string) (int32, error) {
	if raw == "" {
		return 0, nil
	}
	size, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || size < 0 {
		return 0, ErrInvalidArgument
	}
	return int32(size), nil
}
