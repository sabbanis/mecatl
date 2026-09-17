import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_DAEMON_OPTIONS,
  type HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import { MemoryStoresCard } from "./memory-stores-card";

/**
 * Settings → Memory → Memory: the two stores as two on/off switches over the
 * shared options document. Pins that (1) the switches show the saved
 * document and nothing else is offered — no directory, no interval, no
 * link, no Save button; (2) flipping a switch saves AT ONCE, with no
 * confirm, as the one changed value (the hook merges it over the saved
 * document and sends the whole thing — pinned in the hook's own test);
 * (3) while the save is in flight both switches are disabled behind one
 * "Applying…" line, and a refusal shows inline; (4) when the agent is run
 * elsewhere the card is read-only — a plain note plus On / Off / Not
 * available per store from what the running agent reports; (5) offline and
 * loading render a plain note; (6) nothing on the card names the daemon or
 * a flag.
 */

const hook = vi.hoisted(() => ({
  live: true,
  manageable: true,
  doc: null as HarnessDaemonOptionsDoc | null,
  isLoading: false,
  busy: false,
  error: null as string | null,
  notice: null as string | null,
  save: vi.fn(async () => true),
}));

const runtime = vi.hoisted(() => ({
  connected: true,
  mode: "managed" as "managed" | "external",
  serverCapabilities: {} as Record<string, unknown>,
}));

vi.mock(
  "@/features/agent/hooks/use-daemon-options",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/agent/hooks/use-daemon-options")
    >()),
    useDaemonOptions: () => hook,
  }),
);

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

const doc = (options = EMPTY_DAEMON_OPTIONS): HarnessDaemonOptionsDoc => ({
  options,
  defaults: {
    skillsDir: "/repo/.mecatl/skills",
    memoryDir: "/repo/.scratch/studio-memory",
    userModelDir: "/home/me/.config/mecatl/usermodel",
    commandDirs: [".mecatl/commands", ".claude/commands"],
  },
  effective: {
    skillsDir: "/repo/.mecatl/skills",
    memoryDir: "/repo/.scratch/studio-memory",
    userModelDir: "",
    commandsDir: "",
  },
  allowedRoots: ["/repo", "/home/me/.config/mecatl"],
});

beforeEach(() => {
  hook.live = true;
  hook.manageable = true;
  hook.doc = doc();
  hook.isLoading = false;
  hook.busy = false;
  hook.error = null;
  hook.notice = null;
  hook.save.mockClear();
  runtime.connected = true;
  runtime.mode = "managed";
  runtime.serverCapabilities = { memory: true, user_model: false };
});

describe("MemoryStoresCard", () => {
  it("shows the two switches from the saved document and no other controls", () => {
    hook.doc = doc({
      ...EMPTY_DAEMON_OPTIONS,
      userModel: { enabled: false, dir: "/somewhere", reviewInterval: 3 },
    });
    render(<MemoryStoresCard />);
    expect(
      screen.getByRole("switch", { name: "Project memory" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Facts about you" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("/somewhere")).not.toBeInTheDocument();
    // A flip applies on its own: no Save, Discard or confirm anywhere.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("turning project memory off saves at once, with no confirm", async () => {
    const user = userEvent.setup();
    render(<MemoryStoresCard />);
    await user.click(screen.getByRole("switch", { name: "Project memory" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(hook.save).toHaveBeenCalledTimes(1);
    expect(hook.save).toHaveBeenCalledWith({
      projectMemory: { enabled: false },
    });
  });

  it("turning facts about you off sends only that value, leaving the rest to the saved document", async () => {
    const user = userEvent.setup();
    hook.doc = doc({
      ...EMPTY_DAEMON_OPTIONS,
      userModel: { enabled: true, dir: "/kept", reviewInterval: 7 },
    });
    render(<MemoryStoresCard />);
    await user.click(screen.getByRole("switch", { name: "Facts about you" }));
    expect(hook.save).toHaveBeenCalledTimes(1);
    expect(hook.save).toHaveBeenCalledWith({ userModel: { enabled: false } });
  });

  it("disables both switches behind one Applying line while the save is in flight", () => {
    hook.busy = true;
    render(<MemoryStoresCard />);
    expect(
      screen.getByRole("switch", { name: "Project memory" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: "Facts about you" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Applying…");
  });

  it("shows a refused save inline and leaves the switches usable", () => {
    hook.error = "The agent refused that setting.";
    render(<MemoryStoresCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The agent refused that setting.",
    );
    expect(
      screen.getByRole("switch", { name: "Project memory" }),
    ).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is read-only with On / Off per store when the agent is run elsewhere", () => {
    hook.manageable = false;
    runtime.mode = "external";
    render(<MemoryStoresCard />);
    expect(
      screen.getByText(
        "Memory is set where the agent runs and can't be changed here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("memory-status-project")).toHaveTextContent("On");
    expect(screen.getByTestId("memory-status-user-model")).toHaveTextContent(
      "Off",
    );
    expect(screen.getByText("Project memory")).toBeInTheDocument();
    expect(screen.getByText("Facts about you")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says Not available when the running agent reported neither store", () => {
    hook.manageable = false;
    runtime.mode = "external";
    runtime.serverCapabilities = {};
    render(<MemoryStoresCard />);
    expect(screen.getByTestId("memory-status-project")).toHaveTextContent(
      "Not available",
    );
    expect(screen.getByTestId("memory-status-user-model")).toHaveTextContent(
      "Not available",
    );
  });

  it("renders a plain note when offline", () => {
    hook.live = false;
    render(<MemoryStoresCard />);
    expect(
      screen.getByText("The agent is offline, so memory can't be changed."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders a plain note while the settings load", () => {
    hook.doc = null;
    hook.isLoading = true;
    render(<MemoryStoresCard />);
    expect(screen.getByText("Loading memory settings…")).toBeInTheDocument();
  });

  it("never names the daemon or a flag", () => {
    const { unmount } = render(<MemoryStoresCard />);
    expect(document.body.textContent).not.toMatch(/daemon|mecated|--/i);
    unmount();
    hook.manageable = false;
    runtime.mode = "external";
    render(<MemoryStoresCard />);
    expect(document.body.textContent).not.toMatch(/daemon|mecated|--/i);
  });
});
