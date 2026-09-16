import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type {
  HarnessControlStatus,
  HarnessRetentionSettings,
  HarnessRetentionState,
} from "@/lib/harness/client";
import type {
  StorageHealth,
  StorageRetentionPolicy,
} from "@/lib/harness/storage";
import {
  describeSweep,
  draftFromSettings,
  policyRows,
  RetentionSection,
  retentionChangeSummary,
  retentionProblem,
  retentionSettingsFor,
} from "./retention-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The Storage page's Retention card. Pins that (1) the EFFECTIVE policy
 * renders from the daemon's storage health — Off for 0, humanised ages,
 * per-family counts, the sweep schedule — and degrades to a note when the
 * daemon does not report it; (2) the managed-mode form mirrors the
 * controller's grammar (no `d`, whole counts) and its destructive-main
 * gate: Save stays disabled until the acknowledgement is ticked whenever a
 * main limit is on, and the confirm names exactly what gets deleted; (3)
 * child/scheduled limits need no acknowledgement; (4) the body sent is the
 * normalised document; and (5) external, operator-managed, offline and
 * older-controller states render notes, not a form.
 */

const storageHealth = {
  health: null as StorageHealth | null,
  supported: true,
  degraded: false,
  refresh: vi.fn(),
};

vi.mock("@/features/agent/hooks/use-storage-health", () => ({
  useStorageHealth: () => storageHealth,
}));

const healthyPolicy: StorageRetentionPolicy = {
  mainMaxAgeSeconds: 0,
  mainMaxCount: 0,
  childMaxAgeSeconds: 604_800,
  childMaxCount: 500,
  scheduledMaxAgeSeconds: 604_800,
  scheduledMaxCount: 0,
  sweepCadenceSeconds: 3600,
};

const healthy: StorageHealth = {
  available: true,
  unavailableReason: "",
  sessionCount: 4,
  corruptCount: 0,
  v1Count: 0,
  v2Count: 4,
  mainCount: 2,
  childCount: 1,
  scheduledCount: 1,
  unknownCount: 0,
  fileCount: 9,
  currentBytes: 20_480,
  reclaimableBytes: null,
  policy: healthyPolicy,
  // Half-unit offsets so the relative renders ("2h ago", "in 58m") do not
  // flip when a few milliseconds pass between the fixture and the render.
  lastSweepAt: Date.now() - 2.5 * 3_600_000,
  nextSweepAt: Date.now() + 58.5 * 60_000,
  lastFailure: "",
  activeJob: "",
};

const unsetSettings: HarnessRetentionSettings = {
  main: { maxAge: null, maxCount: null },
  child: { maxAge: null, maxCount: null },
  scheduled: { maxAge: null, maxCount: null },
  sweepCadence: null,
  acknowledgeMainDeletion: false,
};

const studioManaged: HarnessRetentionState = {
  settings: unsetSettings,
  managedBy: "studio",
};

const saveRetention = vi.fn(async (_settings: HarnessRetentionSettings) => {});

function controlStatus(
  retention: HarnessRetentionState | null,
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
    permissions: null,
    storage: null,
    retention,
  };
}

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    live: true,
    mode: "managed",
    status: controlStatus(studioManaged),
    router: null,
    permissions: null,
    models: [],
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    refresh: vi.fn(async () => {}),
    connectGateway: vi.fn(async () => {}),
    connectGatewayOAuth: vi.fn(async () => {}),
    saveRouter: vi.fn(async () => {}),
    savePermissions: vi.fn(async () => {}),
    saveStorage: vi.fn(async () => {}),
    saveRetention,
    ...overrides,
  } as Runtime;
}

beforeEach(() => {
  saveRetention.mockClear();
  storageHealth.refresh.mockClear();
  storageHealth.health = healthy;
  storageHealth.supported = true;
});

