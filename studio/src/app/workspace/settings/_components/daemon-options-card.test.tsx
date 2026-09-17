import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Switch } from "@/components/ui/switch";
import {
  EMPTY_DAEMON_OPTIONS,
  type HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import {
  capabilityWord,
  DaemonOptionsCard,
  StatusRow,
} from "./daemon-options-card";

/**
 * The one editing scaffold under the three daemon-options cards. Pins that
 * (1) offline renders the offline note and external the managed note plus
 * the card's remote wording — no controls, but the daemon-reported status
 * rows still render in external mode; (2) a change shows the "Restart
 * required" line and enables Save, which sends nothing until the confirm
 * — the confirm calls `save` with the WHOLE merged document; Cancel and
 * Discard send nothing and Discard returns to the saved values; (3) busy
 * disables Save; error and notice render.
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

const testDoc = (options = EMPTY_DAEMON_OPTIONS): HarnessDaemonOptionsDoc => ({
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

function Probe() {
  return (
    <DaemonOptionsCard
      title="Probe"
      description="probe"
      testId="probe"
      confirmTitle="Change the probe and restart the daemon?"
      externalNote="Pass --probe to the server host's mecated."
      status={
        <StatusRow label="Probe status" testId="probe-status" value="on" />
      }
    >
      {({ options, busy, update }) => (
        <Switch
          aria-label="Probe switch"
          checked={options.skills.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => update({ skills: { enabled } })}
        />
      )}
    </DaemonOptionsCard>
  );
}

const saveButton = () =>
  screen.getByRole("button", { name: "Save and restart" });

beforeEach(() => {
  hook.live = true;
  hook.manageable = true;
  hook.doc = testDoc();
  hook.isLoading = false;
  hook.busy = false;
  hook.error = null;
  hook.notice = null;
  hook.save.mockClear();
});

describe("DaemonOptionsCard", () => {
  it("renders the offline note with no controls when the runtime is down", () => {
    hook.live = false;
    render(<Probe />);
    expect(screen.getByText(/runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("probe-status")).not.toBeInTheDocument();
  });

  it("renders the managed note, the remote wording AND the status rows in external mode", () => {
    hook.manageable = false;
    render(<Probe />);
    expect(
      screen.getByText("Managed by the external mecated deployment", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pass --probe to the server host's mecated."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("probe-status")).toHaveTextContent("on");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("reports the loading and read-error states", () => {
    hook.doc = null;
    hook.isLoading = true;
    const { rerender } = render(<Probe />);
    expect(
      screen.getByText(/Reading the daemon's options/),
    ).toBeInTheDocument();
    hook.isLoading = false;
    hook.error = "controller unreachable";
    rerender(<Probe />);
    expect(screen.getByText("controller unreachable")).toBeInTheDocument();
  });

  it("saves the WHOLE merged document only after the confirm", async () => {
    const user = userEvent.setup();
    render(<Probe />);
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("probe-pending")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Probe switch" }));
    expect(screen.getByTestId("probe-pending")).toHaveTextContent(
      /Restart required/,
    );
    expect(saveButton()).toBeEnabled();
    expect(hook.save).not.toHaveBeenCalled();

    await user.click(saveButton());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Change the probe and restart the daemon?",
    );
    expect(dialog).toHaveTextContent(/trusted like AGENTS\.md/);
    expect(hook.save).not.toHaveBeenCalled();

    await user.click(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
        dialog,
    );
    expect(hook.save).toHaveBeenCalledTimes(1);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      skills: { enabled: false, dir: "" },
    });
  });

  it("sends nothing on Cancel, and Discard returns to the saved values", async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByRole("switch", { name: "Probe switch" }));
    await user.click(saveButton());
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(hook.save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("switch", { name: "Probe switch" }),
    ).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      screen.getByRole("switch", { name: "Probe switch" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeDisabled();
    expect(hook.save).not.toHaveBeenCalled();
  });

  it("disables Save while busy and renders error and notice", async () => {
    const user = userEvent.setup();
    hook.error = "skills.dir must be inside the workspace /repo";
    hook.notice = "Saved. The daemon restarted with the new options.";
    render(<Probe />);
    expect(screen.getByRole("alert")).toHaveTextContent(/skills\.dir/);
    expect(screen.getByRole("status")).toHaveTextContent(/daemon restarted/);
    await user.click(screen.getByRole("switch", { name: "Probe switch" }));
    expect(saveButton()).toBeEnabled();
    hook.busy = true;
    render(<Probe />);
    expect(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1),
    ).toBeDisabled();
  });
});

describe("capabilityWord", () => {
  it("maps the daemon's boolean to the card's words and absence to 'not reported'", () => {
    const words = { on: "registered", off: "not registered" };
    expect(capabilityWord(true, words)).toBe("registered");
    expect(capabilityWord(false, words)).toBe("not registered");
    expect(capabilityWord(undefined, words)).toBe("not reported");
    expect(capabilityWord("yes", words)).toBe("not reported");
  });
});
