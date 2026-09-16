import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BuiltinSlashDeps,
  CLEAR_WHILE_STREAMING,
  CLEARED_TOAST,
  COMPACT_NONE_YET,
  COMPACT_WHILE_STREAMING,
  DIAGNOSTICS_WHILE_STREAMING,
  RETRY_NOTHING_FAILED,
  RETRY_WHILE_STREAMING,
  SESSION_NONE_YET,
  useBuiltinSlashCommands,
} from "./use-builtin-slash-commands";

/**
 * Pins the chat workspace's built-in dispatch: each of the six commands, its
 * idle/streaming/no-session refusals (a refusal keeps the composer text and
 * carries the plain warning), `/clear` driving the ClearSession successor
 * and adopting it, `/retry` acting ONLY on a held failure (never re-sending
 * a successful turn), and `/diagnostics` being the one built-in that sends —
 * the sanitized report, as a prompt.
 */

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const runtime = vi.hoisted(() => ({
  mode: "external" as "managed" | "external",
  deployment: "staging-eu",
}));
vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => ({
    mode: runtime.mode,
    deployment: runtime.deployment,
    serverCapabilities: {},
  }),
}));

const harness = vi.hoisted(() => ({
  clear: vi.fn(),
  identity: vi.fn(),
  serverInfo: vi.fn(),
}));
vi.mock("@/lib/harness/sessions", () => ({
  clearHarnessSession: harness.clear,
  fetchHarnessSessionIdentity: harness.identity,
}));
vi.mock("@/lib/harness/server-info", () => ({
  fetchHarnessServerInfo: harness.serverInfo,
}));

function makeDeps(overrides: Partial<BuiltinSlashDeps> = {}): BuiltinSlashDeps {
  return {
    sessionId: "s1",
    isStreaming: false,
    hasFailedStep: false,
    compactSupported: true,
    onCompact: vi.fn(),
    onRetry: vi.fn(),
    onSend: vi.fn(),
    onClearQueue: vi.fn(),
    onSessionCleared: vi.fn(),
    resolvedModel: { providerId: "openrouter", modelId: "openai/gpt-5" },
    permissionMode: "default",
    ...overrides,
  };
}

beforeEach(() => {
  harness.clear.mockReset();
  harness.clear.mockResolvedValue("s2");
  harness.identity.mockReset();
  harness.identity.mockResolvedValue({
    id: "s1",
    title: "Chat",
    titleProvenance: "",
    state: "idle",
    kind: "main",
    mode: "default",
    resolvedModel: null,
    placement: null,
    createdAtUnix: 0,
    turns: 0,
    toolCalls: 0,
    limits: null,
    relationship: null,
  });
  harness.serverInfo.mockReset();
  harness.serverInfo.mockResolvedValue({
    buildId: "fixture",
    serverImplementation: "fixture-daemon",
    providerEndpoint: "https://openrouter.ai/api/v1",
  });
});

