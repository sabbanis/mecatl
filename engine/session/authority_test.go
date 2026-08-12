package session_test

import (
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
)

func TestAuthorityAttenuation_RootAuthoritySurvivesTerminalRecovery(t *testing.T) {
	t.Parallel()

	const bound = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	cases := []struct {
		name     string
		terminal func(*session.Session) error
		recover  func(*session.Session) error
	}{
		{
			name: "completed/reopen",
			terminal: func(s *session.Session) error {
				return s.Complete()
			},
			recover: func(s *session.Session) error {
				return s.Reopen()
			},
		},
		{
			name: "cancelled/interrupt",
			terminal: func(s *session.Session) error {
				return s.Cancel()
			},
			recover: func(s *session.Session) error {
				return s.Interrupt()
			},
		},
		{
			name: "failed/recover",
			terminal: func(s *session.Session) error {
				return s.Fail()
			},
			recover: func(s *session.Session) error {
				return s.Recover()
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := session.New("root", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(1, 0).UTC())
			if err := s.BindAuthority(bound, "root"); err != nil {
				t.Fatalf("BindAuthority: %v", err)
			}
			if err := tc.terminal(s); err != nil {
				t.Fatalf("terminal transition: %v", err)
			}
			if err := tc.recover(s); err != nil {
				t.Fatalf("recovery transition: %v", err)
			}
			got, definition, compatibilityOnly := s.AuthorityBound()
			if got != bound || definition != "root" || compatibilityOnly {
				t.Fatalf("authority after recovery = %q, %q, compatibilityOnly=%v", got, definition, compatibilityOnly)
			}
		})
	}
}
