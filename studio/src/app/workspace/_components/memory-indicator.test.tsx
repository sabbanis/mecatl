import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEMORY_SETTINGS_HREF,
  MemoryIndicator,
  MemorySheetSection,
  MemoryStateLabel,
  memorySettingsCopy,
  memoryState,
  readMemoryStores,
} from "./memory-indicator";

/**
 * The composer's memory indicator is READ-ONLY and daemon-derived: it reports
 * `serverCapabilities.memory` (Remember/Recall registered — the TUI's "memory
 * is on" note) and `serverCapabilities.user_model`, and points at Settings →
 * Memory. It replaced a local On/Off toggle that never reached the daemon,
 * so the tests also pin that there is NO clickable On/Off choice left.
 */

type Runtime = {
  connected: boolean;
  mode: "managed" | "external";
  serverCapabilities: Record<string, unknown>;
};

const runtime = vi.hoisted(() => ({
  status: null as Runtime | null,
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useOptionalRuntimeStatus: () => runtime.status,
}));

function connected(
  capabilities: Record<string, unknown>,
  mode: "managed" | "external" = "managed",
): Runtime {
  return { connected: true, mode, serverCapabilities: capabilities };
}

beforeEach(() => {
  runtime.status = connected({ memory: true, user_model: true });
});

afterEach(() => {
  runtime.status = null;
});

describe("readMemoryStores / memoryState", () => {
  it("reads the two wire-keyed flags and treats a missing one as unreported", () => {
    expect(readMemoryStores({ memory: true, user_model: false })).toEqual({
      project: true,
      userModel: false,
    });
    expect(readMemoryStores({})).toEqual({ project: null, userModel: null });
    // A non-boolean value is not a flag.
    expect(readMemoryStores({ memory: "yes" })).toEqual({
      project: null,
      userModel: null,
    });
  });

  it("is on when EITHER store is on, off only when both are reported off", () => {
    expect(memoryState({ project: true, userModel: true })).toBe("on");
    expect(memoryState({ project: false, userModel: true })).toBe("on");
    expect(memoryState({ project: true, userModel: false })).toBe("on");
    expect(memoryState({ project: false, userModel: false })).toBe("off");
    expect(memoryState({ project: false, userModel: null })).toBe("off");
    expect(memoryState({ project: null, userModel: null })).toBe("unknown");
  });
});

