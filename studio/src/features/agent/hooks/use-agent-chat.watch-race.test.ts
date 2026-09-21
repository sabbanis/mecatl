import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionTranscript } from "@/lib/protocol";
import type { StreamEvent } from "../types";
import { useAgentChat } from "./use-agent-chat";

/**
 * A stale inventory poll landing AFTER this tab's own send has already
 * completed a run must never re-arm the composer as "streaming". This is
 * the race `use-agent-chat.driving.test.ts` cannot exercise: its shared
 * mock omits `watch_session_events`, so neither watch effect ever mounts
 * there. Here it is included so the durable watch (ADR 0250) can attach.
 */

const mocks = vi.hoisted(() => ({
  createHarnessSession: vi.fn(async () => "s1"),
  streamHarnessPrompt: vi.fn(),
  fetchSessionTranscriptMessages: vi.fn(),
  fetchHarnessSessionDetail: vi.fn(async () => ({
    resolvedModel: null,
    capabilities: {},
    tokenUsage: null,
  })),
  // A watch that immediately reaches the replay→live boundary with nothing
  // replayed (this test's simplified stand-in for the daemon's durable log:
  // the run this tab already drove happened over the SDK's own transport,
  // never through this mock, so there is nothing here to replay either),
  // then stays open — matching a real durable watch, which never resolves
  // on its own.
  watchSessionEvents: vi.fn(
    (
      _sessionId: string,
      onDelivery: (delivery: {
        phase: string;
        cursor: string;
        event: null;
      }) => void,
    ) => {
      onDelivery({ phase: "live", cursor: "", event: null });
      return new Promise<void>(() => undefined);
    },
  ),
}));

vi.mock("@/lib/harness/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/harness/client")>()),
  ...mocks,
}));

vi.mock("../runtime-status", () => ({
  useRuntimeStatus: () => ({
    connected: true,
    // watch_session_events ON: this is the axis the sibling driving test
    // cannot cover.
    features: new Set(["http_steer", "watch_session_events"]),
    serverCapabilities: { image: true },
  }),
}));

vi.mock("../composer-capabilities", () => ({
  refreshSlashCommands: vi.fn(async () => undefined),
}));

vi.mock("@/lib/harness/watch", () => ({
  watchSessionEvents: mocks.watchSessionEvents,
}));

vi.mock("@/lib/attachment-store", () => ({
  loadSentAttachments: vi.fn(async () => []),
  saveSentAttachments: vi.fn(async () => undefined),
}));

type Hooks = { onRunStarted?: (runId: string) => void } | undefined;
type PromptArgs = [
  string,
  string,
  unknown[],
  (event: StreamEvent) => void,
  AbortSignal | undefined,
  Hooks,
];

const cleanResult = (text: string): StreamEvent => ({
  type: "run_result",
  stop: "end_turn",
  text,
  errorText: "",
  permanent: false,
});

describe("useAgentChat durable-watch race", () => {
  beforeEach(() => {
    mocks.fetchSessionTranscriptMessages.mockResolvedValue({
      sessionId: "s1",
      complete: true,
      messages: [],
    } satisfies SessionTranscript);
    mocks.streamHarnessPrompt.mockImplementation(
      async (...args: PromptArgs) => {
        const [, , , onEvent, , hooks] = args;
        hooks?.onRunStarted?.("run-prompt");
        onEvent(cleanResult("done"));
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not re-arm streaming when a stale 'running' poll lands after this tab's own send has settled", async () => {
    type Props = { sessionId: string | null; sessionState?: string };
    const { result, rerender } = renderHook<
      ReturnType<typeof useAgentChat>,
      Props
    >(
      (props) =>
        useAgentChat(props.sessionId, { sessionState: props.sessionState }),
      { initialProps: { sessionId: null, sessionState: undefined } },
    );

    await act(async () => {
      await result.current.sendMessage("go");
    });
    // The send has fully settled: this tab drove it, and it ended cleanly.
    expect(result.current.drivingRun).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.isStreaming).toBe(false);

    // The host adopts the minted session id (as chat-workspace.tsx does via
    // onSessionCreated), and its OWN inventory poll — a separate, later
    // fetch — reports the row as still "running": a real staleness window
    // between the daemon recording completion and the next poll observing
    // it. drivingRef is already null, so the durable watch's guard does not
    // recognise this as the run it just finished.
    await act(async () => {
      rerender({ sessionId: "s1", sessionState: "running" });
      await Promise.resolve();
    });

    // This must not read as an active run: the turn is already over, and
    // nothing will ever deliver a fresh terminal for it.
    expect(result.current.status).toBe("idle");
    expect(result.current.isStreaming).toBe(false);
  });
});
