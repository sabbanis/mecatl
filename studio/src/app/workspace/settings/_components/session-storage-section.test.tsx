import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type {
  HarnessControlStatus,
  HarnessStorageSettings,
  HarnessStorageState,
} from "@/lib/harness/client";
import {
  describeLocation,
  IN_MEMORY_CONSEQUENCES,
  SessionStorageSection,
  storageChangeSummary,
  storageSettingsFor,
} from "./session-storage-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The Storage page's session-store card: the web analogue of mecated's
 * --store-dir and of running without one. Pins that (1) the saved location
 * and mode render from /status.storage, (2) Save stays disabled until the
 * draft differs and always confirms with the restart warning first, (3) the
 * in-memory switch names every real consequence (no scheduler, no storage
 * health/retention/maintenance, no resume) before the write, (4) the body
 * sent is the trimmed location or NO location — never an empty string —
 * and (5) external, offline and older-controller states render notes, not
 * a form.
 */

const durableStore: HarnessStorageState = {
  persistence: "durable",
  dir: "/repo/.scratch/studio-sessions",
  storeDir: ".scratch/studio-sessions",
  defaultDir: "/repo/.scratch/studio-sessions",
  defaultPersistence: "durable",
};

const memoryStore: HarnessStorageState = {
  ...durableStore,
  persistence: "memory",
  dir: "",
};

const saveStorage = vi.fn(async (_settings: HarnessStorageSettings) => {});

function controlStatus(
  storage: HarnessStorageState | null,
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
    storage,
    retention: null,
  };
}

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    live: true,
    mode: "managed",
    status: controlStatus(durableStore),
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
    saveStorage,
    saveRetention: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  saveStorage.mockClear();
});

