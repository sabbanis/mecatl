import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetHarnessClient } from "@/lib/harness/sdk";
import {
  jsonResponse,
  type RecordedRequest,
  stubHarnessFetch,
} from "@/lib/harness/sdk-test-stub";
import { useAgentMemory, useMemoryEntryDetail } from "./use-agent-memory";

/**
 * The user-model hooks over the real SDK path: the index read's footprint
 * (count · bytes · sha256) and the lazy key-scoped detail read the TUI's
 * `enter` performs — its decoded revisions, the honest "stale" answer when
 * the key no longer matches, and the typed --no-user-model refusal.
 */

vi.mock("../runtime-status", () => ({
  useRuntimeStatus: () => ({
    connected: true,
    features: new Set<string>(),
    serverCapabilities: {},
  }),
}));

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

const INDEX = {
  entries: [
    { key: "editor", description: "Prefers vim" },
    { key: "prefers-tabs", description: "Tabs over spaces" },
  ],
  size_bytes: 64,
  sha256: "f".repeat(64),
};

const DETAIL = {
  current: {
    key: "prefers-tabs",
    value: "Tabs, width 4",
    description: "Tabs over spaces",
    version: "3",
    status: "active",
    writer: "agent",
    origin: "reflection",
    source_session_id: "s-1",
    updated_at: { seconds: 1_755_000_000 },
  },
  history: [
    {
      version: "2",
      status: "superseded",
      updated_at: { seconds: 1_754_000_000 },
    },
  ],
  history_available: true,
};

function keyOf(request: RecordedRequest): string | null {
  return new URL(request.url, "http://studio").searchParams.get("key");
}

describe("useAgentMemory store footprint", () => {
  it("carries the index count, byte size and digest", async () => {
    stubHarnessFetch(() => INDEX);
    const { result } = renderHook(() => useAgentMemory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.store).toEqual({
      count: 2,
      sizeBytes: 64,
      sha256: "f".repeat(64),
    });
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      "editor",
      "prefers-tabs",
    ]);
    expect(result.current.canWrite).toBe(false);
  });

  it("keeps the footprint empty on a --no-user-model daemon (a DISABLED state)", async () => {
    stubHarnessFetch(() =>
      jsonResponse(501, {
        code: "unimplemented",
        error: "user model is disabled",
      }),
    );
    const { result } = renderHook(() => useAgentMemory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.disabledReason).toBeTruthy();
    expect(result.current.store).toEqual({
      count: 0,
      sizeBytes: 0,
      sha256: "",
    });
  });
});

describe("useMemoryEntryDetail", () => {
  it("reads the fact by key and decodes value, provenance and history", async () => {
    const stub = stubHarnessFetch((request) =>
      keyOf(request) === "prefers-tabs" ? { ...INDEX, detail: DETAIL } : INDEX,
    );
    const { result } = renderHook(() => useMemoryEntryDetail("prefers-tabs"));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(keyOf(stub.last())).toBe("prefers-tabs");
    expect(result.current.error).toBeNull();
    expect(result.current.stale).toBe(false);
    expect(result.current.detail).toMatchObject({
      current: {
        value: "Tabs, width 4",
        writer: "agent",
        origin: "reflection",
        sourceSessionId: "s-1",
        updatedAtUnix: 1_755_000_000,
      },
      history: [{ version: "2", status: "superseded" }],
      historyAvailable: true,
    });
  });

  it("marks the entry stale when the daemon answers without detail", async () => {
    stubHarnessFetch(() => INDEX);
    const { result } = renderHook(() => useMemoryEntryDetail("gone"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(result.current.stale).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces the daemon's refusal as `error`, never as placeholder content", async () => {
    stubHarnessFetch(() =>
      jsonResponse(501, {
        code: "unimplemented",
        error: "user model is disabled",
      }),
    );
    const { result } = renderHook(() => useMemoryEntryDetail("editor"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(result.current.stale).toBe(false);
    expect(result.current.error).toContain("disabled");
  });

  it("re-reads when the key changes and never shows the earlier key's answer", async () => {
    const stub = stubHarnessFetch((request) => {
      const key = keyOf(request);
      if (key === "prefers-tabs") return { ...INDEX, detail: DETAIL };
      if (key === "editor") {
        return {
          ...INDEX,
          detail: {
            ...DETAIL,
            current: { ...DETAIL.current, key: "editor", value: "vim" },
          },
        };
      }
      return INDEX;
    });
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useMemoryEntryDetail(key),
      { initialProps: { key: "prefers-tabs" } },
    );
    await waitFor(() =>
      expect(result.current.detail?.current.value).toBe("Tabs, width 4"),
    );
    rerender({ key: "editor" });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() =>
      expect(result.current.detail?.current.value).toBe("vim"),
    );
    expect(stub.requests.map(keyOf)).toEqual(["prefers-tabs", "editor"]);
  });
});
