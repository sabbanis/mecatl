package server

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/project"
)

// ListProjectWorkingSources returns the immutable registry's safe source inventory.
func (s *Service) ListProjectWorkingSources(ctx context.Context) ([]project.WorkingSource, error) {
	if !s.projectEnabled() {
		return nil, fmt.Errorf("%w", project.ErrUnsupported)
	}
	return s.cfg.ProjectSources.ListWorking(ctx)
}

// CreateProject creates a server-owned Project from an authorized registered
// working source. The caller supplies no owner or label: both are trusted
// server-side facts.
func (s *Service) CreateProject(ctx context.Context, id, name string, sourceRef project.SourceRef) (project.Project, error) {
	if !s.projectEnabled() {
		return project.Project{}, fmt.Errorf("%w", project.ErrUnsupported)
	}
	source, err := s.projectWorkingSource(ctx, sourceRef)
	if err != nil {
		return project.Project{}, err
	}
	now := s.cfg.Now()
	item := project.Project{
		ID: id, Owner: session.PrincipalFromContext(ctx), Name: name, Working: source,
		Revision: 1, CreatedAt: now, UpdatedAt: now,
	}
	if err := item.Validate(); err != nil {
		return project.Project{}, fmt.Errorf("%w: invalid project document", ErrInvalidArgument)
	}
	if err := s.cfg.ProjectStore.Create(ctx, item); err != nil {
		return project.Project{}, err
	}
	return item.Clone(), nil
}

// GetProject returns one Project only when the calling principal owns it.
// Foreign and absent Projects deliberately share the server absence shape.
func (s *Service) GetProject(ctx context.Context, id string) (project.Project, error) {
	item, err := s.loadOwnedProject(ctx, id)
	if err != nil {
		return project.Project{}, err
	}
	return item, nil
}

// ListProjects returns the store's bounded owner-filtered page.
func (s *Service) ListProjects(ctx context.Context, request project.PageRequest) (project.Page, error) {
	if !s.projectEnabled() {
		return project.Page{}, fmt.Errorf("%w", project.ErrUnsupported)
	}
	request.OwnershipEnforced = s.cfg.OwnershipEnforced
	request.Owner = session.PrincipalFromContext(ctx)
	return s.cfg.ProjectStore.Page(ctx, request)
}

// ReplaceProject replaces a complete owned document at expectedRevision. Owner,
// labels, and timestamps remain server-owned; only a registered source may be
// selected.
func (s *Service) ReplaceProject(ctx context.Context, id, name string, sourceRef project.SourceRef, expectedRevision int64) (project.Project, error) {
	current, err := s.loadOwnedProject(ctx, id)
	if err != nil {
		return project.Project{}, err
	}
	source, err := s.projectWorkingSource(ctx, sourceRef)
	if err != nil {
		return project.Project{}, err
	}
	current.Name = name
	current.Working = source
	current.Revision = expectedRevision + 1
	current.UpdatedAt = s.cfg.Now()
	if err := current.Validate(); err != nil {
		return project.Project{}, fmt.Errorf("%w: invalid project document", ErrInvalidArgument)
	}
	return s.cfg.ProjectStore.Replace(ctx, current, expectedRevision, s.projectOwnership(ctx))
}

// DeleteProject removes only the owned Project document at expectedRevision.
func (s *Service) DeleteProject(ctx context.Context, id string, expectedRevision int64) error {
	if !s.projectEnabled() {
		return fmt.Errorf("%w", project.ErrUnsupported)
	}
	if err := s.cfg.ProjectStore.Delete(ctx, id, expectedRevision, s.projectOwnership(ctx)); err != nil {
		if errors.Is(err, project.ErrNotFound) {
			return fmt.Errorf("%w", ErrNotFound)
		}
		return err
	}
	return nil
}

