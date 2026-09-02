import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAgentChat } from "./use-agent-chat";

// The hook's network surface is exercised against the fixture daemon (e2e);
// here we pin the client-side resting shape every later stage builds on.
vi.mock("../runtime-status", () => ({
  useRuntimeStatus: () => ({
    connected: false,
    features: new Set<string>(),
    serverCapabilities: {},
  }),
}));

describe("useAgentChat", () => {
  it("opens a draft chat idle: empty transcript, no approval, zero usage", () => {
    const { result } = renderHook(() => useAgentChat(null));
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.harnessLive).toBe(false);
    expect(result.current.pendingApproval).toBeNull();
    expect(result.current.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      estimatedCost: null,
    });
  });

  it("refuses to send while the daemon is unreachable — no optimistic bubble", async () => {
    const { result } = renderHook(() => useAgentChat(null));
    await act(async () => {
      await result.current.sendMessage("hello");
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
  });
});
