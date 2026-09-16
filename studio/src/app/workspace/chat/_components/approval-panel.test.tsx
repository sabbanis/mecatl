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

  it("renders a legacy ask (no raw tier) as its joined details, verbatim", () => {
    render(<ApprovalPanel approval={mainAsk} onRespond={() => {}} />);
    expect(screen.getByText("ls -la")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raw" })).toBeNull();
  });

  it("shows a Shell ask as the bare command with its timeout, not the flattened line", () => {
    const shellAsk: ApprovalRequest = {
      ...mainAsk,
      toolName: "Shell",
      description: "Shell needs your approval.",
      reason: "runs a command",
      args: JSON.stringify({ command: "go test ./...", timeout_ms: 120000 }),
      details: "runs a command\n\ncommand: go test ./... · timeout_ms: 120000",
    };
    render(<ApprovalPanel approval={shellAsk} onRespond={() => {}} />);
    expect(screen.getByText("runs a command")).toBeInTheDocument();
    expect(screen.getByText("go test ./...")).toBeInTheDocument();
    expect(screen.getByText("timeout 120s")).toBeInTheDocument();
    expect(screen.queryByText(/command: go test/)).toBeNull();
  });

  it("renders an Edit ask as a diff with + and - rows", () => {
    const editAsk: ApprovalRequest = {
      ...mainAsk,
      toolName: "Edit",
      description: "Edit needs your approval.",
      reason: "",
      args: JSON.stringify({
        path: "main.go",
        old_string: "a\nold line\nc",
        new_string: "a\nnew line\nc",
      }),
      details: "",
    };
    const { container } = render(
      <ApprovalPanel approval={editAsk} onRespond={() => {}} />,
    );
    expect(screen.getByText("main.go")).toBeInTheDocument();
    const dels = container.querySelectorAll('[data-diff="del"]');
    const adds = container.querySelectorAll('[data-diff="add"]');
    expect(dels).toHaveLength(1);
    expect(adds).toHaveLength(1);
    expect(dels[0]).toHaveTextContent("old line");
    expect(adds[0]).toHaveTextContent("new line");
  });

  it("toggles to the verbatim args string with Raw and back with Pretty", () => {
    const args = JSON.stringify({ command: "ls -la" });
    const shellAsk: ApprovalRequest = {
      ...mainAsk,
      toolName: "Shell",
      reason: "runs a command",
      args,
      details: "runs a command\n\ncommand: ls -la",
    };
    render(<ApprovalPanel approval={shellAsk} onRespond={() => {}} />);
    const toggle = screen.getByRole("button", { name: "Raw" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(screen.getByText(args)).toBeInTheDocument();
    expect(screen.getByText("Raw arguments")).toBeInTheDocument();
    const back = screen.getByRole("button", { name: "Pretty" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(back);
    expect(screen.queryByText(args)).toBeNull();
    expect(screen.getByText("ls -la")).toBeInTheDocument();
  });

  it("offers Expand only when a handler is wired, and passes the ask", () => {
    const { rerender } = render(
      <ApprovalPanel approval={mainAsk} onRespond={() => {}} />,
    );
    expect(
      screen.queryByRole("button", { name: "Expand permission details" }),
    ).toBeNull();
    const onExpand = vi.fn();
    rerender(
      <ApprovalPanel
        approval={mainAsk}
        onRespond={() => {}}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand permission details" }),
    );
    expect(onExpand).toHaveBeenCalledWith(mainAsk);
  });
});
