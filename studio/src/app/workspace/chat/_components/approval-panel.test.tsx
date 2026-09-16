import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "@/features/agent";
import { ApprovalPanel } from "./approval-panel";

const mainAsk: ApprovalRequest = {
  approvalId: "s1:1:c1:r1",
  sessionId: "s1",
  toolName: "Bash",
  description: "Bash needs your approval.",
  details: "ls -la",
};

const childAsk: ApprovalRequest = {
  ...mainAsk,
  approvalId: "subagent-x:1:c1:r1",
  child: true,
};

describe("ApprovalPanel", () => {
  it("shows the head's place in the queue when more than one ask is waiting", () => {
    render(
      <ApprovalPanel
        approval={mainAsk}
        onRespond={() => {}}
        queuePosition={{ index: 1, total: 2 }}
      />,
    );
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Request 1 of 2")).toBeInTheDocument();
  });

  it("shows no queue badge for a lone ask", () => {
    render(
      <ApprovalPanel
        approval={mainAsk}
        onRespond={() => {}}
        queuePosition={{ index: 1, total: 1 }}
      />,
    );
    expect(screen.queryByText(/\bof 1\b/)).toBeNull();
    expect(screen.queryByText("Subagent")).toBeNull();
  });

  it("offers all three verdicts for a main-agent ask and routes each to its choice", () => {
    const onRespond = vi.fn();
    render(<ApprovalPanel approval={mainAsk} onRespond={onRespond} />);
    expect(screen.getByText("Bash needs your approval.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onRespond.mock.calls.map(([choice]) => choice)).toEqual([
      "once",
      "always",
      "deny",
    ]);
  });

  it("withholds Always allow for a child ask and names the subagent", () => {
    const onRespond = vi.fn();
    render(<ApprovalPanel approval={childAsk} onRespond={onRespond} />);
    expect(
      screen.getByText("A subagent's Bash needs your approval."),
    ).toBeInTheDocument();
    expect(screen.getByText("Subagent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Always allow" })).toBeNull();
    expect(screen.getByRole("button", { name: "Allow once" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deny" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onRespond).toHaveBeenCalledWith("deny");
  });
});
