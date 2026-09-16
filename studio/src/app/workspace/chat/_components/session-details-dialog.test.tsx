import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDetailsDialog } from "./session-details-dialog";

/**
 * Pins the `/session` dialog: it reads the snapshot's identity on open and
 * renders id, title, state, mode, model, placement label + branch and the
 * creation time; the Copy button writes the exact id to the clipboard and
 * says so; a daemon refusal renders as an alert, never as blank rows.
 */

const identity = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("@/lib/harness/sessions", () => ({
  fetchHarnessSessionIdentity: identity.fetch,
}));

const FULL = {
  id: "session-abc-123",
  title: "Fix the flaky test",
  state: "idle",
  mode: "acceptEdits" as const,
  resolvedModel: {
    providerId: "openrouter",
    modelId: "openai/gpt-5",
    contextWindow: 400000,
    reasoningEffort: "",
  },
  placement: { kind: "worktree", label: "feature-x", branch: "feature/x" },
  createdAtUnix: 1755000000,
};

beforeEach(() => {
  identity.fetch.mockReset();
  identity.fetch.mockResolvedValue(FULL);
});

describe("SessionDetailsDialog", () => {
  it("renders the identity rows read from the snapshot", async () => {
    render(
      <SessionDetailsDialog
        sessionId="session-abc-123"
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Fix the flaky test")).toBeInTheDocument();
    expect(identity.fetch).toHaveBeenCalledWith(
      "session-abc-123",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("session-abc-123")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText("Accept edits")).toBeInTheDocument();
    expect(screen.getByText("openrouter")).toBeInTheDocument();
    expect(screen.getByText("openai/gpt-5")).toBeInTheDocument();
    expect(screen.getByText("400,000 tokens")).toBeInTheDocument();
    expect(screen.getByText("feature-x (worktree)")).toBeInTheDocument();
    expect(screen.getByText("feature/x")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("copies the exact session id and confirms it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <SessionDetailsDialog
        sessionId="session-abc-123"
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByText("Fix the flaky test");
    await user.click(screen.getByRole("button", { name: "Copy session ID" }));
    expect(writeText).toHaveBeenCalledWith("session-abc-123");
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Session ID copied"),
    );
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("omits placement rows when the daemon reports none", async () => {
    identity.fetch.mockResolvedValue({
      ...FULL,
      placement: null,
      resolvedModel: null,
    });
    render(
      <SessionDetailsDialog
        sessionId="session-abc-123"
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByText("Fix the flaky test");
    expect(screen.queryByText("Placement")).toBeNull();
    expect(screen.queryByText("Branch")).toBeNull();
    expect(screen.getAllByText("unavailable").length).toBeGreaterThan(0);
  });

  it("shows the daemon's refusal as an alert", async () => {
    identity.fetch.mockRejectedValue(new Error("session not found"));
    render(
      <SessionDetailsDialog
        sessionId="session-abc-123"
        open
        onOpenChange={() => {}}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the session: session not found",
    );
  });

  it("fetches nothing while closed", () => {
    render(
      <SessionDetailsDialog
        sessionId="session-abc-123"
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(identity.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
