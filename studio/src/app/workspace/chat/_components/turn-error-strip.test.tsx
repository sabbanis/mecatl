import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TurnErrorStrip } from "./turn-error-strip";

/**
 * The error strip above the composer: Retry for a failure the daemon might
 * re-drive; New chat — and NO Retry — once the daemon typed it permanent.
 */
describe("TurnErrorStrip", () => {
  it("offers Retry for an ordinary failure", () => {
    const onRetry = vi.fn();
    const onNewChat = vi.fn();
    render(
      <TurnErrorStrip
        error="upstream 503"
        onRetry={onRetry}
        onNewChat={onNewChat}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("upstream 503");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "New chat" }),
    ).not.toBeInTheDocument();
  });

  it("withholds Retry for a permanent failure and offers New chat instead", () => {
    const onRetry = vi.fn();
    const onNewChat = vi.fn();
    render(
      <TurnErrorStrip
        error="context window exceeded"
        permanent
        onRetry={onRetry}
        onNewChat={onNewChat}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("renders no action when the caller wires none", () => {
    render(<TurnErrorStrip error="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
