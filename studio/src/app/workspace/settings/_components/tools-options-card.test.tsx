import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_DAEMON_OPTIONS,
  type HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import { ToolsOptionsCard } from "./tools-options-card";

/**
 * Settings → Tools: the Skill tool + skills directory and slash commands +
 * commands directory as controller-owned flags, with the DAEMON's own
 * `bash` / `skills` / `slash_commands` capability rows as the status. Pins
 * that (1) the status rows read the capability document and point the
 * Shell switch at Permissions (one writer); (2) the controls show the saved
 * document and the placeholders are the controller's defaults; (3) turning
 * the Skill tool off disables its directory field and the confirmed save
 * sends the merged whole document; (4) external mode renders the managed
 * note and the status rows, no switch.
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
  hook.busy = false;
  hook.error = null;
  hook.notice = null;
  hook.save.mockClear();
  runtime.mode = "managed";
  runtime.serverCapabilities = {
    bash: true,
    skills: true,
    slash_commands: false,
  };
});

describe("ToolsOptionsCard", () => {
  it("reports the daemon's tool catalog and sends the Shell switch to Permissions", () => {
    render(<ToolsOptionsCard />);
    expect(screen.getByTestId("tools-status-shell")).toHaveTextContent(
      "registered",
    );
    expect(screen.getByTestId("tools-status-skills")).toHaveTextContent(
      "registered",
    );
    expect(screen.getByTestId("tools-status-commands")).toHaveTextContent(
      "not expanded",
    );
    expect(
      screen.getByRole("link", { name: "change it there" }),
    ).toHaveAttribute("href", "/workspace/settings/permissions");
    // No Shell switch here: --no-shell has exactly one writer.
    expect(
      screen.queryByRole("switch", { name: /shell/i }),
    ).not.toBeInTheDocument();
  });

  it("says 'not reported' for a capability the daemon did not advertise", () => {
    runtime.serverCapabilities = {};
    render(<ToolsOptionsCard />);
    expect(screen.getByTestId("tools-status-shell")).toHaveTextContent(
      "not reported",
    );
  });

  it("shows the saved document with the controller's defaults as placeholders", () => {
    hook.doc = doc({
      ...EMPTY_DAEMON_OPTIONS,
      skills: { enabled: true, dir: "/repo/skills" },
      commands: { enabled: true, dir: "" },
    });
    render(<ToolsOptionsCard />);
    expect(screen.getByRole("switch", { name: "Skill tool" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Skills directory")).toHaveValue(
      "/repo/skills",
    );
    expect(screen.getByLabelText("Skills directory")).toHaveAttribute(
      "placeholder",
      "/repo/.mecatl/skills",
    );
    expect(
      screen.getByRole("switch", { name: "Slash commands" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Commands directory")).toHaveAttribute(
      "placeholder",
      ".mecatl/commands, .claude/commands",
    );
    expect(screen.getByLabelText("Commands directory")).toBeEnabled();
  });

  it("disables the commands directory while commands are off", () => {
    render(<ToolsOptionsCard />);
    expect(screen.getByLabelText("Commands directory")).toBeDisabled();
  });

  it("turning the Skill tool off disables its directory and saves the merged document after the confirm", async () => {
    const user = userEvent.setup();
    render(<ToolsOptionsCard />);
    await user.click(screen.getByRole("switch", { name: "Skill tool" }));
    expect(screen.getByLabelText("Skills directory")).toBeDisabled();
    expect(screen.getByTestId("tools-options-pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Change the tool catalog and restart the daemon?",
    );
    await user.click(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
        dialog,
    );
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      skills: { enabled: false, dir: "" },
    });
  });

  it("carries a typed commands directory with the switch", async () => {
    const user = userEvent.setup();
    render(<ToolsOptionsCard />);
    await user.click(screen.getByRole("switch", { name: "Slash commands" }));
    await user.type(screen.getByLabelText("Commands directory"), "prompts");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await screen.findByRole("alertdialog");
    await user.click(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
        document.body,
    );
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      commands: { enabled: true, dir: "prompts" },
    });
  });

  it("renders the managed note and the status rows in external mode, with no controls", () => {
    hook.manageable = false;
    runtime.mode = "external";
    render(<ToolsOptionsCard />);
    expect(
      screen.getByText("Managed by the external mecated deployment", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/--skills-dir/)).toBeInTheDocument();
    expect(screen.getByTestId("tools-status-skills")).toHaveTextContent(
      "registered",
    );
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Skills directory")).not.toBeInTheDocument();
  });
});
