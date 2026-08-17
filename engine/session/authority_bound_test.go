package session_test

import (
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
)

func TestADR_0226_AuthorityAttenuation_Scenario1_CanonicalValueExcludesSensitiveRuntimeData(t *testing.T) {
	t.Parallel()

	s := session.New("root", session.ModeDefault, "/workspace", session.Limits{}, time.Unix(1, 0).UTC())
	const withPath = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true},"workspace":"/secret"}`
	if err := s.BindAuthority(withPath, "root"); err == nil {
		t.Fatal("BindAuthority accepted a runtime path")
	}
	const valid = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	if err := s.BindAuthority(valid, "../../secret"); err == nil {
		t.Fatal("BindAuthority accepted a path-shaped definition identity")
	}
}

func TestADR_0226_AuthorityAttenuation_Scenario1_TerminalRecoveryPreservesMaximum(t *testing.T) {
	t.Parallel()

	const bound = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	cases := []struct {
		name     string
		terminal func(*session.Session) error
		recover  func(*session.Session) error
	}{
		{"completed/reopen", (*session.Session).Complete, (*session.Session).Reopen},
		{"cancelled/interrupt", (*session.Session).Cancel, (*session.Session).Interrupt},
		{"failed/recover", (*session.Session).Fail, (*session.Session).Recover},
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
