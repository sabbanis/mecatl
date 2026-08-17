package eventsource_test

import (
	"errors"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/eventsource"
	"github.com/stacklok/mecatl/engine/session"
)

const eventSourceAuthorityBound = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`

func TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldRespectsExplicitProvenance(t *testing.T) {
	t.Parallel()

	legacyVersion := 0
	v1 := 1
	cases := []struct {
		name   string
		meta   eventsource.SessionMeta
		bound  string
		legacy bool
	}{
		{
			name:   "legacy",
			meta:   eventsource.SessionMeta{ID: "legacy", Mode: session.ModeDefault, Workspace: "/ws", CreatedAt: time.Unix(0, 0), AuthorityVersion: &legacyVersion},
			legacy: true,
		},
		{
			name:  "v1",
			meta:  eventsource.SessionMeta{ID: "v1", Mode: session.ModeDefault, Workspace: "/ws", CreatedAt: time.Unix(0, 0), AuthorityVersion: &v1, AuthorityBound: eventSourceAuthorityBound, DefinitionIdentity: "operator:reviewer"},
			bound: eventSourceAuthorityBound,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := eventsource.Fold(tc.meta, func(func(session.Event, error) bool) {})
			if err != nil {
				t.Fatalf("Fold: %v", err)
			}
			bound, identity, legacy := got.AuthorityBound()
			if bound != tc.bound || identity != map[bool]string{true: "", false: "operator:reviewer"}[tc.legacy] || legacy != tc.legacy {
				t.Fatalf("AuthorityBound() = (%q, %q, %t)", bound, identity, legacy)
			}
		})
	}
}

func TestADR_0224_AuthorityAttenuation_Scenario7_EventFoldClaimedV1FailsClosed(t *testing.T) {
	t.Parallel()

	v1 := 1
	for _, tc := range []eventsource.SessionMeta{
		{ID: "missing", Mode: session.ModeDefault, Workspace: "/ws", CreatedAt: time.Unix(0, 0), AuthorityVersion: &v1},
		{ID: "invalid", Mode: session.ModeDefault, Workspace: "/ws", CreatedAt: time.Unix(0, 0), AuthorityVersion: &v1, AuthorityBound: "not-json"},
	} {
		if _, err := eventsource.Fold(tc, func(func(session.Event, error) bool) {}); !errors.Is(err, eventsource.ErrReconstruct) {
			t.Errorf("Fold(%q) error = %v, want ErrReconstruct", tc.ID, err)
		}
	}
}
