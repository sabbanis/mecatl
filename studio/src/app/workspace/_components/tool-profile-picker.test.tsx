import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHELL_DISABLED_NOTE } from "@/lib/tool-profile";
import { ModeSelector } from "./chat-input";
import {
  ToolProfileSheetRows,
  toolProfileReadOnlyLine,
} from "./tool-profile-picker";

/**
 * The composer's TOOLS choice (the daemon's per-session `profile`, ADR
 * 0291) inside the Mode menu:
 *
 * - a DRAFT (`onProfileChange` wired) gets the two rows — All tools / No
 *   filesystem — and the pill reads "· No FS" once picked;
 * - a LIVE chat gets no rows: a KNOWN profile renders one read-only line,
 *   an unknown one (a chat Studio did not mint) renders no Tools section;
 * - a daemon whose Shell tool is off (`capabilities.bash === false`) gets
 *   the muted note; an older daemon that does not report it gets none.
 */

const runtime = vi.hoisted(() => ({
  value: null as null | { serverCapabilities: Record<string, unknown> },
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useOptionalRuntimeStatus: () => runtime.value,
}));

const pill = () => screen.getByTitle(/^Permission mode:/) as HTMLButtonElement;

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(pill());
  // The mode rows always render; waiting on one proves the menu is open.
  await screen.findByRole("menuitem", { name: /^Manual/ });
}

beforeEach(() => {
  runtime.value = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ModeSelector Tools section (draft)", () => {
  it("lists All tools and No filesystem, checks the current pick, and reports a change", async () => {
    const user = userEvent.setup();
    const onProfileChange = vi.fn();
    render(
      <ModeSelector
        mode="default"
        onModeChange={vi.fn()}
        profile=""
        onProfileChange={onProfileChange}
      />,
    );
    await openMenu(user);
    expect(screen.getByText("Tools")).toBeInTheDocument();
    const noFs = screen.getByRole("menuitem", { name: /^No filesystem/ });
    expect(noFs).toHaveTextContent(/Shell, Read, Edit, Write/);
    expect(screen.getByRole("menuitem", { name: /^All tools/ })).toBeTruthy();

    fireEvent.click(noFs);
    expect(onProfileChange).toHaveBeenCalledWith("no-fs");
  });

  it('suffixes the pill "· No FS" and its title once the attenuated profile is picked', () => {
    render(
      <ModeSelector
        mode="default"
        onModeChange={vi.fn()}
        profile="no-fs"
        onProfileChange={vi.fn()}
      />,
    );
    expect(pill()).toHaveTextContent("Manual · No FS");
    expect(pill().title).toBe(
      "Permission mode: Manual — ⇧Tab cycles · Tools: No filesystem",
    );
  });

  it("leaves the pill and its title untouched on the default profile", () => {
    render(
      <ModeSelector
        mode="plan"
        onModeChange={vi.fn()}
        pending
        profile=""
        onProfileChange={vi.fn()}
      />,
    );
    expect(pill()).toHaveTextContent("Plan · pending");
    expect(pill().title).toBe(
      "Permission mode: Plan (pending — applies when the run ends) — ⇧Tab cycles",
    );
  });

  it("says when the daemon's Shell tool is off, and stays quiet when it is not reported", async () => {
    const user = userEvent.setup();
    runtime.value = { serverCapabilities: { bash: false } };
    const first = render(
      <ModeSelector
        mode="default"
        onModeChange={vi.fn()}
        profile=""
        onProfileChange={vi.fn()}
      />,
    );
    await openMenu(user);
    expect(screen.getByText(SHELL_DISABLED_NOTE)).toBeInTheDocument();
    first.unmount();

    runtime.value = { serverCapabilities: {} };
    render(
      <ModeSelector
        mode="default"
        onModeChange={vi.fn()}
        profile=""
        onProfileChange={vi.fn()}
      />,
    );
    await openMenu(user);
    expect(screen.queryByText(SHELL_DISABLED_NOTE)).toBeNull();
  });
});

describe("ModeSelector Tools section (live chat)", () => {
  it("renders a known profile as one read-only line and no rows", async () => {
    const user = userEvent.setup();
    render(
      <ModeSelector mode="default" onModeChange={vi.fn()} profile="no-fs" />,
    );
    await openMenu(user);
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(
      screen.getByText(toolProfileReadOnlyLine("no-fs")),
    ).toBeInTheDocument();
    expect(toolProfileReadOnlyLine("no-fs")).toBe(
      "Tools: No filesystem — set when this chat was created",
    );
    expect(
      screen.queryByRole("menuitem", { name: /^No filesystem/ }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^All tools/ })).toBeNull();
  });

  it("renders no Tools section at all for a chat whose profile is unknown", async () => {
    const user = userEvent.setup();
    render(<ModeSelector mode="default" onModeChange={vi.fn()} />);
    await openMenu(user);
    expect(screen.queryByText("Tools")).toBeNull();
    expect(screen.queryByText(/^Tools:/)).toBeNull();
    // The wide label is bare "Manual"; the narrow-collapse span reads "Mode".
    expect(pill()).toHaveTextContent(/^Manual/);
    expect(pill()).not.toHaveTextContent("No FS");
  });
});

describe("ToolProfileSheetRows (mobile)", () => {
  it("offers the two rows on a draft and reports the pick", async () => {
    const user = userEvent.setup();
    const onProfileChange = vi.fn();
    render(
      <ToolProfileSheetRows profile="" onProfileChange={onProfileChange} />,
    );
    expect(screen.getByText("Tools")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^No filesystem/ }));
    expect(onProfileChange).toHaveBeenCalledWith("no-fs");
    await user.click(screen.getByRole("button", { name: /^All tools/ }));
    expect(onProfileChange).toHaveBeenCalledWith("");
  });

  it("is read-only on a live chat with a known profile and absent when unknown", () => {
    const known = render(<ToolProfileSheetRows profile="" />);
    expect(screen.getByText(toolProfileReadOnlyLine(""))).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    known.unmount();

    const { container } = render(<ToolProfileSheetRows />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the shell-off note under the rows", () => {
    runtime.value = { serverCapabilities: { bash: false } };
    render(<ToolProfileSheetRows profile="" onProfileChange={vi.fn()} />);
    expect(screen.getByText(SHELL_DISABLED_NOTE)).toBeInTheDocument();
  });
});