describe("MemoryIndicator", () => {
  const pill = (name: RegExp) => screen.getByRole("button", { name });

  it("reads Memory On and lists both stores in a read-only popover", async () => {
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    const trigger = pill(/^Memory On$/);
    expect(trigger).toHaveAttribute("title", "Memory On");

    await user.click(trigger);
    const popover = await screen.findByRole("dialog");
    const project = within(popover).getByTestId("memory-store-project");
    expect(project).toHaveTextContent("Project memory (Remember/Recall)");
    expect(project.querySelector("dd")).toHaveTextContent("On");
    const userModel = within(popover).getByTestId("memory-store-userModel");
    expect(userModel).toHaveTextContent("User model (facts about you)");
    expect(userModel.querySelector("dd")).toHaveTextContent("On");
  });

  it("reads Off when the daemon reports both stores off", async () => {
    runtime.status = connected({ memory: false, user_model: false });
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory Off$/));
    const popover = await screen.findByRole("dialog");
    expect(
      within(popover).getByTestId("memory-store-project").querySelector("dd"),
    ).toHaveTextContent("Off");
    expect(
      within(popover).getByTestId("memory-store-userModel").querySelector("dd"),
    ).toHaveTextContent("Off");
  });

  it("stays On with only the user model wired, and says which store is off", async () => {
    runtime.status = connected({ memory: false, user_model: true });
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory On$/));
    const popover = await screen.findByRole("dialog");
    expect(
      within(popover).getByTestId("memory-store-project").querySelector("dd"),
    ).toHaveTextContent("Off");
    expect(
      within(popover).getByTestId("memory-store-userModel").querySelector("dd"),
    ).toHaveTextContent("On");
  });

  it("offers no On/Off choice — the old toggle is gone", async () => {
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory On$/));
    const popover = await screen.findByRole("dialog");
    expect(screen.queryAllByRole("menuitem")).toEqual([]);
    expect(screen.queryAllByRole("menuitemradio")).toEqual([]);
    expect(within(popover).queryAllByRole("button")).toEqual([]);
    expect(within(popover).queryAllByRole("switch")).toEqual([]);
    expect(within(popover).queryAllByRole("radio")).toEqual([]);
    // Still "On" after the popover was opened: nothing in it flips state.
    expect(pill(/^Memory On$/)).toBeInTheDocument();
  });

  it("links to Settings → Memory and says memory is a daemon setting", async () => {
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory On$/));
    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveTextContent(
      "Memory is a daemon setting, not a per-chat switch.",
    );
    expect(popover).toHaveTextContent(
      "Studio starts the daemon with project memory on",
    );
    expect(
      within(popover).getByRole("link", { name: "Settings → Memory" }),
    ).toHaveAttribute("href", MEMORY_SETTINGS_HREF);
    expect(MEMORY_SETTINGS_HREF).toBe("/workspace/settings/memory");
  });

  it("in external mode says the operator's daemon flags decide and Settings → Memory cannot change them", async () => {
    runtime.status = connected({ memory: true, user_model: false }, "external");
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory On$/));
    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveTextContent("managed outside Studio");
    expect(popover).toHaveTextContent("--memory-dir");
    expect(popover).toHaveTextContent("cannot change them");
    expect(popover).not.toHaveTextContent(
      "Studio starts the daemon with project memory on",
    );
    expect(
      within(popover).getByRole("link", { name: "Settings → Memory" }),
    ).toHaveAttribute("href", MEMORY_SETTINGS_HREF);
  });

  it("reads Unknown against a daemon that reports no memory capabilities", async () => {
    runtime.status = connected({});
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory Unknown$/));
    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveTextContent(
      "This daemon does not report whether memory is on.",
    );
    expect(
      within(popover).getByTestId("memory-store-project").querySelector("dd"),
    ).toHaveTextContent("Not reported");
  });

  it("reads Unknown while the daemon is unreachable, never a stale On", async () => {
    runtime.status = {
      connected: false,
      mode: "managed",
      serverCapabilities: { memory: true, user_model: true },
    };
    const user = userEvent.setup();
    render(<MemoryIndicator />);
    await user.click(pill(/^Memory Unknown$/));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Mecatl is unreachable",
    );
  });

  it("renders nothing outside the RuntimeStatusProvider instead of throwing", () => {
    runtime.status = null;
    const { container } = render(<MemoryIndicator />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the mobile sheet pieces", () => {
  it("MemoryStateLabel shows the same derived label as the pill", () => {
    runtime.status = connected({ memory: false, user_model: false });
    render(<MemoryStateLabel />);
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("MemorySheetSection lists both stores read-only and links to Settings → Memory, closing the sheet on navigate", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MemorySheetSection onNavigate={onNavigate} />);
    expect(screen.getByTestId("memory-store-project")).toHaveTextContent(
      "Project memory (Remember/Recall)",
    );
    expect(screen.getByTestId("memory-store-userModel")).toHaveTextContent(
      "User model (facts about you)",
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
    const link = screen.getByRole("link", { name: "Settings → Memory" });
    expect(link).toHaveAttribute("href", MEMORY_SETTINGS_HREF);
    // jsdom cannot navigate; the anchor's own default is not under test.
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("MemorySheetSection says so when no runtime status is available", () => {
    runtime.status = null;
    render(<MemorySheetSection />);
    expect(
      screen.getByText("Memory status is not available here."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("memorySettingsCopy", () => {
  const base = (over: Partial<Parameters<typeof memorySettingsCopy>[0]>) =>
    memorySettingsCopy({
      stores: { project: true, userModel: true },
      state: "on",
      mode: "managed",
      connected: true,
      ...over,
    });

  it("always opens with the daemon-setting sentence", () => {
    for (const copy of [
      base({}),
      base({ mode: "external" }),
      base({ connected: false }),
      base({ state: "unknown" }),
    ]) {
      expect(copy.startsWith("Memory is a daemon setting")).toBe(true);
    }
  });

  it("prefers the unreachable explanation over the mode-specific one", () => {
    expect(base({ connected: false, mode: "external" })).toContain(
      "unreachable",
    );
    expect(base({ connected: false, mode: "external" })).not.toContain(
      "managed outside Studio",
    );
  });
});
