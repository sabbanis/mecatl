package qualificationrelease

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestADR_0352_QualificationRelease_Scenario1_TagAndSourceGuard(t *testing.T) {
	t.Parallel()
	workflow := readRepoFile(t, ".github/workflows/qualification-release.yml")
	for _, want := range []string{
		"- 'v0.0.39-i2i.*'",
		`^v0\.0\.39-i2i\.[1-9][0-9]*$`,
		requiredBaseline,
		"origin/i2i/model-only-one-shot-v0.0.39-baseline",
		"cancel-in-progress: false",
		"needs: guard",
		"persist-credentials: false",
		"git merge-base --is-ancestor \"$REQUIRED_BASELINE\" HEAD",
		"git merge-base --is-ancestor HEAD \"$QUALIFICATION_BRANCH\"",
	} {
		if !strings.Contains(workflow, want) {
			t.Errorf("workflow does not contain required guard fragment %q", want)
		}
	}
	for _, forbidden := range []string{"workflow_dispatch:", "cancel-in-progress: true"} {
		if strings.Contains(workflow, forbidden) {
			t.Errorf("workflow contains forbidden authority fragment %q", forbidden)
		}
	}
	if got := strings.Count(workflow, "persist-credentials: false"); got != 2 {
		t.Errorf("persist-credentials false count = %d, want 2", got)
	}
}

func TestADR_0352_QualificationRelease_Scenario2_MecatedOnlyArtifacts_Config(t *testing.T) {
	t.Parallel()
	config := readRepoFile(t, ".goreleaser-qualification.yaml")
	for _, want := range []string{
		"main: ./cmd/mecated",
		"binary: mecated",
		"CGO_ENABLED=0",
		"- darwin",
		"- linux",
		"- amd64",
		"- arm64",
		"buildinfo.BuildID={{ .Env.QUALIFICATION_BUILD_ID }}",
		"productmetrics.bakedKey=",
		"- LICENSE",
		"disable: true",
	} {
		if !strings.Contains(config, want) {
			t.Errorf("GoReleaser config does not contain %q", want)
		}
	}
	for _, forbidden := range []string{"mecatui", "mecak8s", "mecademo", "MECATL_METRICS_KEY", "brews:", "dockers:"} {
		if strings.Contains(config, forbidden) {
			t.Errorf("GoReleaser config contains forbidden surface %q", forbidden)
		}
	}
	if got := strings.Count(config, "main: ./cmd/mecated"); got != 1 {
		t.Errorf("mecated build count = %d, want 1", got)
	}
}

func TestADR_0352_QualificationRelease_Scenario3_SupplyChainAndLeastPrivilege(t *testing.T) {
	t.Parallel()
	workflow := readRepoFile(t, ".github/workflows/qualification-release.yml")
	for _, want := range []string{
		"contents: write",
		"id-token: write",
		"attestations: write",
		"cosign sign-blob",
		"cosign verify-blob",
		"anchore/sbom-action/download-syft@",
		"actions/attest-build-provenance@",
		"subject-checksums: dist/qualification/checksums.txt",
		"https://token.actions.githubusercontent.com",
		"https://github.com/sabbanis/mecatl/.github/workflows/qualification-release.yml@refs/tags/",
	} {
		if !strings.Contains(workflow, want) {
			t.Errorf("workflow does not contain supply-chain fragment %q", want)
		}
	}
	for _, forbidden := range []string{
		"packages: write",
		"MECATL_METRICS_KEY",
		"HOMEBREW_TAP",
		"AWS_",
		"GOOGLE_",
		"OPENAI_",
	} {
		if strings.Contains(workflow, forbidden) {
			t.Errorf("workflow contains forbidden credential or authority %q", forbidden)
		}
	}
	action := regexp.MustCompile(`uses:\s+[^\s@]+@([^\s#]+)`).FindAllStringSubmatch(workflow, -1)
	if len(action) == 0 {
		t.Fatal("workflow contains no action references")
	}
	sha := regexp.MustCompile(`^[0-9a-f]{40}$`)
	for _, match := range action {
		if !sha.MatchString(match[1]) {
			t.Errorf("action is not pinned by full commit SHA: %s", match[0])
		}
	}
}

func TestADR_0352_QualificationRelease_Scenario4_PublishAndRecovery(t *testing.T) {
	t.Parallel()
	workflow := readRepoFile(t, ".github/workflows/qualification-release.yml")
	publisherPath := repoPath(t, ".github/scripts/publish-qualification-release.sh")
	publisherBytes, err := os.ReadFile(publisherPath)
	if err != nil {
		t.Fatal(err)
	}
	publisher := string(publisherBytes)
	for _, want := range []string{
		"--draft",
		"--prerelease",
		"unexpected existing release asset",
		"existing asset digest conflicts",
		"published release is missing required asset",
		"gh release download",
		"gh release upload",
		"cmp -s",
		"shasum -a 256",
		"sabbanis/mecatl",
	} {
		if !strings.Contains(publisher, want) {
			t.Errorf("publisher does not contain append-only fragment %q", want)
		}
	}
	for _, forbidden := range []string{"--clobber", "release delete", "asset delete", "ghcr.io", "homebrew", " latest"} {
		if strings.Contains(strings.ToLower(publisher+workflow), forbidden) {
			t.Errorf("qualification release contains forbidden publication fragment %q", forbidden)
		}
	}
	attest := strings.Index(workflow, "name: Attest qualification payload provenance")
	publish := strings.Index(workflow, "name: Publish or verify the append-only prerelease")
	if attest < 0 || publish < 0 || attest >= publish {
		t.Fatal("publication is not ordered after provenance attestation")
	}
	cmd := exec.Command("bash", "-n", publisherPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("publisher syntax: %v: %s", err, output)
	}
}

func readRepoFile(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(repoPath(t, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func repoPath(t *testing.T, name string) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test source path")
	}
	return filepath.Join(filepath.Dir(file), "..", "..", name)
}
