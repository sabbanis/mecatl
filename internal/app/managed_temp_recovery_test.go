//go:build linux || darwin

package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/agents"
	"github.com/stacklok/mecatl/internal/adapter/hookexec"
	"github.com/stacklok/mecatl/internal/adapter/server"
)

func TestManagedTempRecoveryContinuedSessionAndWritableSubagent(t *testing.T) {
	for _, recreate := range []bool{false, true} {
		t.Run(map[bool]string{false: "deleted", true: "recreated"}[recreate], func(t *testing.T) {
			var requests atomic.Int32
			provider := mockllm.NewWith([]mockllm.Option{
				mockllm.WithRequestObserver(func(req port.LLMRequest) {
					requests.Add(1)
					if !slices.ContainsFunc(req.Tools, func(spec tool.ToolSpec) bool { return spec.Name == "Shell" }) {
						t.Error("main or direct-write child request lost Shell")
					}
				}),
			},
				mockllm.ToolCallTurn(session.NewToolCall("before", "Shell", []byte(`{"command":"printf before-recovery"}`))),
				mockllm.TextTurn("first run complete"),
				mockllm.ToolCallTurn(session.NewToolCall("after", "Shell", []byte(`{"command":"printf after-recovery"}`))),
				mockllm.ToolCallTurn(session.NewToolCall("delegate", "Subagent", []byte(`{"prompt":"write the proof using Shell","mode":"read-write"}`))),
				mockllm.ToolCallTurn(session.NewToolCall("child-bash", "Shell", []byte(`{"command":"printf child-recovered > recovered-child.txt"}`))),
				mockllm.TextTurn("child complete"),
				mockllm.TextTurn("continued run complete"),
			)
			cfg := recoveryBuildConfig(t, provider)
			built, err := Build(context.Background(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer built.Close()
			sess, err := built.Service.CreateSession(context.Background(), session.ModeDefault, session.Limits{MaxTurns: 10})
			if err != nil {
				t.Fatal(err)
			}
			assertRecoveryRun(t, built.Service, sess.ID, "before-recovery")
			if err := os.RemoveAll(cfg.temporaryStorage.ManagedRoot); err != nil {
				t.Fatal(err)
			}
			if recreate {
				if err := os.Mkdir(cfg.temporaryStorage.ManagedRoot, 0o700); err != nil {
					t.Fatal(err)
				}
			}
			assertRecoveryRun(t, built.Service, sess.ID, "after-recovery")
			data, err := os.ReadFile(filepath.Join(cfg.Workspace, "recovered-child.txt"))
			if err != nil || string(data) != "child-recovered" {
				t.Fatalf("direct-write child did not execute Shell in parent workspace: %q, %v", data, err)
			}
			if got := requests.Load(); got != 7 {
				t.Fatalf("provider requests = %d, want 7 including child", got)
			}
		})
	}
}

func TestManagedTempRecoveryWritableChildConstruction(t *testing.T) {
	cfg := managedLeaseConfig(t, t.TempDir(), filepath.Join(t.TempDir(), "managed"))
	cfg.Model = "mock"
	cfg.AllowAllTools = true
	if runner, err := commandRunnerForRoot(cfg, cfg.Workspace); err != nil || runner == nil {
		t.Fatalf("initial runner: %v, %v", runner, err)
	}
	if err := os.RemoveAll(cfg.temporaryStorage.ManagedRoot); err != nil {
		t.Fatal(err)
	}
	var removed atomic.Bool
	provider := mockllm.NewWith([]mockllm.Option{mockllm.WithRequestObserver(func(port.LLMRequest) {
		if removed.CompareAndSwap(false, true) {
			// The child engine and parent runner already exist, and the writable
			// preflight just succeeded. Allocation must recover independently.
			if err := os.Rename(cfg.temporaryStorage.ManagedRoot, cfg.temporaryStorage.ManagedRoot+"-after-construction"); err != nil {
				t.Error(err)
			}
		}
	})},
		mockllm.ToolCallTurn(session.NewToolCall("proof", "Shell", []byte(`{"command":"printf constructed > constructed-child.txt"}`))),
		mockllm.TextTurn("done"),
	)
	child, closeFn := buildSubagentTool(context.Background(),
		cfg, regForTest(provider, providerMock, cfg.Model), provider, providerMock, cfg.Model,
		hookexec.New(nil), agents.NewRegistry(nil), nil, nil, nil, catalogAssets{}, false)
	if closeFn != nil {
		defer func() { _ = closeFn() }()
	}
	runner, err := commandRunnerForRoot(cfg, cfg.Workspace)
	if err != nil {
		t.Fatal(err)
	}
	result, err := child.Execute(context.Background(),
		session.NewToolCall("delegate", "Subagent", []byte(`{"prompt":"write the proof","mode":"read-write"}`)),
		osfsEnvironment(t, cfg.Workspace, runner))
	if err != nil || result.IsError {
		t.Fatalf("direct-write child after namespace recovery: %v, %+v", err, result)
	}
	data, err := os.ReadFile(filepath.Join(cfg.Workspace, "constructed-child.txt"))
	if err != nil || string(data) != "constructed" {
		t.Fatalf("child constructed after deletion lost Shell: %q, %v", data, err)
	}
}

func TestManagedTempRecoveryFailureRejectsContinuedSession(t *testing.T) {
	var requests atomic.Int32
	provider := mockllm.NewWith([]mockllm.Option{
		mockllm.WithRequestObserver(func(port.LLMRequest) { requests.Add(1) }),
	}, mockllm.TextTurn("ready"),
		mockllm.ToolCallTurn(session.NewToolCall("must-not-start", "Subagent", []byte(`{"prompt":"requires Shell","mode":"read-write"}`))),
	)
	cfg := recoveryBuildConfig(t, provider)
	built, err := Build(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer built.Close()
	sess, err := built.Service.CreateSession(context.Background(), session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatal(err)
	}
	run, err := built.Service.StartRunContent(context.Background(), sess.ID, "first", nil)
	if err != nil {
		t.Fatal(err)
	}
	for range run.Events() {
	}
	if err := os.RemoveAll(cfg.temporaryStorage.ManagedRoot); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, cfg.temporaryStorage.ManagedRoot); err != nil {
		t.Fatal(err)
	}
	run, err = built.Service.StartRunContent(context.Background(), sess.ID, "delegate shell-required work", nil)
	if err == nil {
		run.Cancel()
		for range run.Events() {
		}
		t.Fatal("unsafe managed root became a valid shell-less run")
	}
	if !errors.Is(err, server.ErrPlacementUnavailable) || !strings.Contains(err.Error(), "managed temporary storage") || !strings.Contains(err.Error(), "retry") || strings.Contains(err.Error(), cfg.temporaryStorage.ManagedRoot) || strings.Contains(err.Error(), outside) {
		t.Fatalf("continuation must have a redacted actionable placement error: %v", err)
	}
	if requests.Load() != 1 {
		t.Fatal("main/child model started despite failed placement reattachment")
	}
	entries, err := os.ReadDir(outside)
	if err != nil || len(entries) != 0 {
		t.Fatalf("unsafe replacement target changed: %v, %v", entries, err)
	}
}

func TestManagedTempRecoveryFailureDeclinesWritableChild(t *testing.T) {
	cfg := managedLeaseConfig(t, t.TempDir(), filepath.Join(t.TempDir(), "managed"))
	cfg.TrustProject = true
	cfg.AllowAllTools = true
	cfg.Model = "mock"
	runner, err := commandRunnerForRoot(cfg, cfg.Workspace)
	if err != nil {
		t.Fatal(err)
	}
	parent := osfsEnvironment(t, cfg.Workspace, runner)
	if err := os.RemoveAll(cfg.temporaryStorage.ManagedRoot); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cfg.temporaryStorage.ManagedRoot, []byte("unsafe replacement"), 0o600); err != nil {
		t.Fatal(err)
	}
	var requests atomic.Int32
	provider := mockllm.NewWith([]mockllm.Option{
		mockllm.WithRequestObserver(func(port.LLMRequest) { requests.Add(1) }),
	}, mockllm.ToolCallTurn(session.NewToolCall("retry-bash", "Shell", []byte(`{"command":"printf retried > retry-proof.txt"}`))), mockllm.TextTurn("recovered"))
	reg := regForTest(provider, providerMock, cfg.Model)
	child, closeFn := buildSubagentTool(context.Background(),
		cfg, reg, provider, providerMock, cfg.Model,
		hookexec.New(nil), agents.NewRegistry(nil), nil, nil, nil, catalogAssets{}, false)
	if closeFn != nil {
		defer func() { _ = closeFn() }()
	}
	for name, args := range map[string]string{
		"read-only":      `{"prompt":"requires Shell"}`,
		"writable":       `{"prompt":"requires Shell","mode":"read-write"}`,
		"writable-model": `{"prompt":"requires Shell","mode":"read-write","model":"override"}`,
	} {
		t.Run(name, func(t *testing.T) {
			result, err := child.Execute(context.Background(), session.NewToolCall(session.ToolCallID(name), "Subagent", []byte(args)), parent)
			if err == nil && !result.IsError {
				t.Fatal("failed child runner construction became a clean shell-less child")
			}
			if !strings.Contains(result.Content, "managed temporary storage") || !strings.Contains(result.Content, "retry") || strings.Contains(result.Content, cfg.temporaryStorage.ManagedRoot) {
				t.Fatalf("runner failure disguised as unsupported capability or leaked path: %s", result.Content)
			}
		})
	}
	factory := buildWritableSubagentEngineFactory(cfg, reg, provider, providerMock, cfg.Model)
	if engine, ok := factory("override"); !ok || engine == nil {
		t.Fatal("runner failure must not masquerade as unsupported model capability")
	}
	if requests.Load() != 0 {
		t.Fatal("child model started despite runner construction failure")
	}
	if err := os.Rename(cfg.temporaryStorage.ManagedRoot, cfg.temporaryStorage.ManagedRoot+"-unsafe"); err != nil {
		t.Fatal(err)
	}
	result, err := child.Execute(context.Background(), session.NewToolCall("retry", "Subagent", []byte(`{"prompt":"try again","mode":"read-write"}`)), parent)
	if err != nil || result.IsError {
		t.Fatalf("cached writable engine did not recover on retry: %+v, %v", result, err)
	}
	data, err := os.ReadFile(filepath.Join(cfg.Workspace, "retry-proof.txt"))
	if err != nil || string(data) != "retried" || requests.Load() != 2 {
		t.Fatalf("retry did not execute Shell: %q, %v, requests=%d", data, err, requests.Load())
	}
}

func TestManagedTempRecoveryPreservesDisabledShell(t *testing.T) {
	cfg := managedLeaseConfig(t, t.TempDir(), filepath.Join(t.TempDir(), "managed"))
	if err := os.RemoveAll(cfg.temporaryStorage.ManagedRoot); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cfg.temporaryStorage.ManagedRoot, []byte("unsafe replacement"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, noShell := range []bool{false, true} {
		cfg.NoShell = noShell
		cfg.Shell = ""
		if noShell {
			cfg.Shell = "/bin/sh"
		}
		runner, err := commandRunnerForRoot(cfg, cfg.Workspace)
		if err != nil || runner != nil {
			t.Fatalf("intentional shell-less construction = %v, %v", runner, err)
		}
	}
	cfg.NoShell = false
	cfg.Shell = "/bin/sh"
	if runner, err := commandRunnerForRoot(cfg, cfg.Workspace); runner != nil || err == nil || !strings.Contains(err.Error(), "managed temporary storage") {
		t.Fatalf("configured shell failure must be explicit: %v, %v", runner, err)
	}
}

func TestManagedTempRecoveryDoesNotGateShelllessSessions(t *testing.T) {
	for _, profile := range []server.SessionProfile{server.ProfileDefault, server.ProfileNoFS} {
		t.Run(string(profile), func(t *testing.T) {
			var requests atomic.Int32
			provider := mockllm.NewWith([]mockllm.Option{mockllm.WithRequestObserver(func(req port.LLMRequest) {
				requests.Add(1)
				if slices.ContainsFunc(req.Tools, func(spec tool.ToolSpec) bool { return spec.Name == "Shell" }) {
					t.Error("intentional shell-less session advertised Shell")
				}
			})}, mockllm.TextTurn("ready"), mockllm.TextTurn("still ready"))
			cfg := recoveryBuildConfig(t, provider)
			cfg.NoShell = profile == server.ProfileDefault
			built, err := Build(context.Background(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer built.Close()
			// Damage the managed root after Build. Neither Bind nor Reattach for
			// these intentional shell-less sessions should consult it.
			if err := os.Rename(cfg.temporaryStorage.ManagedRoot, cfg.temporaryStorage.ManagedRoot+"-retired"); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(cfg.temporaryStorage.ManagedRoot, []byte("unsafe"), 0o600); err != nil {
				t.Fatal(err)
			}
			sess, err := built.Service.CreateSessionWithProfile(context.Background(), session.ModeDefault, session.Limits{}, server.ProviderSelector{}, profile)
			if err != nil {
				t.Fatal(err)
			}
			for range 2 {
				run, err := built.Service.StartRunContent(context.Background(), sess.ID, "continue", nil)
				if err != nil {
					t.Fatal(err)
				}
				var completed bool
				for ev := range run.Events() {
					if ev.Result != nil {
						completed = ev.Result.Stop == session.StopEndTurn
					}
				}
				if !completed {
					t.Fatal("shell-less session did not complete")
				}
			}
			if requests.Load() != 2 {
				t.Fatalf("requests = %d, want 2", requests.Load())
			}
		})
	}
}

func recoveryBuildConfig(t *testing.T, provider port.LLMProvider) Config {
	t.Helper()
	return Config{
		Workspace: t.TempDir(), Model: "mock", MockProvider: provider,
		Shell: "/bin/sh", Headless: true, Posture: PostureAuto,
		NoSoul: true, StoreDir: t.TempDir(), MemoryDir: t.TempDir(),
		Diagnostics: port.NopDiagnostics{},
		temporaryStorage: temporaryStorageConfig{
			Mode: temporaryStorageManaged, ManagedRoot: filepath.Join(t.TempDir(), "managed"), SystemTempDir: t.TempDir(),
		},
	}
}

func assertRecoveryRun(t *testing.T, svc *server.Service, id session.SessionID, output string) {
	t.Helper()
	run, err := svc.StartRunContent(context.Background(), id, "execute the work", nil)
	if err != nil {
		t.Fatalf("StartRunContent: %v", err)
	}
	var manifests, bashResults int
	var completed bool
	for ev := range run.Events() {
		if ev.RequestManifest != nil {
			manifests++
			if !slices.Contains(ev.RequestManifest.ToolNames, "Shell") {
				t.Error("continued request manifest omitted Shell")
			}
			var advertised bool
			for _, decision := range ev.RequestManifest.ToolDecisions {
				if decision.Name == "Shell" {
					advertised = advertised || decision.Decision == session.RequestToolAdvertised
					if decision.Decision == session.RequestToolMountUnavailable {
						t.Error("recovered Shell reported mount_unavailable")
					}
				}
			}
			if !advertised {
				t.Error("request manifest lacks Shell advertised decision")
			}
		}
		if ev.ToolResult != nil {
			if ev.ToolResult.IsError {
				t.Errorf("tool failed: %s", ev.ToolResult.Content)
			}
			if strings.Contains(ev.ToolResult.Content, output) {
				bashResults++
			}
		}
		if ev.Result != nil {
			completed = ev.Result.Stop == session.StopEndTurn
		}
	}
	if manifests == 0 || bashResults == 0 || !completed {
		t.Fatalf("missing successful Shell evidence: manifests=%d output=%d completed=%v", manifests, bashResults, completed)
	}
}
