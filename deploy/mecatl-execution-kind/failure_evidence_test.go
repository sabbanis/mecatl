package executionkind_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestFailureEvidenceRejectsProducerText(t *testing.T) {
	if _, err := exec.LookPath("jq"); err != nil {
		t.Skip("jq unavailable")
	}
	// Even a syntactically valid metadata name or reason is not an output grant.
	const hostile = "PRIVATE-URL-TOKEN-COMMAND"
	fixture := `{"items":[{"kind":"ExecutionEnvironment","metadata":{"name":"` + hostile + `","deletionTimestamp":"private","finalizers":["` + hostile + `","execution.mecatl.dev/retain-workspace"]},"status":{"pod":{"name":"p","uid":"expected"},"pvc":{"name":"v","uid":"expected"},"activeOperation":{"id":"` + hostile + `","expiresAt":"2000-01-01T00:00:00.123Z"},"lifecycleOperation":{"type":"DeleteRetiredEnvironment","phase":"ReleasingSlot"},"conditions":[{"type":"Ready","status":"False","reason":"FenceUnknown","message":"` + hostile + `"}]}},{"kind":"Pod","metadata":{"name":"p","uid":"foreign","finalizers":["execution.mecatl.dev/verify-termination"]},"status":{"phase":"Failed","containerStatuses":[{"name":"` + hostile + `","state":{"terminated":{"reason":"Error","message":"` + hostile + `"}}}]}},{"kind":"PersistentVolumeClaim","metadata":{"name":"v","uid":"expected","finalizers":["kubernetes.io/pvc-protection"]}},{"kind":"ResourceQuota","spec":{"hard":{"pods":"10","requests.cpu":"10","` + hostile + `":"10"}},"status":{"hard":{"pods":"10","requests.cpu":"20"},"used":{"requests.cpu":"0"}}},{"kind":"Event","reason":"` + hostile + `","message":"` + hostile + `"}]}`
	cmd := exec.CommandContext(t.Context(), "jq", "-cs", "-f", "failure-evidence.jq")
	cmd.Stdin = strings.NewReader(fixture)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("filter: %v: %s", err, out)
	}
	if strings.Contains(string(out), hostile) || len(out) > 16384 {
		t.Fatal("untrusted evidence escaped")
	}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		var v map[string]any
		if err := json.Unmarshal([]byte(line), &v); err != nil {
			t.Fatal(err)
		}
		if v["kind"] == "environment" {
			if v["pod_uid_matches"] != false || v["pvc_uid_matches"] != true || v["lease_expired"] != true || v["deleting"] != true || len(v["finalizers"].([]any)) != 1 {
				t.Fatalf("lost diagnostic facts: %s", line)
			}
		}
		if v["kind"] == "quota" && len(v["missing_or_mismatched_keys"].([]any)) != 2 {
			t.Fatalf("lost quota mismatch: %s", line)
		}
	}
}

func TestFailureCollectorBoundsAndContext(t *testing.T) {
	if _, err := exec.LookPath("jq"); err != nil {
		t.Skip("jq unavailable")
	}
	root := t.TempDir()
	bin := filepath.Join(root, "bin")
	if err := os.Mkdir(bin, 0o700); err != nil {
		t.Fatal(err)
	}
	writeFixture(t, filepath.Join(bin, "kubectl"), `#!/bin/sh
set -eu
test "$1 $2 $3 $4 $5" = '--kubeconfig synthetic --context kind-owned --request-timeout=10s'
if [ -n "${EVIDENCE_FIXTURE:-}" ]; then cat "$EVIDENCE_FIXTURE"; exit; fi
case "$7" in
pods) printf 'PRIVATE-ERROR' >&2; exit 1 ;;
*) printf '{"items":[{"kind":"Event","reason":"FailedMount","message":"PRIVATE-DATA"}]}' ;;
esac
`, 0o700)
	outPath := filepath.Join(root, "evidence")
	script, err := filepath.Abs("collect-failure.sh")
	if err != nil {
		t.Fatal(err)
	}
	out, err := runStep(t, root, "sh \"$COLLECTOR\" synthetic kind-owned \"$OUT\"", "COLLECTOR="+script, "OUT="+outPath, "PATH="+bin+":"+os.Getenv("PATH"))
	if err != nil {
		t.Fatalf("collector failed: %v: %s", err, out)
	}
	data, err := os.ReadFile(outPath)
	if err != nil || len(data) > 16384 || len(data) == 0 || strings.Contains(string(data), "PRIVATE") || strings.Contains(string(out), "PRIVATE") {
		t.Fatalf("unsafe/missing evidence: %v", err)
	}
	if !strings.Contains(string(data), `"unavailable":1`) {
		t.Fatal("API failure not recorded")
	}
	// A large fleet must retain late quota evidence, not exhaust a summary-sized
	// cap on environment/Pod rows before reaching the quota and event sections.
	container := `{"state":{"terminated":{"reason":"Completed"}}}`
	pod := `{"kind":"Pod","status":{"phase":"Failed","containerStatuses":[` + strings.TrimSuffix(strings.Repeat(container+",", 16), ",") + `]}}`
	fixture := filepath.Join(root, "fleet.json")
	writeFixture(t, fixture, `{"items":[`+strings.Repeat(pod+",", 64)+`{"kind":"ResourceQuota","spec":{"hard":{"pods":"1"}}}]}`, 0o600)
	outPath = filepath.Join(root, "fleet-evidence")
	out, err = runStep(t, root, "sh \"$COLLECTOR\" synthetic kind-owned \"$OUT\"", "COLLECTOR="+script, "OUT="+outPath, "EVIDENCE_FIXTURE="+fixture, "PATH="+bin+":"+os.Getenv("PATH"))
	if err != nil {
		t.Fatalf("fleet collector: %v: %s", err, out)
	}
	data, err = os.ReadFile(outPath)
	if err != nil || len(data) > 1<<20 || !strings.Contains(string(data), `"kind":"quota"`) {
		t.Fatal("fleet evidence lost quota or exceeded artifact cap")
	}
}
