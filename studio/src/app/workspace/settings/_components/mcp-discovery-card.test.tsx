import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_DAEMON_OPTIONS,
  type HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import { McpDiscoveryCard } from "./mcp-discovery-card";

/**
 * Settings → MCP tools → MCP discovery: the four discovery flags as
 * switches/field over the saved document. Pins that (1) the controls show
 * the saved document (all on by default, group empty with the "default"
 * placeholder); (2) turning ToolHive discovery off disables the group
 * field; (3) a typed group and a flipped switch reach `save` as the merged
 * whole document after the confirm; (4) external mode renders the managed
 * note and no switch.
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

vi.mock(
  "@/features/agent/hooks/use-daemon-options",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/agent/hooks/use-daemon-options")
    >()),
    useDaemonOptions: () => hook,
  }),
);

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
  allowedRoots: ["/repo"],
});

const confirmSave = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Save and restart" }));
  await screen.findByRole("alertdialog");
  await user.click(
    screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
      document.body,
  );
};

beforeEach(() => {
  hook.live = true;
  hook.manageable = true;
  hook.doc = doc();
  hook.busy = false;
  hook.error = null;
  hook.notice = null;
  hook.save.mockClear();
});

describe("McpDiscoveryCard", () => {
  it("shows mecated's defaults: everything on, the default group", () => {
    render(<McpDiscoveryCard />);
    for (const name of [
      "ToolHive discovery",
      "Resource meta-tools",
      "Prompt expansion",
    ]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    }
    const group = screen.getByLabelText("ToolHive group");
    expect(group).toHaveValue("");
    expect(group).toHaveAttribute("placeholder", "default");
    expect(group).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Save and restart" }),
    ).toBeDisabled();
  });

  it("disables the group field while discovery is off and saves the merged document", async () => {
    const user = userEvent.setup();
    render(<McpDiscoveryCard />);
    await user.click(
      screen.getByRole("switch", { name: "ToolHive discovery" }),
    );
    expect(screen.getByLabelText("ToolHive group")).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: "Prompt expansion" }));
    await confirmSave(user);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      mcp: { ...EMPTY_DAEMON_OPTIONS.mcp, toolhive: false, prompts: false },
    });
  });

  it("carries a typed group name", async () => {
    const user = userEvent.setup();
    render(<McpDiscoveryCard />);
    await user.type(screen.getByLabelText("ToolHive group"), "team-a");
    await confirmSave(user);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      mcp: { ...EMPTY_DAEMON_OPTIONS.mcp, toolhiveGroup: "team-a" },
    });
  });

  it("renders the managed note and the remote flags in external mode, with no controls", () => {
    hook.manageable = false;
    render(<McpDiscoveryCard />);
    expect(
      screen.getByText("Managed by the external mecated deployment", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/--toolhive-group/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