// CreateSessionFromProject captures one authorized Project revision and its
// complete resolved Environment. It performs no second Project lookup: later
// Project mutations affect only future captures. The environment override is
// published only after the fully-labelled Session has persisted.
func (s *Service) CreateSessionFromProject(ctx context.Context, id string, mode session.PermissionMode, limits session.Limits, selector ProviderSelector) (*session.Session, error) {
	if selector.ProviderID == "" && selector.ModelID != "" {
		return nil, fmt.Errorf("%w: model_id requires provider_id (a bare model on the default provider is ambiguous)", ErrInvalidArgument)
	}
	item, err := s.loadOwnedProject(ctx, id)
	if err != nil {
		return nil, err
	}
	source, err := s.projectWorkingSource(ctx, item.Working.Ref)
	if err != nil {
		return nil, fmt.Errorf("%w: captured working source is unavailable", ErrFailedPrecondition)
	}
	env, err := s.cfg.ProjectSources.ResolveWorking(ctx, source.Ref)
	if err != nil {
		return nil, fmt.Errorf("%w: captured working source is unavailable", ErrFailedPrecondition)
	}
	if env.Workspace() == nil {
		return nil, fmt.Errorf("%w: resolved working source has no workspace", ErrFailedPrecondition)
	}
	if item.Revision > math.MaxInt {
		return nil, fmt.Errorf("%w: project revision exceeds session binding range", ErrFailedPrecondition)
	}
	if mode == "" {
		mode = s.cfg.DefaultMode
	}
	limits = limits.WithDefaults(s.cfg.DefaultLimits)

	// A Project Session always gets an engine built for the captured Environment.
	// The factory may own a per-session manager, so every failure after this point
	// closes its result before returning.
	res, err := s.cfg.SessionEngine(ctx, selector, nil, ProfileDefault, env.Workspace().Root(), mode)
	if err != nil {
		return nil, err
	}
	closeFn := res.Close
	closeResult := func() {
		if closeFn != nil {
			_ = closeFn()
		}
	}
	if res.Engine == nil {
		closeResult()
		return nil, fmt.Errorf("%w: project session factory returned no engine", ErrFailedPrecondition)
	}

	sess, err := newCreatedSession(s.cfg.NewID(), mode, env.Workspace().Root(), limits, s.cfg.Now(), nil)
	if err != nil {
		closeResult()
		return nil, fmt.Errorf("server: create project session metadata: %w", err)
	}
	if err := setSessionLabels(sess, selector, ProfileDefault, item.Owner); err != nil {
		closeResult()
		return nil, err
	}
	sess.EnvironmentRef = env.Ref()
	sess.Project = &session.ProjectBinding{
		ProjectID: item.ID, ProjectNameAtCreation: item.Name, ProjectRevision: int(item.Revision),
		Working:    session.ProjectSourceBinding{SourceRef: string(source.Ref), LabelAtCreation: source.Label},
		References: []session.ProjectSourceBinding{},
	}

	// Save while holding the registration lock. Registration is an infallible map
	// publication immediately after Save, so no durable Session can escape without
	// its matching engine and complete Environment.
	s.mu.Lock()
	if len(s.sessionEngines) >= s.cfg.MaxSessionEngines {
		s.mu.Unlock()
		closeResult()
		return nil, fmt.Errorf("%w: %d", ErrTooManySessionEngines, s.cfg.MaxSessionEngines)
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		s.mu.Unlock()
		closeResult()
		return nil, fmt.Errorf("server: persist project session: %w", err)
	}
	s.sessionEngines[sess.ID] = &sessionEngine{
		engine:          res.Engine,
		caps:            res.Capabilities,
		providerID:      res.ProviderID,
		modelID:         res.ModelID,
		reasoningEffort: res.ReasoningEffort,
		builtForMode:    res.BuiltForMode,
		close:           closeFn,
	}
	s.sessionEnvironments[sess.ID] = env
	s.mu.Unlock()
	return sess, nil
}

func (s *Service) projectEnabled() bool {
	// The initial working-source control plane shares the daemon's one writable
	// source and is therefore available only in the ownerless trusted domain.
	return !s.cfg.OwnershipEnforced && s.cfg.ProjectStore != nil && s.cfg.ProjectSources != nil && s.cfg.SessionEngine != nil
}

func (s *Service) loadOwnedProject(ctx context.Context, id string) (project.Project, error) {
	if !s.projectEnabled() {
		return project.Project{}, fmt.Errorf("%w", project.ErrUnsupported)
	}
	item, err := s.cfg.ProjectStore.Load(ctx, id, s.projectOwnership(ctx))
	if err != nil {
		if errors.Is(err, project.ErrNotFound) {
			return project.Project{}, fmt.Errorf("%w", ErrNotFound)
		}
		return project.Project{}, err
	}
	return item, nil
}

func (s *Service) projectOwnership(ctx context.Context) project.Ownership {
	return project.Ownership{Enforced: s.cfg.OwnershipEnforced, Owner: session.PrincipalFromContext(ctx)}
}

func (s *Service) projectWorkingSource(ctx context.Context, ref project.SourceRef) (project.WorkingSource, error) {
	if !s.projectEnabled() {
		return project.WorkingSource{}, fmt.Errorf("%w", project.ErrUnsupported)
	}
	sources, err := s.cfg.ProjectSources.ListWorking(ctx)
	if err != nil {
		return project.WorkingSource{}, err
	}
	for _, source := range sources {
		if source.Ref == ref {
			return source, nil
		}
	}
	return project.WorkingSource{}, fmt.Errorf("%w", project.ErrSourceNotFound)
}
