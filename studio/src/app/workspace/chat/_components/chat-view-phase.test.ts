import { describe, expect, it } from "vitest";
import type { AgentMessage } from "@/features/agent/types";
import { awaitingPhaseLabel, streamingSpinnerLabel } from "./chat-view-phase";
import { streamingPhaseLabel } from "./streaming-phase";

const running: AgentMessage = {
  id: "m1",
  role: "assistant",
  content: "partial",
  timestamp: 0,
  toolCalls: [{ callId: "c1", name: "Bash", input: "", status: "running" }],
};

describe("awaitingPhaseLabel", () => {
  it("names the wait while a permission ask is pending", () => {
    expect(awaitingPhaseLabel("approval")).toBe("Awaiting approval");
  });

  it("is null when the run is not parked, so the derived phase applies", () => {
    expect(awaitingPhaseLabel(undefined)).toBeNull();
  });

  it("wins over the derived phase the indicator otherwise shows (the view's `??`)", () => {
    // The composition chat-view.tsx uses: the wait first, the tool/writing
    // phase only when nothing is parked.
    expect(awaitingPhaseLabel("approval") ?? streamingPhaseLabel(running)).toBe(
      "Awaiting approval",
    );
    expect(awaitingPhaseLabel(undefined) ?? streamingPhaseLabel(running)).toBe(
      "Running Bash",
    );
  });
});

describe("streamingSpinnerLabel", () => {
  it("tells the operator the run is waiting on them while an ask is pending", () => {
    expect(streamingSpinnerLabel()).toBe("Generating a response");
    expect(streamingSpinnerLabel("approval")).toBe("Awaiting your approval");
  });
});