describe("RetentionSection — effective policy", () => {
  it("renders the daemon's policy: Off for zeros, humanised ages, counts and the sweep schedule", () => {
    render(<RetentionSection runtime={fakeRuntime()} />);
    const table = screen.getByRole("table", {
      name: "Effective retention policy",
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "Main chatsOffOff2",
      "Child runs7d5001",
      "Scheduled fires7dOff1",
    ]);
    expect(screen.getByText("every 1h")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("in 58m")).toBeInTheDocument();
    expect(screen.getByText("20 KB")).toBeInTheDocument();
  });

  it("says so when the daemon does not advertise storage health", () => {
    storageHealth.supported = false;
    storageHealth.health = null;
    render(<RetentionSection runtime={fakeRuntime()} />);
    expect(
      screen.getByText(/does not report storage health/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // The form is a separate half: still offered in managed mode.
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("says so when the health read is unavailable, unreadable, or policy-less", () => {
    storageHealth.health = null;
    const { unmount } = render(<RetentionSection runtime={fakeRuntime()} />);
    expect(
      screen.getByText(/storage health is not available right now/),
    ).toBeInTheDocument();
    unmount();

    storageHealth.health = {
      ...healthy,
      available: false,
      unavailableReason: "permission denied",
    };
    const second = render(<RetentionSection runtime={fakeRuntime()} />);
    expect(
      screen.getByText(/session store cannot be read: permission denied/),
    ).toBeInTheDocument();
    second.unmount();

    storageHealth.health = { ...healthy, policy: null };
    render(<RetentionSection runtime={fakeRuntime()} />);
    expect(
      screen.getByText("The daemon reported no retention policy."),
    ).toBeInTheDocument();
  });
});

describe("RetentionSection — form", () => {
  it("renders the saved limits and keeps Save disabled until the draft differs", () => {
    render(
      <RetentionSection
        runtime={fakeRuntime({
          status: controlStatus({
            settings: {
              ...unsetSettings,
              child: { maxAge: "72h", maxCount: 250 },
              sweepCadence: "30m",
            },
            managedBy: "studio",
          }),
        })}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Child runs max age" }),
    ).toHaveValue("72h");
    expect(
      screen.getByRole("spinbutton", { name: "Child runs max count" }),
    ).toHaveValue(250);
    expect(
      screen.getByRole("textbox", { name: "Main chats max age" }),
    ).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Sweep cadence" })).toHaveValue(
      "30m",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    expect(screen.getByText(/Saving restarts the daemon/)).toBeInTheDocument();
  });

  it("gates main limits on the acknowledgement, confirms destructively, then sends the normalised document and refreshes the policy", async () => {
    const user = userEvent.setup();
    render(<RetentionSection runtime={fakeRuntime()} />);
    const save = screen.getByRole("button", { name: "Save" });
    const ack = screen.getByRole("checkbox", {
      name: /Delete my own chats automatically/,
    });
    expect(ack).not.toBeChecked();

    await user.type(
      screen.getByRole("textbox", { name: "Main chats max age" }),
      " 720h ",
    );
    expect(save).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Acknowledge automatic deletion of main chats before enabling main retention",
    );

    await user.click(ack);
    expect(ack).toBeChecked();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(save).toBeEnabled();

    await user.click(save);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Delete old main chats automatically\?/);
    expect(dialog).toHaveTextContent(/Saving restarts the daemon/);
    expect(dialog).toHaveTextContent(
      /main chats older than 720h are deleted permanently/,
    );
    expect(saveRetention).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveRetention).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(
      await screen.findByRole("button", {
        name: "Enable deletion and restart",
      }),
    );
    expect(saveRetention).toHaveBeenCalledWith({
      main: { maxAge: "720h", maxCount: null },
      child: { maxAge: null, maxCount: null },
      scheduled: { maxAge: null, maxCount: null },
      sweepCadence: null,
      acknowledgeMainDeletion: true,
    });
    expect(storageHealth.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not require the acknowledgement for child or scheduled limits and confirms non-destructively", async () => {
    const user = userEvent.setup();
    render(<RetentionSection runtime={fakeRuntime()} />);
    await user.type(
      screen.getByRole("spinbutton", { name: "Scheduled fires max count" }),
      "2000",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Child runs max age" }),
      "0",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await user.click(save);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Change the retention policy\?/);
    expect(dialog).not.toHaveTextContent(/deleted permanently/);
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(saveRetention).toHaveBeenCalledWith({
      ...unsetSettings,
      child: { maxAge: "0", maxCount: null },
      scheduled: { maxAge: null, maxCount: 2000 },
    });
  });

  it("refuses a duration in days with the controller's wording", async () => {
    const user = userEvent.setup();
    render(<RetentionSection runtime={fakeRuntime()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Child runs max age" }),
      "7d",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Child max age must be a Go duration .* days are not a unit/,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Discard returns to the saved values and disables Save again", async () => {
    const user = userEvent.setup();
    render(<RetentionSection runtime={fakeRuntime()} />);
    const cadence = screen.getByRole("textbox", { name: "Sweep cadence" });
    await user.type(cadence, "2h");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(cadence).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows Saving… and blocks the controls while the write is in flight", () => {
    render(<RetentionSection runtime={fakeRuntime({ busy: "retention" })} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Main chats max age" }),
    ).toBeDisabled();
  });
});

describe("RetentionSection — ownership states", () => {
  it("renders the table and the managed note, no form, in external mode", () => {
    render(
      <RetentionSection
        runtime={fakeRuntime({
          mode: "external",
          status: { ...controlStatus(null), mode: "external" },
        })}
      />,
    );
    expect(
      screen.getByRole("table", { name: "Effective retention policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders a read-only note when an imported operator settings file is active", () => {
    render(
      <RetentionSection
        runtime={fakeRuntime({
          status: controlStatus({
            settings: unsetSettings,
            managedBy: "operator-settings",
          }),
        })}
      />,
    );
    expect(
      screen.getByText(/Managed by the imported operator settings file/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(<RetentionSection runtime={fakeRuntime({ live: false })} />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("reports a controller that did not answer with retention settings instead of inventing limits", () => {
    render(
      <RetentionSection
        runtime={fakeRuntime({ status: controlStatus(null) })}
      />,
    );
    expect(
      screen.getByText(/controller did not report its retention settings/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("policyRows / describeSweep", () => {
  it("maps 0 to Off and non-zero to humanised spans and counts", () => {
    expect(policyRows(healthy)).toEqual([
      {
        family: "main",
        label: "Main chats",
        maxAge: "Off",
        maxCount: "Off",
        stored: "2",
      },
      {
        family: "child",
        label: "Child runs",
        maxAge: "7d",
        maxCount: "500",
        stored: "1",
      },
      {
        family: "scheduled",
        label: "Scheduled fires",
        maxAge: "7d",
        maxCount: "Off",
        stored: "1",
      },
    ]);
    expect(policyRows({ ...healthy, policy: null })).toEqual([]);
  });

  it("describes never / not scheduled / startup-only honestly", () => {
    expect(
      describeSweep({
        ...healthy,
        policy: { ...healthyPolicy, sweepCadenceSeconds: 0 },
        lastSweepAt: null,
        nextSweepAt: null,
      }),
    ).toEqual({
      cadence: "Off — the daemon sweeps once at startup only",
      last: "never",
      next: "not scheduled",
    });
  });
});

describe("retentionSettingsFor / retentionProblem / retentionChangeSummary", () => {
  it("normalises the draft through the controller's grammar", () => {
    const draft = draftFromSettings(unsetSettings);
    expect(retentionProblem(draft)).toBeNull();
    expect(
      retentionSettingsFor({
        ...draft,
        main: { maxAge: " 720h", maxCount: "10" },
        acknowledgeMainDeletion: true,
      }),
    ).toEqual({
      ...unsetSettings,
      main: { maxAge: "720h", maxCount: 10 },
      acknowledgeMainDeletion: true,
    });
    expect(
      retentionProblem({ ...draft, main: { maxAge: "", maxCount: "5" } }),
    ).toMatch(/^Acknowledge automatic deletion/);
    expect(
      retentionProblem({ ...draft, scheduled: { maxAge: "", maxCount: "-1" } }),
    ).toMatch(/^Scheduled max count/);
  });

  it("names the restart always and the deletions only when main retention is on", () => {
    expect(retentionChangeSummary(unsetSettings)).toBe(
      "Saving restarts the daemon: in-flight runs end.",
    );
    const both = retentionChangeSummary({
      ...unsetSettings,
      main: { maxAge: "720h", maxCount: 100 },
      acknowledgeMainDeletion: true,
    });
    expect(both).toMatch(/^Saving restarts the daemon/);
    expect(both).toMatch(
      /main chats older than 720h and main chats beyond the newest 100 are deleted permanently/,
    );
    const countOnly = retentionChangeSummary({
      ...unsetSettings,
      main: { maxAge: "0", maxCount: 100 },
      acknowledgeMainDeletion: true,
    });
    expect(countOnly).not.toMatch(/older than/);
    expect(countOnly).toMatch(/beyond the newest 100/);
  });
});
