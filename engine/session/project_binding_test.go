package session_test

import (
	"context"
	"encoding/json"
	"iter"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/eventsource"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

func TestProjectBindingRoundTripsAndProjectsSafely(t *testing.T) {
	t.Parallel()

	binding := &session.ProjectBinding{
		ProjectID:             "project-1",
		ProjectNameAtCreation: "Roadmap",
		ProjectRevision:       7,
		Working: session.ProjectSourceBinding{
			SourceRef:       "working-source",
			LabelAtCreation: "Working copy",
		},
		References: []session.ProjectSourceBinding{{
			SourceRef:       "reference-source",
			LabelAtCreation: "Architecture notes",
		}},
	}
	want := session.New("project-session", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(0, 0))
	want.Project = binding

	snap, err := sessnap.Of(want)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	restored, err := snap.Restore()
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if !reflect.DeepEqual(restored.Project, binding) {
		t.Fatalf("snapshot project binding = %#v, want %#v", restored.Project, binding)
	}

	folded, err := eventsource.Fold(eventsource.SessionMeta{
		ID: "project-session", Mode: session.ModeDefault, Workspace: "/workspace", CreatedAt: time.Unix(0, 0), Project: binding,
	}, iter.Seq2[session.Event, error](func(func(session.Event, error) bool) {}))
	if err != nil {
		t.Fatalf("event-source fold: %v", err)
	}
	if !reflect.DeepEqual(folded.Project, binding) {
		t.Fatalf("event-source project binding = %#v, want %#v", folded.Project, binding)
	}

	provenance := restored.ProjectProvenance()
	if provenance != (session.ProjectProvenance{
		ProjectID: "project-1", ProjectNameAtCreation: "Roadmap", WorkingLabelAtCreation: "Working copy",
	}) {
		t.Fatalf("compact provenance = %#v", provenance)
	}

	store := memstore.New()
	if err := store.Save(context.Background(), restored); err != nil {
		t.Fatalf("save: %v", err)
	}
	page, err := store.PageSessionMetadata(context.Background(), port.SessionMetadataPageRequest{Limit: 1})
	if err != nil {
		t.Fatalf("page metadata: %v", err)
	}
	if len(page.Sessions) != 1 || page.Sessions[0].Project != provenance {
		t.Fatalf("compact metadata provenance = %#v, want %#v", page.Sessions, provenance)
	}
	encodedProvenance, err := json.Marshal(page.Sessions[0].Project)
	if err != nil {
		t.Fatalf("marshal compact provenance: %v", err)
	}
	for _, forbidden := range []string{"working-source", "reference-source", "/workspace"} {
		if strings.Contains(string(encodedProvenance), forbidden) {
			t.Fatalf("compact provenance leaks %q: %s", forbidden, encodedProvenance)
		}
	}
}

func TestProjectBindingLegacyAndOrdinarySessionsRemainUnchanged(t *testing.T) {
	t.Parallel()

	legacy, err := sessnap.Snapshot{ID: "legacy", State: session.StateIdle, CreatedAt: time.Unix(0, 0)}.Restore()
	if err != nil {
		t.Fatalf("restore legacy snapshot: %v", err)
	}
	if legacy.Project != nil || legacy.ProjectProvenance() != (session.ProjectProvenance{}) {
		t.Fatalf("legacy Project = %#v, provenance = %#v; want none", legacy.Project, legacy.ProjectProvenance())
	}

	ordinary := session.New("ordinary", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(0, 0))
	snap, err := sessnap.Of(ordinary)
	if err != nil {
		t.Fatalf("snapshot ordinary session: %v", err)
	}
	encoded, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal ordinary snapshot: %v", err)
	}
	if strings.Contains(string(encoded), `"project"`) {
		t.Fatalf("ordinary snapshot unexpectedly contains project binding: %s", encoded)
	}
}