describe("SessionStorageSection", () => {
  it("renders the saved location, its resolved path and the durable switch on", () => {
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    const location = screen.getByRole("textbox", { name: "Location" });
    expect(location).toHaveValue(".scratch/studio-sessions");
    expect(location).toHaveAttribute(
      "placeholder",
      "/repo/.scratch/studio-sessions",
    );
    expect(
      screen.getByText("Resolved: /repo/.scratch/studio-sessions"),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Durable store" })).toBeChecked();
    expect(
      screen.getByText(/Relative paths resolve inside the workspace/),
    ).toBeInTheDocument();
    // Where the defaults come from, and what a save costs.
    expect(screen.getByText("MECATL_STUDIO_STORE_DIR")).toBeInTheDocument();
    expect(screen.getByText("MECATL_STUDIO_NO_STORE=1")).toBeInTheDocument();
    expect(screen.getByText(/Saving restarts the daemon/)).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("keeps Save disabled until the draft differs, confirms the restart, then sends the trimmed location", async () => {
    const user = userEvent.setup();
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const location = screen.getByRole("textbox", { name: "Location" });
    await user.clear(location);
    await user.type(location, "  /var/lib/mecatl/sessions ");
    expect(save).toBeEnabled();
    // The hint follows the edit: an absolute path resolves to itself.
    expect(
      screen.getByText("Resolved: /var/lib/mecatl/sessions"),
    ).toBeInTheDocument();

    await user.click(save);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Change the session store\?/);
    expect(dialog).toHaveTextContent(/Saving restarts the daemon/);
    expect(dialog).toHaveTextContent(
      /chats stored at \/repo\/.scratch\/studio-sessions stay on disk but disappear from the sidebar/,
    );
    expect(saveStorage).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveStorage).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(saveStorage).toHaveBeenCalledWith({
      persistence: "durable",
      storeDir: "/var/lib/mecatl/sessions",
    });
  });

  it("describes a relative edit as resolving inside the workspace and a blank one as the default", async () => {
    const user = userEvent.setup();
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    const location = screen.getByRole("textbox", { name: "Location" });
    await user.clear(location);
    expect(
      screen.getByText("Default: /repo/.scratch/studio-sessions"),
    ).toBeInTheDocument();
    await user.type(location, "state/sessions");
    expect(
      screen.getByText("Resolves inside the workspace: /repo/state/sessions"),
    ).toBeInTheDocument();
  });

  it("switching to in-memory shows the consequences, confirms destructively, and sends the mode with the kept location", async () => {
    const user = userEvent.setup();
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    const durable = screen.getByRole("switch", { name: "Durable store" });
    await user.click(durable);
    expect(durable).not.toBeChecked();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/Running without a store/);
    expect(note).toHaveTextContent(/scheduled tasks never fire/);
    expect(note).toHaveTextContent(
      /storage health, retention and maintenance are unavailable/,
    );
    expect(note).toHaveTextContent(/cannot be resumed/);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switching to in-memory/);
    expect(dialog).toHaveTextContent(/Chats vanish when the daemon stops/);
    expect(dialog).toHaveTextContent(
      /Chats already stored at \/repo\/.scratch\/studio-sessions stay on disk/,
    );
    await user.click(
      await screen.findByRole("button", { name: "Switch to in-memory" }),
    );
    // The location rides along so switching back later lands on the same store.
    expect(saveStorage).toHaveBeenCalledWith({
      persistence: "memory",
      storeDir: ".scratch/studio-sessions",
    });
  });

  it("omits the location entirely when the field is blank — never an empty string", async () => {
    const user = userEvent.setup();
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    await user.clear(screen.getByRole("textbox", { name: "Location" }));
    await user.click(screen.getByRole("switch", { name: "Durable store" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Switch to in-memory" }),
    );
    expect(saveStorage).toHaveBeenCalledTimes(1);
    expect(saveStorage.mock.calls[0][0]).toEqual({ persistence: "memory" });
    expect(saveStorage.mock.calls[0][0]).not.toHaveProperty("storeDir");
  });

  it("renders an in-memory daemon as the switch off with the warning, and explains the way back", async () => {
    const user = userEvent.setup();
    render(
      <SessionStorageSection
        runtime={fakeRuntime({ status: controlStatus(memoryStore) })}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Durable store" }),
    ).not.toBeChecked();
    expect(screen.getByRole("note")).toHaveTextContent(
      /Running without a store/,
    );
    await user.click(screen.getByRole("switch", { name: "Durable store" }));
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switching to a durable store/);
    expect(dialog).toHaveTextContent(/in-memory chats are lost/);
  });

  it("Discard returns to the saved values and disables Save again", async () => {
    const user = userEvent.setup();
    render(<SessionStorageSection runtime={fakeRuntime()} />);
    await user.click(screen.getByRole("switch", { name: "Durable store" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("switch", { name: "Durable store" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("shows Saving… and blocks the controls while the write is in flight", () => {
    render(
      <SessionStorageSection runtime={fakeRuntime({ busy: "storage" })} />,
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("renders the managed note and no form in external mode", () => {
    render(
      <SessionStorageSection
        runtime={fakeRuntime({
          mode: "external",
          status: { ...controlStatus(null), mode: "external" },
        })}
      />,
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(<SessionStorageSection runtime={fakeRuntime({ live: false })} />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("reports a controller that did not answer with a store instead of inventing a path", () => {
    render(
      <SessionStorageSection
        runtime={fakeRuntime({ status: controlStatus(null) })}
      />,
    );
    expect(
      screen.getByText(/controller did not report its session store/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    render(<SessionStorageSection runtime={fakeRuntime({ status: null })} />);
    expect(
      screen.getAllByText(/controller did not report its session store/),
    ).toHaveLength(2);
  });
});

describe("storageChangeSummary", () => {
  it("always leads with the restart, then names exactly the change that applies", () => {
    const unchanged = storageChangeSummary(durableStore, {
      persistence: "durable",
      storeDir: ".scratch/studio-sessions",
    });
    expect(unchanged).toBe("Saving restarts the daemon: in-flight runs end.");

    const moved = storageChangeSummary(durableStore, {
      persistence: "durable",
      storeDir: "/elsewhere",
    });
    expect(moved).toMatch(/^Saving restarts the daemon/);
    expect(moved).toMatch(/Changing the location/);
    expect(moved).not.toMatch(/in-memory/);

    const toMemory = storageChangeSummary(durableStore, {
      persistence: "memory",
      storeDir: ".scratch/studio-sessions",
    });
    expect(toMemory).toContain(IN_MEMORY_CONSEQUENCES);
    expect(toMemory).toMatch(/come back when you switch back/);

    const backToDisk = storageChangeSummary(memoryStore, {
      persistence: "durable",
      storeDir: "",
    });
    expect(backToDisk).toMatch(
      /written to \/repo\/.scratch\/studio-sessions\.$/,
    );
  });
});

describe("describeLocation", () => {
  it("prefers the controller's resolved path for the saved durable location", () => {
    expect(
      describeLocation(
        { persistence: "durable", storeDir: ".scratch/studio-sessions" },
        durableStore,
        "/repo",
      ),
    ).toBe("Resolved: /repo/.scratch/studio-sessions");
  });

  it("describes an in-memory daemon's kept location by how it would resolve", () => {
    expect(
      describeLocation(
        { persistence: "memory", storeDir: ".scratch/studio-sessions" },
        memoryStore,
        "/repo",
      ),
    ).toBe("Resolves inside the workspace: /repo/.scratch/studio-sessions");
    expect(
      describeLocation(
        { persistence: "memory", storeDir: "C:\\sessions" },
        memoryStore,
        "/repo",
      ),
    ).toBe("Resolved: C:\\sessions");
  });
});

describe("storageSettingsFor", () => {
  it("trims the location and omits it when blank", () => {
    expect(
      storageSettingsFor({ persistence: "durable", storeDir: " /x " }),
    ).toEqual({ persistence: "durable", storeDir: "/x" });
    expect(
      storageSettingsFor({ persistence: "memory", storeDir: "  " }),
    ).toEqual({ persistence: "memory" });
  });
});
