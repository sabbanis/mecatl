package executionkind_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func scriptRange(t *testing.T, file, start, end string) string {
	t.Helper()
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	body := string(data)
	i, j := strings.Index(body, start), strings.Index(body, end)
	if i < 0 || j <= i {
		t.Fatalf("missing script range in %s", file)
	}
	return body[i:j]
}

func TestProductionThenLiveImageAlias(t *testing.T) {
	production := scriptRange(t, "run.sh", "for item in", "printf 'provider=%s")
	live := scriptRange(t, "live.sh", ". \"$root/deploy/mecatl-execution-kind/images.sh\"", "\nprovider_tag=$(build_ko")
	helper, err := os.ReadFile("images.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, runtime := range []string{"docker", "podman"} {
		for _, conflict := range []bool{false, true} {
			t.Run(runtime+"/conflict="+map[bool]string{false: "false", true: "true"}[conflict], func(t *testing.T) {
				root := t.TempDir()
				for _, dir := range []string{"bin", "images", "deploy/mecatl-execution-kind"} {
					if err := os.MkdirAll(filepath.Join(root, dir), 0o700); err != nil {
						t.Fatal(err)
					}
				}
				writeFixture(t, filepath.Join(root, "deploy/mecatl-execution-kind/images.sh"), string(helper), 0o600)
				digest := "sha256:" + strings.Repeat("a", 64)
				tag := "ko.local/provider:head"
				alias := "ko.local/provider@" + digest
				db := filepath.Join(root, "db")
				var sourceRows strings.Builder
				for _, name := range []string{"provider", "agent", "oidc", "netprobe", "workload"} {
					sourceRows.WriteString("ko.local/" + name + ":head type " + digest + "\n")
				}
				writeFixture(t, db, sourceRows.String(), 0o600)
				writeFixture(t, filepath.Join(root, "bin", runtime), `#!/bin/sh
set -eu
case "$1" in
save) : > "$4" ;;
exec)
  test "$2" = owned-control-plane
  shift 5
  test "$1" = images
  case "$2" in
  ls) cat "$DB" ;;
  tag)
    test "$#" = 4
    if awk -v ref="$4" '$1 == ref {found=1} END {exit !found}' "$DB"; then
      echo 'already exists' >&2; exit 1
    fi
    digest=$(awk -v ref="$3" '$1 == ref {print $3}' "$DB")
    printf '%s type %s\n' "$4" "$digest" >> "$DB"
    printf 'tag\n' >> "$TAGS"
    ;;
  *) exit 1 ;;
  esac ;;
*) exit 1 ;;
esac
`, 0o700)
				writeFixture(t, filepath.Join(root, "bin/kind"), "#!/bin/sh\nset -eu\ntest \"$1 $2\" = 'load image-archive'\ntest -f \"$3\"\ntest \"$4 $5\" = '--name owned'\n", 0o700)
				env := []string{"PATH=" + filepath.Join(root, "bin") + ":" + os.Getenv("PATH"), "root=" + root, "state=" + root, "runtime=" + runtime, "cluster=owned", "DB=" + db, "TAGS=" + filepath.Join(root, "tags")}
				for _, name := range []string{"provider", "agent", "oidc", "netprobe", "workload"} {
					env = append(env, name+"_tag=ko.local/"+name+":head")
				}
				out, err := runStep(t, root, production, env...)
				if err != nil {
					t.Fatalf("fresh production load: %v: %s", err, out)
				}
				if conflict {
					writeFixture(t, db, tag+" type "+digest+"\n"+alias+" type sha256:"+strings.Repeat("b", 64)+"\n", 0o600)
				}
				out, err = runStep(t, root, live+"\nload_image \"$provider_tag\"", env...)
				if (err == nil) == conflict {
					t.Fatalf("retained live load: %v: %s", err, out)
				}
				if !conflict && strings.TrimSpace(string(out)) != alias {
					t.Fatalf("wrong alias: %s", out)
				}
				tags, err := os.ReadFile(filepath.Join(root, "tags"))
				if err != nil || string(tags) != strings.Repeat("tag\n", 5) {
					t.Fatalf("must create each alias once, never overwrite/re-tag: %q, %v", tags, err)
				}
			})
		}
	}
}

