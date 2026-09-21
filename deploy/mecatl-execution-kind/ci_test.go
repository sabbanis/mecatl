package executionkind_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

type workflowStep struct {
	ID   string            `yaml:"id"`
	Run  string            `yaml:"run"`
	If   string            `yaml:"if"`
	Env  map[string]string `yaml:"env"`
	With map[string]any    `yaml:"with"`
}

func nativeSteps(t *testing.T) map[string]workflowStep {
	t.Helper()
	data, err := os.ReadFile("../../.github/workflows/e2e-live.yml")
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Jobs map[string]struct {
			If      string         `yaml:"if"`
			Steps   []workflowStep `yaml:"steps"`
			Timeout int            `yaml:"timeout-minutes"`
		} `yaml:"jobs"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	job := workflow.Jobs["native-execution-live"]
	if strings.Join(strings.Fields(job.If), " ") != "github.repository == 'stacklok/mecatl' && github.event_name == 'workflow_dispatch' && inputs.native_execution" || job.Timeout != 100 {
		t.Fatal("native job must remain explicitly dispatched, repo-gated, and bounded")
	}
	steps := make(map[string]workflowStep)
	for _, step := range job.Steps {
		if step.ID != "" {
			steps[step.ID] = step
		}
		if strings.Contains(step.Run, "${{") {
			t.Fatal("workflow expressions must cross into shell through env")
		}
		if step.With["cache"] == true {
			t.Fatal("native credential job must not save a cache")
		}
	}
	if steps["production"].Env["MECATL_EXECUTION_QUAL_CI"] != "0" || len(steps["credential"].Env) != 1 || steps["credential"].Env["OPENROUTER_API_KEY"] != "${{ secrets.OPENROUTER_API_KEY }}" {
		t.Fatal("production retention or step-scoped credential wiring drifted")
	}
	if steps["credential"].If != "success() && steps.production.outcome == 'success'" || steps["live"].If != "success() && steps.production.outcome == 'success' && steps.credential.outcome == 'success'" || steps["cleanup"].If != "always() && steps.prepare.outcome == 'success'" {
		t.Fatal("qualification must depend on actual production success and always clean up")
	}
	return steps
}

func writeFixture(t *testing.T, path, body string, mode os.FileMode) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), mode); err != nil {
		t.Fatal(err)
	}
}

func runStep(t *testing.T, root, script string, env ...string) ([]byte, error) {
	t.Helper()
	cmd := exec.CommandContext(t.Context(), "bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script)
	cmd.Dir = root
	cmd.Env = append([]string{"PATH=" + os.Getenv("PATH"), "HOME=" + root}, env...)
	return cmd.CombinedOutput()
}

func TestNativeWorkflowCommitAndCredentialBoundary(t *testing.T) {
	steps := nativeSteps(t)
	for _, expected := range []string{"", "reviewed", "wrong", "$(touch injected)"} {
		t.Run("sha="+expected, func(t *testing.T) {
			root := t.TempDir()
			bin := filepath.Join(root, "bin")
			if err := os.Mkdir(bin, 0o700); err != nil {
				t.Fatal(err)
			}
			writeFixture(t, filepath.Join(bin, "git"), "#!/bin/sh\nprintf 'reviewed\\n'\n", 0o700)
			dir := filepath.Join(root, ".scratch", "ci")
			out, err := runStep(t, root, steps["prepare"].Run, "PATH="+bin+":"+os.Getenv("PATH"), "NATIVE_CI_DIR="+dir, "EVENT_SHA=reviewed", "EXPECTED_SHA="+expected, "GITHUB_STEP_SUMMARY="+filepath.Join(root, "summary"))
			wantOK := expected == "" || expected == "reviewed"
			if (err == nil) != wantOK {
				t.Fatalf("SHA gate: %v: %s", err, out)
			}
			if _, err := os.Stat(filepath.Join(root, "injected")); !os.IsNotExist(err) {
				t.Fatal("expected SHA was executed")
			}
			if !wantOK {
				return
			}
			info, err := os.Stat(dir)
			if err != nil || info.Mode().Perm() != 0o700 {
				t.Fatal("CI directory is not private")
			}
			if _, err := runStep(t, root, steps["credential"].Run, "NATIVE_CI_DIR="+dir, "OPENROUTER_API_KEY="); err == nil {
				t.Fatal("missing credential skipped successfully")
			}
			const fake = "synthetic-offline-key"
			out, err = runStep(t, root, steps["credential"].Run+"\ntest -z \"${OPENROUTER_API_KEY+x}\"", "NATIVE_CI_DIR="+dir, "OPENROUTER_API_KEY="+fake)
			if err != nil || strings.Contains(string(out), fake) {
				t.Fatal("credential staging failed or disclosed synthetic credential")
			}
			info, err = os.Stat(filepath.Join(dir, "provider-key"))
			if err != nil || info.Mode().Perm() != 0o600 {
				t.Fatal("credential file is not private")
			}
			if _, err := runStep(t, root, steps["credential"].Run, "NATIVE_CI_DIR="+dir, "OPENROUTER_API_KEY=replacement"); err == nil {
				t.Fatal("credential staging overwrote existing file")
			}
			data, err := os.ReadFile(filepath.Join(dir, "provider-key"))
			if err != nil || string(data) != fake {
				t.Fatal("existing synthetic credential changed")
			}
		})
	}
}

func TestNativeWorkflowCleanupOwnership(t *testing.T) {
	steps := nativeSteps(t)
	for _, fault := range []string{"", "owner", "context", "label", "duplicate", "symlink", "delete", "list"} {
		t.Run("fault="+fault, func(t *testing.T) {
			root := t.TempDir()
			state := filepath.Join(root, ".scratch", "k8s-execution", "owned")
			dir := filepath.Join(root, ".scratch", "ci")
			bin := filepath.Join(root, "bin")
			for _, path := range []string{state, dir, bin} {
				if err := os.MkdirAll(path, 0o700); err != nil {
					t.Fatal(err)
				}
			}
			const cluster = "mecatl-execution-qual-offline"
			context := "kind-" + cluster
			owner := "fixture"
			if fault == "owner" {
				owner = "someone-else"
			}
			if fault == "context" {
				context = "ambient"
			}
			kubeconfig := filepath.Join(state, "kubeconfig")
			writeFixture(t, kubeconfig, "synthetic", 0o600)
			ownership := "cluster=" + cluster + "\ncontext=" + context + "\nowner=" + owner + "\nruntime=docker\nprofile=production\nnamespace=execution-qualification\nkubeconfig=" + kubeconfig + "\n"
			if fault == "duplicate" {
				ownership += "owner=fixture\n"
			}
			writeFixture(t, filepath.Join(state, "ownership"), ownership, 0o600)
			pointer := filepath.Join(filepath.Dir(state), "current")
			if fault == "symlink" {
				if err := os.Symlink(kubeconfig, pointer); err != nil {
					t.Fatal(err)
				}
			} else {
				writeFixture(t, pointer, state+"\n", 0o600)
			}
			writeFixture(t, filepath.Join(dir, "provider-key"), "synthetic", 0o600)
			writeFixture(t, filepath.Join(state, "live-summary.json"), "{}\n", 0o600)
			writeFixture(t, filepath.Join(bin, "kubectl"), "#!/bin/sh\nprintf '%s\\n' 'kind-"+cluster+"'\n", 0o700)
			writeFixture(t, filepath.Join(bin, "docker"), "#!/bin/sh\nif [ \"$FAULT\" = label ]; then exit 1; fi\nprintf '%s\\n' '"+cluster+"'\n", 0o700)
			writeFixture(t, filepath.Join(bin, "kind"), "#!/bin/sh\nif [ \"$1\" = delete ]; then\n  test \"$*\" = 'delete cluster --name "+cluster+"' || exit 1\n  test \"$FAULT\" != delete || exit 1\n  printf deleted > \"$MARKER\"\nelse\n  test \"$FAULT\" != list || exit 1\nfi\n", 0o700)
			marker := filepath.Join(root, "deleted")
			out, err := runStep(t, root, steps["cleanup"].Run, "PATH="+bin+":"+os.Getenv("PATH"), "NATIVE_CI_DIR="+dir, "GITHUB_WORKSPACE="+root, "USER=fixture", "PRODUCTION_OUTCOME=success", "FAULT="+fault, "MARKER="+marker)
			if (err == nil) != (fault == "") {
				t.Fatalf("cleanup result: %v: %s", err, out)
			}
			if _, err := os.Stat(filepath.Join(dir, "provider-key")); !os.IsNotExist(err) {
				t.Fatal("CI credential was not removed independently")
			}
			_, deleted := os.Stat(marker)
			if (deleted == nil) != (fault == "" || fault == "list") {
				t.Fatal("wrong cluster deletion decision")
			}
		})
	}
}

func TestLiveImageDigestUsesRuntimeSpecificInspect(t *testing.T) {
	data, err := os.ReadFile("live.sh")
	if err != nil {
		t.Fatal(err)
	}
	start := strings.Index(string(data), "if [ \"$runtime\" = podman ]; then\n  podman image exists")
	end := strings.Index(string(data), "\nworkload_tag=")
	if start < 0 || end < start {
		t.Fatal("image build preparation missing")
	}
	for _, runtime := range []string{"docker", "podman"} {
		t.Run(runtime, func(t *testing.T) {
			root := t.TempDir()
			writeFixture(t, filepath.Join(root, runtime), "#!/bin/sh\ncase \"$*\" in\n  'image exists docker.io/library/golang:1.27'|'image inspect docker.io/library/golang:1.27') exit 0 ;;\n  'image inspect docker.io/library/golang:1.27 --format {{.Digest}}') test \"$RUNTIME\" = podman || exit 1; printf 'sha256:fake' ;;\n  'image inspect docker.io/library/golang:1.27 --format {{index .RepoDigests 0}}') test \"$RUNTIME\" = docker || exit 1; printf 'golang@sha256:fake' ;;\n  *) exit 1 ;;\nesac\n", 0o700)
			out, err := runStep(t, root, string(data[start:end])+"\ntest \"$go_image\" = docker.io/library/golang@sha256:fake", "PATH="+root+":"+os.Getenv("PATH"), "runtime="+runtime, "RUNTIME="+runtime)
			if err != nil {
				t.Fatalf("digest selection: %v: %s", err, out)
			}
		})
	}
}