describe("useBuiltinSlashCommands", () => {
  it("gates /compact on manual compaction", () => {
    const { result, rerender } = renderHook(
      (deps: BuiltinSlashDeps) => useBuiltinSlashCommands(deps),
      { initialProps: makeDeps({ compactSupported: false }) },
    );
    expect(result.current.builtinGates).toEqual({ manualCompaction: false });
    rerender(makeDeps({ compactSupported: true }));
    expect(result.current.builtinGates).toEqual({ manualCompaction: true });
  });

  it("/help opens the shortcuts reference", () => {
    const { result } = renderHook(() => useBuiltinSlashCommands(makeDeps()));
    expect(result.current.handleSlashBuiltin("help")).toEqual({ ok: true });
    expect(router.push).toHaveBeenCalledWith("/workspace/shortcuts");
  });

  describe("/clear", () => {
    it("refuses while a run is active", () => {
      const deps = makeDeps({ isStreaming: true });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("clear")).toEqual({
        ok: false,
        warning: CLEAR_WHILE_STREAMING,
      });
      expect(harness.clear).not.toHaveBeenCalled();
    });

    it("on a draft drops the held queue and clears the composer", () => {
      const deps = makeDeps({ sessionId: null });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("clear")).toEqual({ ok: true });
      expect(deps.onClearQueue).toHaveBeenCalledTimes(1);
      expect(harness.clear).not.toHaveBeenCalled();
    });

    it("drives the ClearSession successor and adopts it", async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("clear")).toEqual({ ok: true });
      await waitFor(() =>
        expect(deps.onSessionCleared).toHaveBeenCalledWith("s2"),
      );
      expect(harness.clear).toHaveBeenCalledWith("s1");
      expect(deps.onClearQueue).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(CLEARED_TOAST),
      );
    });

    it("surfaces a daemon refusal as a toast", async () => {
      harness.clear.mockRejectedValue(new Error("session is running"));
      const deps = makeDeps();
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      result.current.handleSlashBuiltin("clear");
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("session is running"),
      );
      expect(deps.onSessionCleared).not.toHaveBeenCalled();
    });
  });

  describe("/retry", () => {
    it("refuses while a run is active", () => {
      const deps = makeDeps({ isStreaming: true, hasFailedStep: true });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("retry")).toEqual({
        ok: false,
        warning: RETRY_WHILE_STREAMING,
      });
      expect(deps.onRetry).not.toHaveBeenCalled();
    });

    it("never re-sends a turn that did not fail", () => {
      const deps = makeDeps({ hasFailedStep: false });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("retry")).toEqual({
        ok: false,
        warning: RETRY_NOTHING_FAILED,
      });
      expect(deps.onRetry).not.toHaveBeenCalled();
    });

    it("re-drives the failed step when one is held", () => {
      const deps = makeDeps({ hasFailedStep: true });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("retry")).toEqual({ ok: true });
      expect(deps.onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("/compact", () => {
    it("refuses when the daemon lacks manual compaction", () => {
      const deps = makeDeps({ compactSupported: false });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("compact")).toEqual({
        ok: false,
        warning: "/compact is not available on this daemon",
      });
    });

    it("refuses while streaming and on a draft, otherwise compacts", () => {
      const streaming = makeDeps({ isStreaming: true });
      expect(
        renderHook(() =>
          useBuiltinSlashCommands(streaming),
        ).result.current.handleSlashBuiltin("compact"),
      ).toEqual({ ok: false, warning: COMPACT_WHILE_STREAMING });
      const draft = makeDeps({ sessionId: null });
      expect(
        renderHook(() =>
          useBuiltinSlashCommands(draft),
        ).result.current.handleSlashBuiltin("compact"),
      ).toEqual({ ok: false, warning: COMPACT_NONE_YET });
      const idle = makeDeps();
      expect(
        renderHook(() =>
          useBuiltinSlashCommands(idle),
        ).result.current.handleSlashBuiltin("compact"),
      ).toEqual({ ok: true });
      expect(idle.onCompact).toHaveBeenCalledTimes(1);
    });
  });

  describe("/diagnostics", () => {
    it("refuses while a run is active", () => {
      const deps = makeDeps({ isStreaming: true });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("diagnostics")).toEqual({
        ok: false,
        warning: DIAGNOSTICS_WHILE_STREAMING,
      });
      expect(deps.onSend).not.toHaveBeenCalled();
    });

    it("sends the sanitized report as a prompt", async () => {
      const deps = makeDeps({ permissionMode: "acceptEdits" });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("diagnostics")).toEqual({
        ok: true,
      });
      await waitFor(() => expect(deps.onSend).toHaveBeenCalledTimes(1));
      expect(harness.serverInfo).toHaveBeenCalledWith("openrouter");
      const report = (deps.onSend as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      const lines = report.split("\n");
      expect(lines[0]).toBe("Mecatl diagnostics (current client state only):");
      expect(lines).toContain("server mode: external");
      expect(lines).toContain("server build: fixture");
      expect(lines).toContain("server implementation: fixture-daemon");
      expect(lines).toContain(
        "LLM provider endpoint: https://openrouter.ai/api/v1",
      );
      expect(lines).toContain("deployment: staging-eu");
      expect(lines).toContain("active provider: openrouter");
      expect(lines).toContain("active model: openai/gpt-5");
      expect(lines).toContain("permission mode: acceptEdits");
    });

    it("still sends when the identity probe fails, reading unavailable", async () => {
      harness.serverInfo.mockRejectedValue(new Error("offline"));
      const deps = makeDeps({ resolvedModel: null });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      result.current.handleSlashBuiltin("diagnostics");
      await waitFor(() => expect(deps.onSend).toHaveBeenCalledTimes(1));
      const report = (deps.onSend as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      expect(report).toContain("server build: unavailable");
      expect(report).toContain("active model: unavailable");
    });
  });

  describe("/session", () => {
    it("refuses on a draft", () => {
      const deps = makeDeps({ sessionId: null });
      const { result } = renderHook(() => useBuiltinSlashCommands(deps));
      expect(result.current.handleSlashBuiltin("session")).toEqual({
        ok: false,
        warning: SESSION_NONE_YET,
      });
    });

    it("opens the details dialog for the active session", async () => {
      const { result } = renderHook(() => useBuiltinSlashCommands(makeDeps()));
      const view = render(result.current.sessionDetailsDialog);
      expect(screen.queryByRole("dialog")).toBeNull();
      act(() => {
        expect(result.current.handleSlashBuiltin("session")).toEqual({
          ok: true,
        });
      });
      view.rerender(result.current.sessionDetailsDialog);
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Session details")).toBeInTheDocument();
      await waitFor(() =>
        expect(harness.identity).toHaveBeenCalledWith(
          "s1",
          expect.any(AbortSignal),
        ),
      );
    });

    it("opens the same dialog from the menu item / ⌘I, carrying the row extras", async () => {
      const { result } = renderHook(() =>
        useBuiltinSlashCommands(
          makeDeps({
            sessionDetails: { canCopyId: false, copyIdReason: "inspect_only" },
          }),
        ),
      );
      const view = render(result.current.sessionDetailsDialog);
      act(() => result.current.openSessionDetails());
      view.rerender(result.current.sessionDetailsDialog);
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      await waitFor(() =>
        expect(harness.identity).toHaveBeenCalledWith(
          "s1",
          expect.any(AbortSignal),
        ),
      );
      // The inventory row's copy_id denial reaches the dialog's Copy button.
      expect(
        screen.getByRole("button", { name: "Copy session ID" }),
      ).toBeDisabled();
    });

    it("says there is no session yet when opened on a draft", () => {
      const { result } = renderHook(() =>
        useBuiltinSlashCommands(makeDeps({ sessionId: null })),
      );
      render(result.current.sessionDetailsDialog);
      act(() => result.current.openSessionDetails());
      expect(toast.info).toHaveBeenCalledWith(SESSION_NONE_YET);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(harness.identity).not.toHaveBeenCalled();
    });
  });
});