func TestLiveSignalPreservesFailureAndAttemptsCleanup(t *testing.T) {
	restore := scriptRange(t, "live.sh", "restore() {", "\ndev env -i HOME=\"$HOME\" PATH=\"$PATH\" KUBECONFIG=\"$kubeconfig\" MECATL_KUBE_CONTEXT=\"$context\" MECATL_EXECUTION_CREDENTIAL_FILE=")
	for _, signal := range []struct {
		name string
		code string
	}{{"INT", "130"}, {"TERM", "143"}} {
		t.Run(signal.name, func(t *testing.T) {
			root := t.TempDir()
			writeFixture(t, filepath.Join(root, "receipt"), "synthetic", 0o600)
			writeFixture(t, filepath.Join(root, "signal.sh"), "#!/bin/sh\nset -eu\n"+`
helm_kube() { printf 'restore\n' >> "$MARKER"; }
dev() { printf 'delete\n' >> "$MARKER"; }
restore_needed=1
`+restore+"\nkill -"+signal.name+" $$\nexit 99\n", 0o700)
			out, err := runStep(t, root, "if sh ./signal.sh; then exit 1; else test \"$?\" -eq "+signal.code+"; fi", "root="+root, "MARKER="+filepath.Join(root, "cleanup"), "receipt="+filepath.Join(root, "receipt"), "agent_image=synthetic@sha256:fake", "kubeconfig=synthetic", "context=synthetic", "secret=synthetic")
			if err != nil {
				t.Fatalf("signal was reported as success: %v: %s", err, out)
			}
			calls, err := os.ReadFile(filepath.Join(root, "cleanup"))
			if err != nil || string(calls) != "restore\ndelete\n" {
				t.Fatalf("cleanup must run once after signal: %q: %v", calls, err)
			}
		})
	}
}

func TestProductionPublishesOwnershipBeforePartialCreation(t *testing.T) {
	data, err := os.ReadFile("run.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, fault := range []string{"partial", "discovery", "collision"} {
		t.Run(fault, func(t *testing.T) {
			root := t.TempDir()
			scripts := filepath.Join(root, "deploy/mecatl-execution-kind")
			bin := filepath.Join(root, "bin")
			for _, dir := range []string{scripts, bin} {
				if err := os.MkdirAll(dir, 0o700); err != nil {
					t.Fatal(err)
				}
			}
			writeFixture(t, filepath.Join(scripts, "run.sh"), string(data), 0o700)
			writeFixture(t, filepath.Join(bin, "docker"), "#!/bin/sh\nexit 99\n", 0o700)
			writeFixture(t, filepath.Join(root, "fault"), fault+"\n", 0o600)
			writeFixture(t, filepath.Join(bin, "kind"), `#!/bin/sh
set -eu
IFS= read -r fault < "$HOME/fault"
case "$1" in
get)
  case "$fault" in
  discovery) exit 1 ;;
  collision) awk -F= '$1 == "cluster" {print $2}' .scratch/k8s-execution/*/ownership ;;
  esac ;;
create)
  test -s "$MECATL_EXECUTION_QUAL_OUTPUT"
  printf 'creation attempted\n' > "$HOME/attempted"
  exit 1 ;;
*) exit 99 ;;
esac
`, 0o700)
			output := filepath.Join(root, "output")
			marker := filepath.Join(root, "attempted")
			out, err := runStep(t, root, "./deploy/mecatl-execution-kind/run.sh", "PATH="+bin+":"+os.Getenv("PATH"), "CONTAINER_ENGINE=docker", "MECATL_EXECUTION_QUAL_PROFILE=production", "MECATL_EXECUTION_QUAL_OUTPUT="+output)
			if err == nil {
				t.Fatalf("partial production unexpectedly succeeded: %s", out)
			}
			outputs, err := os.ReadFile(output)
			if fault != "partial" {
				if !os.IsNotExist(err) {
					t.Fatal("ownership published before collision/discovery gate")
				}
				if _, err := os.Stat(marker); !os.IsNotExist(err) {
					t.Fatal("creation attempted after failed preflight")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			lines := strings.Split(strings.TrimSpace(string(outputs)), "\n")
			if len(lines) != 2 || !strings.HasPrefix(lines[0], "state=") || !strings.HasPrefix(lines[1], "cluster=mecatl-execution-qual-") {
				t.Fatalf("invalid ownership outputs: %q", outputs)
			}
			state := strings.TrimPrefix(lines[0], "state=")
			ownership, err := os.ReadFile(filepath.Join(state, "ownership"))
			if err != nil || !strings.Contains(string(ownership), lines[1]+"\n") {
				t.Fatal("output does not bind the initial ownership record")
			}
			if _, err := os.Stat(marker); err != nil {
				t.Fatal("fixture did not reach partial cluster creation")
			}
			if _, err := os.Stat(filepath.Join(state, "kubeconfig")); !os.IsNotExist(err) {
				t.Fatal("partial fixture unexpectedly has a kubeconfig")
			}
		})
	}
}
