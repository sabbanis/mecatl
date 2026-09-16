import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissionMode } from "@/lib/protocol";
import { useSessionMode } from "./use-session-mode";

/**
 * The composer's permission mode with the DEFERRED mid-run switch (the
 * TUI's `mode <target> pending`). The daemon rejects a mode change while a
 * run is live, so a change made while `busy` is held as `pendingMode` — the
 * confirmed `mode` is untouched — and POSTed exactly once when busy clears,
 * adopting the echo like a direct change. A run parked on an approval is
 * still busy (the caller's `isStreaming` includes it), a reconnect blip
 * keeps the hold, switching chats drops it, and re-picking the confirmed
 * mode cancels it. The daemon client is mocked at the module boundary.
 */

const { fetchHarnessSessionMode, setHarnessSessionMode, runtime } = vi.hoisted(
  () => ({
    fetchHarnessSessionMode: vi.fn(),
    setHarnessSessionMode: vi.fn(),
    runtime: { connected: true },
  }),
);

vi.mock("@/lib/harness/client", () => ({
  fetchHarnessSessionMode,
  setHarnessSessionMode,
}));

vi.mock("../runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

type Props = { sessionId: string | null; busy: boolean };

const mount = (initial: Props) =>
  renderHook(
    ({ sessionId, busy }: Props) => useSessionMode(sessionId, { busy }),
    { initialProps: initial },
  );

beforeEach(() => {
  runtime.connected = true;
  fetchHarnessSessionMode.mockReset();
  setHarnessSessionMode.mockReset();
  fetchHarnessSessionMode.mockResolvedValue("default" as SessionPermissionMode);
  setHarnessSessionMode.mockImplementation(
    async (_id: string, next: SessionPermissionMode) => next,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSessionMode (deferred switch)", () => {
  it("POSTs a change made while idle right away and adopts the echo", async () => {
    const { result } = mount({ sessionId: "s1", busy: false });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    await waitFor(() =>
      expect(setHarnessSessionMode).toHaveBeenCalledWith("s1", "plan"),
    );
    await waitFor(() => expect(result.current.mode).toBe("plan"));
    expect(result.current.pendingMode).toBeNull();
  });

  it("holds a change made while busy as pendingMode and POSTs it once when busy clears", async () => {
    const { result, rerender } = mount({ sessionId: "s1", busy: true });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("acceptEdits"));
    // Held, not sent: the confirmed mode stays what the daemon said.
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("default");
    expect(result.current.pendingMode).toBe("acceptEdits");

    // A run parked on an approval is still busy (the caller's isStreaming
    // includes waiting_approval): the hold keeps waiting.
    rerender({ sessionId: "s1", busy: true });
    expect(setHarnessSessionMode).not.toHaveBeenCalled();

    rerender({ sessionId: "s1", busy: false });
    await waitFor(() =>
      expect(setHarnessSessionMode).toHaveBeenCalledWith("s1", "acceptEdits"),
    );
    await waitFor(() => expect(result.current.mode).toBe("acceptEdits"));
    expect(result.current.pendingMode).toBeNull();
    // Exactly once — the hold is consumed, never replayed.
    rerender({ sessionId: "s1", busy: false });
    expect(setHarnessSessionMode).toHaveBeenCalledTimes(1);
  });

  it("keeps the last pick when the user changes their mind mid-run", async () => {
    const { result, rerender } = mount({ sessionId: "s1", busy: true });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    act(() => result.current.changeMode("acceptEdits"));
    expect(result.current.pendingMode).toBe("acceptEdits");

    rerender({ sessionId: "s1", busy: false });
    await waitFor(() =>
      expect(setHarnessSessionMode).toHaveBeenCalledWith("s1", "acceptEdits"),
    );
    expect(setHarnessSessionMode).toHaveBeenCalledTimes(1);
  });

  it("cancels the hold when the confirmed mode is picked back", async () => {
    const { result, rerender } = mount({ sessionId: "s1", busy: true });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    expect(result.current.pendingMode).toBe("plan");
    act(() => result.current.changeMode("default"));
    expect(result.current.pendingMode).toBeNull();

    rerender({ sessionId: "s1", busy: false });
    // Nothing to land: no round-trip at all.
    await act(async () => {
      await Promise.resolve();
    });
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
  });

  it("survives a reconnect blip and lands once the daemon is reachable again", async () => {
    const { result, rerender } = mount({ sessionId: "s1", busy: true });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    runtime.connected = false;
    rerender({ sessionId: "s1", busy: false });
    // Unreachable: the hold waits rather than firing a doomed POST.
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
    expect(result.current.pendingMode).toBe("plan");

    runtime.connected = true;
    rerender({ sessionId: "s1", busy: false });
    await waitFor(() =>
      expect(setHarnessSessionMode).toHaveBeenCalledWith("s1", "plan"),
    );
    expect(setHarnessSessionMode).toHaveBeenCalledTimes(1);
  });

  it("drops a hold when the chat changes — it never lands on another session", async () => {
    const { result, rerender } = mount({ sessionId: "s1", busy: true });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    expect(result.current.pendingMode).toBe("plan");

    rerender({ sessionId: "s2", busy: false });
    await waitFor(() =>
      expect(fetchHarnessSessionMode).toHaveBeenCalledWith(
        "s2",
        expect.anything(),
      ),
    );
    expect(result.current.pendingMode).toBeNull();
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
  });

  it("still rolls a refused direct change back", async () => {
    setHarnessSessionMode.mockRejectedValueOnce(new Error("mid-turn"));
    const { result } = mount({ sessionId: "s1", busy: false });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());

    act(() => result.current.changeMode("plan"));
    await waitFor(() => expect(result.current.mode).toBe("default"));
    expect(result.current.pendingMode).toBeNull();
  });

  it("refreshMode re-adopts the daemon's word (a plan run flips the mode at its terminal)", async () => {
    const { result } = mount({ sessionId: "s1", busy: false });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());
    expect(result.current.mode).toBe("default");

    fetchHarnessSessionMode.mockResolvedValueOnce(
      "acceptEdits" as SessionPermissionMode,
    );
    act(() => result.current.refreshMode());
    await waitFor(() => expect(result.current.mode).toBe("acceptEdits"));
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
  });

  it("holds a draft's pick locally regardless of busy", () => {
    const { result } = mount({ sessionId: null, busy: true });
    act(() => result.current.changeMode("acceptEdits"));
    expect(result.current.mode).toBe("acceptEdits");
    expect(result.current.modeRef.current).toBe("acceptEdits");
    expect(result.current.pendingMode).toBeNull();
    expect(setHarnessSessionMode).not.toHaveBeenCalled();
  });

  it("refreshMode keeps the shown mode when the re-read fails", async () => {
    const { result } = mount({ sessionId: "s1", busy: false });
    await waitFor(() => expect(fetchHarnessSessionMode).toHaveBeenCalled());
    fetchHarnessSessionMode.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.refreshMode());
    await waitFor(() =>
      expect(fetchHarnessSessionMode).toHaveBeenCalledTimes(2),
    );
    expect(result.current.mode).toBe("default");
  });

  it("refreshMode is a no-op for a draft (no daemon session to read)", () => {
    const { result } = mount({ sessionId: null, busy: false });
    act(() => result.current.refreshMode());
    expect(fetchHarnessSessionMode).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("default");
  });
});
