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
	if s.cfg.ProjectStore == nil || s.cfg.ProjectSources == nil {
		return nil, fmt.Errorf("%w", project.ErrUnsupported)
	}
	return s.cfg.ProjectSources.ListWorking(ctx)
}

// CreateProject creates a server-owned Project from an authorized registered
// working source. The caller supplies no owner or label: both are trusted
// server-side facts.
func (s *Service) CreateProject(ctx context.Context, id, name string, sourceRef project.SourceRef) (project.Project, error) {
	if s.cfg.ProjectStore == nil || s.cfg.ProjectSources == nil {
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
		return project.Project{}, err
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
	if s.cfg.ProjectStore == nil {
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
		return project.Project{}, err
	}
	return s.cfg.ProjectStore.Replace(ctx, current, expectedRevision)
}

// DeleteProject removes only the owned Project document at expectedRevision.
func (s *Service) DeleteProject(ctx context.Context, id string, expectedRevision int64) error {
	if _, err := s.loadOwnedProject(ctx, id); err != nil {
		return err
	}
	return s.cfg.ProjectStore.Delete(ctx, id, expectedRevision)
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
	sess, err := newCreatedSession(s.cfg.NewID(), mode, env.Workspace().Root(), limits, s.cfg.Now(), nil)
	if err != nil {
		return nil, fmt.Errorf("server: create project session metadata: %w", err)
	}
	if err := setSessionLabels(sess, selector, ProfileDefault, item.Owner); err != nil {
		return nil, err
	}
	sess.EnvironmentRef = env.Ref()
	sess.Project = &session.ProjectBinding{
		ProjectID: item.ID, ProjectNameAtCreation: item.Name, ProjectRevision: int(item.Revision),
		Working: session.ProjectSourceBinding{SourceRef: string(source.Ref), LabelAtCreation: source.Label},
	}
	if err := s.cfg.Store.Save(ctx, sess); err != nil {
		return nil, fmt.Errorf("server: persist project session: %w", err)
	}
	s.SetSessionEnvironment(sess.ID, env)
	return sess, nil
}

func (s *Service) loadOwnedProject(ctx context.Context, id string) (project.Project, error) {
	if s.cfg.ProjectStore == nil {
		return project.Project{}, fmt.Errorf("%w", project.ErrUnsupported)
	}
	item, err := s.cfg.ProjectStore.Load(ctx, id)
	if err != nil {
		if errors.Is(err, project.ErrNotFound) {
			return project.Project{}, fmt.Errorf("%w", ErrNotFound)
		}
		return project.Project{}, err
	}
	if !s.ownsResource(ctx, item.Owner) {
		return project.Project{}, fmt.Errorf("%w", ErrNotFound)
	}
	return item, nil
}

func (s *Service) projectWorkingSource(ctx context.Context, ref project.SourceRef) (project.WorkingSource, error) {
	if s.cfg.ProjectSources == nil {
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
