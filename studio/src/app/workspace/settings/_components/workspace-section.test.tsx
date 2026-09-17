import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type { HarnessControlStatus } from "@/lib/harness/client";
import {
  WORKSPACE_CHANGED_NOTICE,
  WorkspaceSection,
  workspaceChangeSummary,
} from "./workspace-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * Settings → Workspace: the web analogue of the TUI's `--workspace`
 * deployment choice. Pins that (1) the managed card shows the root the
 * controller reports and "Change…" prompts for a path, then confirms with
 * the restart warning naming the directory and the posture in force before
 * the write, (2) cancelling either dialog writes nothing, (3) "Reset to
 * default" appears only while the live root differs and writes the default,
 * (4) a controller refusal lands as an alert, and (5) external and offline
 * states render the label / a note, never a control.
 */

const saveHarnessWorkspace = vi.hoisted(() =>
  vi.fn(async (_path: string) => {}),
);
vi.mock("@/lib/harness/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/harness/client")>()),
  saveHarnessWorkspace,
}));

const runtimeStatus = vi.hoisted(() => ({ posture: "auto" }));
vi.mock("@/features/agent/runtime-status", () => ({
  useOptionalRuntimeStatus: () => runtimeStatus,
}));

function controlStatus(
  overrides: Partial<HarnessControlStatus> = {},
): HarnessControlStatus {
  return {
    mode: "managed",
    provider: "offline mock",
    isMock: true,
    running: true,
    gateway: null,
    toolhiveGateway: null,
    modelRouter: null,
    operatorSettings: false,
    skillsDir: "",
    memoryDir: "",
    configuredProviders: [],
    selectedProvider: "mock",
    authFile: "",
    workspace: "/repo",
    defaultWorkspace: "/repo",
    permissions: null,
    storage: null,
    retention: null,
    ...overrides,
  };
}

const refresh = vi.fn(async () => {});

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  const base: Partial<Runtime> = {
    live: true,
    mode: "managed",
    status: controlStatus(),
    router: null,
    permissions: null,
    models: [],
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    refresh,
  };
  return { ...base, ...overrides } as Runtime;
}

beforeEach(() => {
  saveHarnessWorkspace.mockReset();
  saveHarnessWorkspace.mockResolvedValue(undefined);
  refresh.mockClear();
  runtimeStatus.posture = "auto";
});

describe("workspaceChangeSummary", () => {
  it("names the directory, the posture, the restart, the chat list, trust and the created directory", () => {
    const text = workspaceChangeSummary({
      next: "/home/dev/other",
      posture: "auto",
    });
    expect(text).toContain("restarts against /home/dev/other");
    expect(text).toContain("ends in-flight runs");
    expect(text).toContain("with the auto posture");
    expect(text).toContain(
      "stored per root and reappears when you switch back",
    );
    expect(text).toContain(
      "Project trust granted for the current root is withdrawn",
    );
    expect(text).toContain("creates .mecatl/skills inside the new root");
  });

  it("does not invent a tier the daemon did not report", () => {
    expect(workspaceChangeSummary({ next: "/x", posture: "" })).toContain(
      "with its current posture",
    );
  });
});

describe("WorkspaceSection", () => {
  it("shows the reported root and no reset while it is the default", () => {
    render(<WorkspaceSection runtime={fakeRuntime()} />);
    expect(screen.getByTestId("workspace-root")).toHaveTextContent("/repo");
    expect(screen.getByRole("button", { name: "Change…" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Reset to default" }),
    ).toBeNull();
    expect(screen.getByText(/restarts the daemon/)).toBeInTheDocument();
  });

  it("prompts for a path, confirms with the directory and posture, then writes and re-reads", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSection runtime={fakeRuntime()} />);

    await user.click(screen.getByRole("button", { name: "Change…" }));
    const input = await screen.findByPlaceholderText("/absolute/path/to/repo");
    expect(input).toHaveValue("/repo");
    await user.clear(input);
    await user.type(input, "/home/dev/other");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Change the workspace root?");
    expect(dialog).toHaveTextContent("restarts against /home/dev/other");
    expect(dialog).toHaveTextContent("with the auto posture");
    expect(dialog).toHaveTextContent("ends in-flight runs");
    expect(saveHarnessWorkspace).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Change and restart" }),
    );
    await waitFor(() =>
      expect(saveHarnessWorkspace).toHaveBeenCalledWith("/home/dev/other"),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(
      WORKSPACE_CHANGED_NOTICE,
    );
  });

  it("writes nothing when the prompt or the confirm is cancelled", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSection runtime={fakeRuntime()} />);

    await user.click(screen.getByRole("button", { name: "Change…" }));
    await screen.findByPlaceholderText("/absolute/path/to/repo");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveHarnessWorkspace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Change…" }));
    const input = await screen.findByPlaceholderText("/absolute/path/to/repo");
    await user.clear(input);
    await user.type(input, "/home/dev/other");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveHarnessWorkspace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers Reset to default while the live root differs and writes the default", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceSection
        runtime={fakeRuntime({
          status: controlStatus({ workspace: "/home/dev/other" }),
        })}
      />,
    );
    expect(screen.getByTestId("workspace-root")).toHaveTextContent(
      "/home/dev/other",
    );
    expect(screen.getByText("/repo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("restarts against /repo");
    await user.click(
      screen.getByRole("button", { name: "Change and restart" }),
    );
    await waitFor(() =>
      expect(saveHarnessWorkspace).toHaveBeenCalledWith("/repo"),
    );
  });

  it("surfaces the controller's refusal as an alert", async () => {
    saveHarnessWorkspace.mockRejectedValueOnce(
      new Error("Workspace root does not exist: /nope"),
    );
    const user = userEvent.setup();
    render(<WorkspaceSection runtime={fakeRuntime()} />);
    await user.click(screen.getByRole("button", { name: "Change…" }));
    const input = await screen.findByPlaceholderText("/absolute/path/to/repo");
    await user.clear(input);
    await user.type(input, "/nope");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("alertdialog");
    await user.click(
      screen.getByRole("button", { name: "Change and restart" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workspace root does not exist: /nope",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders the label and the managed note, without controls, in external mode", () => {
    render(
      <WorkspaceSection
        runtime={fakeRuntime({
          mode: "external",
          status: controlStatus({
            mode: "external",
            workspace: "/workspace/from-deployment",
            defaultWorkspace: undefined,
          }),
        })}
      />,
    );
    expect(screen.getByTestId("workspace-root")).toHaveTextContent(
      "/workspace/from-deployment",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(<WorkspaceSection runtime={fakeRuntime({ live: false })} />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
