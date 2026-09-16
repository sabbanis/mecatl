import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentMessage, TurnStats } from "@/features/agent/types";
import { MessageBubble } from "./message-bubble";

/**
 * The per-turn stat line under a FINISHED assistant turn: its tokens sent and
 * received, the model-call time, and a material cache-hit share. It renders
 * on a stats-only turn (no text), never on the in-flight bubble, and never
 * for a trivial turn whose figures are noise.
 */

const stats = (partial: Partial<TurnStats> = {}): TurnStats => ({
  turns: 1,
  inputTokens: 1200,
  outputTokens: 340,
  cacheReadTokens: 420,
  cacheWriteTokens: 0,
  durationMs: 4100,
  lastInputTokens: 1200,
  ...partial,
});

const assistant = (partial: Partial<AgentMessage> = {}): AgentMessage => ({
  id: "m1",
  role: "assistant",
  content: "",
  timestamp: 1_755_000_000_000,
  ...partial,
});

describe("MessageBubble turn stat line", () => {
  it("renders the stat line under a finished turn that carries only stats", () => {
    render(<MessageBubble message={assistant({ turnStats: stats() })} />);
    expect(
      screen.getByText("↑1.2k ↓340 · 4.1s · 35% cached"),
    ).toBeInTheDocument();
  });

  it("renders the stat line alongside the turn's text", () => {
    render(
      <MessageBubble
        message={assistant({ content: "Done.", turnStats: stats() })}
      />,
    );
    expect(screen.getByText("Done.")).toBeInTheDocument();
    expect(screen.getByText(/↑1\.2k ↓340/)).toBeInTheDocument();
  });

  it("holds the stat line back while the turn is still streaming", () => {
    render(
      <MessageBubble
        message={assistant({ content: "Working…", turnStats: stats() })}
        streaming
      />,
    );
    expect(screen.getByText("Working…")).toBeInTheDocument();
    expect(screen.queryByText(/↑1\.2k/)).not.toBeInTheDocument();
  });

  it("renders no stat line for a trivial turn", () => {
    const { container } = render(
      <MessageBubble
        message={assistant({
          content: "ok",
          turnStats: stats({
            inputTokens: 10,
            outputTokens: 3,
            cacheReadTokens: 0,
            durationMs: 400,
            lastInputTokens: 10,
          }),
        })}
      />,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/↑10 ↓3/);
  });

  it("renders nothing at all for a trivial stats-only turn", () => {
    const { container } = render(
      <MessageBubble
        message={assistant({
          turnStats: stats({
            inputTokens: 10,
            outputTokens: 3,
            cacheReadTokens: 0,
            durationMs: 400,
            lastInputTokens: 10,
          }),
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
