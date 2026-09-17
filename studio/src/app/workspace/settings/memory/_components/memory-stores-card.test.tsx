import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_DAEMON_OPTIONS,
  type HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import { MemoryStoresCard } from "./memory-stores-card";

/**
 * Settings → Memory → Memory stores: project memory (--memory-dir) and the
 * user model (--no-user-model / --user-model-dir /
 * --user-model-review-interval) as controller-owned flags, with the
 * DAEMON's own `memory` / `user_model` capability rows as the "memory is
 * on" status. Pins that (1) the status rows read the capability document
 * — on / off / not reported; (2) the controls show the saved document and
 * the placeholders are the controller's defaults; (3) turning a store off
 * disables its directory (and the interval) and the confirmed save sends
 * the merged whole document; (4) the interval is clamped to 1..1000; (5)
 * external mode renders the managed note plus the status rows, no switch.
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
  runtime.mode = "managed";
  runtime.serverCapabilities = { memory: true, user_model: false };
});

describe("MemoryStoresCard", () => {
  it("reports both stores from the daemon's capability document", () => {
    render(<MemoryStoresCard />);
    expect(screen.getByTestId("memory-status-project")).toHaveTextContent("on");
    expect(screen.getByTestId("memory-status-user-model")).toHaveTextContent(
      "off",
    );
  });

  it("says 'not reported' when the daemon advertised neither store", () => {
    runtime.serverCapabilities = {};
    render(<MemoryStoresCard />);
    expect(screen.getByTestId("memory-status-project")).toHaveTextContent(
      "not reported",
    );
  });

  it("shows the saved document with the controller's defaults as placeholders", () => {
    hook.doc = doc({
      ...EMPTY_DAEMON_OPTIONS,
      userModel: { enabled: true, dir: "", reviewInterval: 3 },
    });
    render(<MemoryStoresCard />);
    expect(
      screen.getByRole("switch", { name: "Project memory" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Project memory directory")).toHaveAttribute(
      "placeholder",
      "/repo/.scratch/studio-memory",
    );
    expect(screen.getByLabelText("User model directory")).toHaveAttribute(
      "placeholder",
      "/home/me/.config/mecatl/usermodel",
    );
    expect(screen.getByLabelText("Review every Nth completion")).toHaveValue(3);
    expect(
      screen.getByRole("link", { name: "Settings → Learning" }),
    ).toHaveAttribute("href", "/workspace/settings/learning");
  });

  it("turning project memory off disables its directory and saves the merged document", async () => {
    const user = userEvent.setup();
    render(<MemoryStoresCard />);
    await user.click(screen.getByRole("switch", { name: "Project memory" }));
    expect(screen.getByLabelText("Project memory directory")).toBeDisabled();
    expect(screen.getByTestId("memory-stores-pending")).toBeInTheDocument();
    await confirmSave(user);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      projectMemory: { enabled: false, dir: "" },
    });
  });

  it("turning the user model off disables its directory and interval", async () => {
    const user = userEvent.setup();
    render(<MemoryStoresCard />);
    await user.click(screen.getByRole("switch", { name: "User model" }));
    expect(screen.getByLabelText("User model directory")).toBeDisabled();
    expect(screen.getByLabelText("Review every Nth completion")).toBeDisabled();
    await confirmSave(user);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      userModel: { enabled: false, dir: "", reviewInterval: 1 },
    });
  });

  it("clamps the review interval to 1..1000 and carries a typed directory", async () => {
    const user = userEvent.setup();
    render(<MemoryStoresCard />);
    const interval = screen.getByLabelText("Review every Nth completion");
    await user.clear(interval);
    await user.type(interval, "5000");
    expect(interval).toHaveValue(1000);
    await user.type(
      screen.getByLabelText("Project memory directory"),
      ".memory",
    );
    await confirmSave(user);
    expect(hook.save).toHaveBeenCalledWith({
      ...EMPTY_DAEMON_OPTIONS,
      projectMemory: { enabled: true, dir: ".memory" },
      userModel: { enabled: true, dir: "", reviewInterval: 1000 },
    });
  });

  it("renders the managed note and the status rows in external mode, with no controls", () => {
    hook.manageable = false;
    runtime.mode = "external";
    render(<MemoryStoresCard />);
    expect(
      screen.getByText("Managed by the external mecated deployment", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/--no-user-model/)).toBeInTheDocument();
    expect(screen.getByTestId("memory-status-project")).toHaveTextContent("on");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
