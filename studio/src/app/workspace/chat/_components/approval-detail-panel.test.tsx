import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "@/features/agent";
import { memoryStorage } from "@/test/memory-storage";
import { ApprovalDetailPanel } from "./approval-detail-panel";

const shellAsk: ApprovalRequest = {
  approvalId: "s1:1:c1:r1",
  sessionId: "s1",
  toolName: "Shell",
  description: "Shell needs your approval.",
  reason: "runs a command",
  args: JSON.stringify({ command: "go test ./...", timeout_ms: 5000 }),
  details: "runs a command\n\ncommand: go test ./... · timeout_ms: 5000",
};

function renderPanel(
  approval: ApprovalRequest = shellAsk,
  handlers: Partial<{
    onRespond: (choice: string) => void;
    onClose: () => void;
  }> = {},
) {
  const onRespond = vi.fn(handlers.onRespond);
  const onClose = vi.fn(handlers.onClose);
  render(
    <ApprovalDetailPanel
      approval={approval}
      onRespond={onRespond}
      onClose={onClose}
      maximized={false}
      onToggleMaximize={() => {}}
    />,
  );
  return { onRespond, onClose };
}

// The panel frame (SidePanel) persists its width in localStorage; this vitest
// environment's storage shim is method-less, so a real in-memory Storage is
// stubbed per test (the global afterEach unstubs it).
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("ApprovalDetailPanel", () => {
  it("titles the panel by tool, shows the reason and the decoded command with a raw toggle", () => {
    renderPanel();
    expect(screen.getByText("Shell — permission ask")).toBeInTheDocument();
    expect(screen.getByText("Shell needs your approval.")).toBeInTheDocument();
    expect(screen.getByText("runs a command")).toBeInTheDocument();
    expect(screen.getByText("go test ./...")).toBeInTheDocument();
    expect(screen.getByText("timeout 5s")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText(shellAsk.args as string)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close permission details" }),
    ).toBeInTheDocument();
  });

  it("answers the ask from the pinned bar and closes the panel", () => {
    const { onRespond, onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
    expect(onRespond).toHaveBeenCalledWith("always");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("withholds Always allow for a child ask and names the subagent", () => {
    const { onRespond } = renderPanel({
      ...shellAsk,
      approvalId: "subagent-x:1:c1:r1",
      child: true,
    });
    expect(
      screen.getByText("A subagent's Shell needs your approval."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Always allow" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onRespond).toHaveBeenCalledWith("deny");
  });

  it("closes without a verdict from the header close control", () => {
    const { onRespond, onClose } = renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Close permission details" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRespond).not.toHaveBeenCalled();
  });
});
