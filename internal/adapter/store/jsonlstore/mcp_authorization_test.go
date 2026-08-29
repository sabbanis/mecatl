package jsonlstore_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/stacklok/mecatl/engine/session"
)

// TestSessionMCPAuthorization_Scenario9_MixedVersionFailsClosed proves a current
// reader accepts the legacy envelope alongside v2 writes; unknown versions remain
// rejected by TestEventLogReadRejectsUnknownFormat.
func TestSessionMCPAuthorization_Scenario9_MixedVersionFailsClosed(t *testing.T) {
	st, dir := newStore(t)
	id := session.SessionID("mixed-version")
	if err := st.Append(context.Background(), id, session.Event{Type: session.EvMCPAuthorizationRequired}); err != nil {
		t.Fatalf("Append v2: %v", err)
	}
	path := canonicalFamilyPath(dir, id, ".events.jsonl")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if err := os.WriteFile(path, []byte(strings.Replace(string(raw), "eventlog-json/2", "eventlog-json/1", 1)), 0o600); err != nil {
		t.Fatalf("WriteFile v1 fixture: %v", err)
	}
	if err := st.Append(context.Background(), id, session.Event{Type: session.EvMCPAuthorizationResolved}); err != nil {
		t.Fatalf("Append v2: %v", err)
	}
	count := 0
	for _, err := range st.Read(context.Background(), id) {
		if err != nil {
			t.Fatalf("mixed Read: %v", err)
		}
		count++
	}
	if count != 2 {
		t.Fatalf("mixed Read count = %d, want 2", count)
	}
}
