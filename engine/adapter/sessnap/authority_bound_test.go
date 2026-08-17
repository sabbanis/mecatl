package sessnap_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/session"
)

const authorityBound = `{"v":1,"kind":"restricted","tools":["Read"],"delegates":[],"depth":0,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`

func TestADR_0224_AuthorityAttenuation_Scenario1_ClaimedV1MissingBoundFailsClosed(t *testing.T) {
	t.Parallel()

	s := newBoundSession(t)
	line, err := sessnap.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var snap sessnap.Snapshot
	if err := json.Unmarshal(line, &snap); err != nil {
		t.Fatalf("unmarshal snapshot: %v", err)
	}
	snap.AuthorityBound = ""
	line, err = json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal malformed snapshot: %v", err)
	}
	if _, err := sessnap.Unmarshal(line); err == nil {
		t.Fatal("Unmarshal accepted v1 snapshot with no authority bound")
	}
}

func TestADR_0224_AuthorityAttenuation_Scenario1_NewRootPersistsCanonicalMaximum(t *testing.T) {
	t.Parallel()

	s := session.New("s1", session.ModeDefault, "/w", session.Limits{}, time.Unix(0, 0).UTC())
	const unordered = `{"v":1,"kind":"restricted","tools":["Write","Read","Read"],"delegates":["reviewer","reviewer"],"depth":2,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	if err := s.BindAuthority(unordered, "operator:reviewer"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	bound, identity, legacy := s.AuthorityBound()
	const want = `{"v":1,"kind":"restricted","tools":["Read","Write"],"delegates":["reviewer"],"depth":2,"profile":{"filesystem":true,"direct_write":false,"isolated":true}}`
	if bound != want || identity != "operator:reviewer" || legacy {
		t.Fatalf("AuthorityBound() = (%q, %q, %t)", bound, identity, legacy)
	}
}

func TestADR_0224_AuthorityAttenuation_Scenario7_SnapshotRoundTripPreservesBound(t *testing.T) {
	t.Parallel()

	line, err := sessnap.Marshal(newBoundSession(t))
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	got, err := sessnap.Unmarshal(line)
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	bound, identity, compatibilityOnly := got.AuthorityBound()
	if bound != authorityBound || identity != "project:reviewer" || compatibilityOnly {
		t.Fatalf("AuthorityBound() = (%q, %q, %t)", bound, identity, compatibilityOnly)
	}
}

func TestADR_0224_AuthorityAttenuation_Scenario2_LegacyAndMalformedRecordsStayDistinct(t *testing.T) {
	t.Parallel()

	snap, err := sessnap.Of(session.New("s1", session.ModeDefault, "/w", session.Limits{}, time.Unix(0, 0).UTC()))
	if err != nil {
		t.Fatalf("Of: %v", err)
	}
	snap.AuthorityVersion = nil
	snap.AuthorityBound = ""
	snap.DefinitionIdentity = ""
	snap.AuthorityCompatibilityOnly = false
	line, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal legacy snapshot: %v", err)
	}
	got, err := sessnap.Unmarshal(line)
	if err != nil {
		t.Fatalf("Unmarshal legacy snapshot: %v", err)
	}
	bound, identity, compatibilityOnly := got.AuthorityBound()
	if bound != "" || identity != "" || !compatibilityOnly {
		t.Fatalf("AuthorityBound() = (%q, %q, %t), want legacy compatibility", bound, identity, compatibilityOnly)
	}
}

func newBoundSession(t *testing.T) *session.Session {
	t.Helper()
	s := session.New("s1", session.ModeDefault, "/w", session.Limits{}, time.Unix(0, 0).UTC())
	if err := s.BindAuthority(authorityBound, "project:reviewer"); err != nil {
		t.Fatalf("BindAuthority: %v", err)
	}
	return s
}
