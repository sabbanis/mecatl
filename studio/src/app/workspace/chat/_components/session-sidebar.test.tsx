import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSession } from "@/features/agent";
import { COPY_SESSION_ID_LABEL } from "./session-copy-menu-items";
import {
  FORK_CHAT_LABEL,
  VIEW_TRANSCRIPT_LABEL,
} from "./session-row-action-items";
import { type SessionActions, SessionList } from "./session-sidebar";

/**
 * The sidebar row's context menu (the TUI's per-row `y` / `v` / `f` / `r` /
 * `d`): opening a row's "…" menu lists Copy session ID, View transcript, Fork
 * chat, Rename and Delete; each is gated on the daemon row's capabilities
 * with the daemon's reason inline; the row actions receive the row's id.
 */

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyToClipboard: clipboard.copy }));

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: "session-abc",
    title: "Fix the flaky test",
    projectId: null,
    model: "m",
    createdAt: 1,
    updatedAt: 2,
    pinned: false,
    archived: false,
    messageCount: 0,
    isStreaming: false,
    inputTokens: 0,
    outputTokens: 0,
    unread: false,
    estimatedCost: null,
    contextLength: null,
    lastPromptTokens: null,
    thresholdTokens: null,
    canRename: true,
    canDelete: true,
    canCopyId: true,
    canViewTranscript: true,
    canFork: true,
    ...overrides,
  };
}

function actions(overrides: Partial<SessionActions> = {}): SessionActions {
  return {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onViewTranscript: vi.fn(),
    onFork: vi.fn(),
    ...overrides,
  };
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", {
      name: "Options for chat: Fix the flaky test",
    }),
  );
  return screen.getByRole("menu");
}

beforeEach(() => {
  clipboard.copy.mockReset();
  clipboard.copy.mockResolvedValue(true);
});

describe("SessionList row menu", () => {
  it("lists copy ID, view transcript, fork, rename and delete for an eligible row", async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={[session()]}
        selectedId=""
        onSelect={() => {}}
        actions={actions()}
      />,
    );
    const menu = await openRowMenu(user);
    const labels = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(labels).toEqual([
      COPY_SESSION_ID_LABEL,
      VIEW_TRANSCRIPT_LABEL,
      FORK_CHAT_LABEL,
      "Rename",
      "Delete",
    ]);
    for (const item of within(menu).getAllByRole("menuitem")) {
      expect(item).not.toHaveAttribute("aria-disabled", "true");
    }
  });

  it("copies the row's exact id from the menu", async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={[session()]}
        selectedId=""
        onSelect={() => {}}
        actions={actions()}
      />,
    );
    const menu = await openRowMenu(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: COPY_SESSION_ID_LABEL }),
    );
    expect(clipboard.copy).toHaveBeenCalledWith("session-abc", "Session ID");
  });

  it("hands the row's id to View transcript and Fork without selecting the row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const rowActions = actions();
    render(
      <SessionList
        sessions={[session()]}
        selectedId=""
        onSelect={onSelect}
        actions={rowActions}
      />,
    );
    let menu = await openRowMenu(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: VIEW_TRANSCRIPT_LABEL }),
    );
    expect(rowActions.onViewTranscript).toHaveBeenCalledWith("session-abc");
    menu = await openRowMenu(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: FORK_CHAT_LABEL }),
    );
    expect(rowActions.onFork).toHaveBeenCalledWith("session-abc");
    // Neither action opened the chat: the row stays a read-only target.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disables Fork and View transcript with the daemon's reasons when the row denies them", async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={[
          session({
            canFork: false,
            forkReason: "active_elsewhere",
            canViewTranscript: false,
            viewTranscriptReason: "transcript_unavailable",
          }),
        ]}
        selectedId=""
        onSelect={() => {}}
        actions={actions()}
      />,
    );
    const menu = await openRowMenu(user);
    const fork = within(menu).getByRole("menuitem", { name: /Fork chat/ });
    expect(fork).toHaveAttribute("aria-disabled", "true");
    expect(fork).toHaveTextContent("Running in another client");
    const view = within(menu).getByRole("menuitem", {
      name: /View transcript/,
    });
    expect(view).toHaveAttribute("aria-disabled", "true");
    expect(view).toHaveTextContent("Transcript unavailable");
  });

  it("omits View transcript and Fork when the workspace offers no handler", async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={[session()]}
        selectedId=""
        onSelect={() => {}}
        actions={actions({ onViewTranscript: undefined, onFork: undefined })}
      />,
    );
    const menu = await openRowMenu(user);
    expect(
      within(menu).queryByRole("menuitem", { name: /View transcript/ }),
    ).toBeNull();
    expect(
      within(menu).queryByRole("menuitem", { name: /Fork chat/ }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Rename" }),
    ).toBeVisible();
  });

  it("never offers Fork on an AI-debug row", async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={[session({ debugTargetSessionId: "session-target" })]}
        selectedId=""
        onSelect={() => {}}
        actions={actions()}
      />,
    );
    const menu = await openRowMenu(user);
    expect(
      within(menu).queryByRole("menuitem", { name: /Fork chat/ }),
    ).toBeNull();
    // Its transcript is still viewable, and the target id copyable.
    expect(
      within(menu).getByRole("menuitem", { name: VIEW_TRANSCRIPT_LABEL }),
    ).toBeVisible();
    expect(
      within(menu).getByRole("menuitem", { name: "Copy debug target ID" }),
    ).toBeVisible();
  });
});
