import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessRuntimeSettingsDoc } from "@/lib/harness/runtime-settings";
import type { HarnessSoul } from "@/lib/harness/soul";
import {
  baselinePath,
  canApproveBaseline,
  driftNote,
  SoulSection,
} from "./soul-section";

/**
 * Settings → Agent → Persona: the web form of mecatui's soul surface. Pins
 * that (1) the snapshot card renders the daemon's `GET /v1/soul` — status,
 * provenance, drift, size, hash — with the body as plain text behind a
 * disclosure, and re-reads it when the runtime-settings document changes
 * (every controller write restarts the daemon); (2) the settings card binds
 * a draft of the saved `soul` document — flipping "Load a persona" opens the
 * restart confirm and only the confirm calls `save({ soul })`, Discard and
 * Cancel save nothing, strict and file follow the enabled switch; (3) a
 * DRIFTED user/project soul offers "Accept current persona as baseline"
 * whose confirm calls `approveSoul`, while a driver soul, an undrifted one
 * and a disabled persona do not; (4) a loaded project soul is marked trusted
 * (the TUI's "project (trusted)"), a dropped untrusted one is named as such,
 * and an empty selection names the files that were not found; (5) external
 * mode renders the managed note with no
 * control, offline the offline note, and a daemon without the capability
 * says so while the managed controls stay usable so it can be re-enabled.
 */

const runtimeStatus = vi.hoisted(() => ({
  connected: true,
}));

const runtimeSettings = vi.hoisted(() => ({
  live: true,
  manageable: true,
  soulSupported: true,
  doc: null as HarnessRuntimeSettingsDoc | null,
  isLoading: false,
  busy: "" as "" | "save" | "approve-soul",
  error: null as string | null,
  notice: null as string | null,
  save: vi.fn(async () => true),
  approveSoul: vi.fn(async () => true),
}));

const soulFetch = vi.hoisted(() => vi.fn());
const copy = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtimeStatus,
}));

vi.mock("@/features/agent/hooks/use-runtime-settings", () => ({
  useRuntimeSettings: () => runtimeSettings,
}));

vi.mock("@/lib/harness/soul", () => ({
  fetchHarnessSoul: soulFetch,
}));

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: copy,
}));

const doc = (
  soul: Partial<HarnessRuntimeSettingsDoc["config"]["soul"]> = {},
): HarnessRuntimeSettingsDoc => ({
  config: {
    learning: { mode: "", sensitivity: "" },
    steer: { enabled: true },
    soul: { enabled: true, strict: false, file: "", ...soul },
  },
  managedBy: { learning: "studio", steer: "studio", soul: "studio" },
  inherited: { learning: { mode: "", sensitivity: "" }, steer: null },
  effective: {
    learning: { mode: "off", sensitivity: "balanced" },
    steer: true,
  },
  soulFileDefault: "/home/me/.config/mecatl/soul.md",
  soulCandidates: [
    { path: "/home/me/.config/mecatl/soul.md", name: "soul.md" },
    { path: "/home/me/.config/mecatl/terse.md", name: "terse.md" },
  ],
});

const snapshot = (overrides: Partial<HarnessSoul> = {}): HarnessSoul => ({
  present: true,
  content: "You are concise and direct.",
  sizeBytes: 27,
  sha256: "abcdef0123456789".repeat(4),
  provenance: "user",
  trusted: true,
  drifted: false,
  ...overrides,
});

beforeEach(() => {
  runtimeStatus.connected = true;
  runtimeSettings.live = true;
  runtimeSettings.manageable = true;
  runtimeSettings.soulSupported = true;
  runtimeSettings.doc = doc();
  runtimeSettings.isLoading = false;
  runtimeSettings.busy = "";
  runtimeSettings.error = null;
  runtimeSettings.notice = null;
  runtimeSettings.save.mockClear();
  runtimeSettings.approveSoul.mockClear();
  soulFetch.mockReset();
  soulFetch.mockResolvedValue(snapshot());
  copy.mockClear();
});

describe("SoulSection snapshot", () => {
  it("renders the daemon's persona rows and the body behind the disclosure", async () => {
    const user = userEvent.setup();
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-status")).toHaveTextContent(
      "loaded",
    );
    expect(screen.getByTestId("soul-provenance")).toHaveTextContent("user");
    expect(screen.getByTestId("soul-size")).toHaveTextContent("27 bytes");
    const hash = screen.getByTestId("soul-sha256");
    expect(hash).toHaveTextContent("abcdef012345");
    expect(hash).toHaveAttribute("title", "abcdef0123456789".repeat(4));
    expect(screen.queryByTestId("soul-drift")).not.toBeInTheDocument();
    // The body is hidden until asked for, then shown as plain text.
    expect(
      screen.queryByText("You are concise and direct."),
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Show persona" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText("You are concise and direct.").tagName).toBe("PRE");
    expect(
      screen.getByRole("button", { name: "Hide persona" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("copies the full hash from the SHA-256 row", async () => {
    const user = userEvent.setup();
    render(<SoulSection />);
    await user.click(
      await screen.findByRole("button", { name: "Copy SHA-256" }),
    );
    expect(copy).toHaveBeenCalledWith("abcdef0123456789".repeat(4), "SHA-256");
  });

  it("shows the drift line naming the baseline file", async () => {
    soulFetch.mockResolvedValue(snapshot({ drifted: true }));
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-drift")).toHaveTextContent(
      "Edited since its recorded baseline (/home/me/.config/mecatl/soul.md.sha256)",
    );
  });

  it("names a dropped untrusted project soul", async () => {
    soulFetch.mockResolvedValue(
      snapshot({
        present: false,
        content: "",
        sizeBytes: 0,
        sha256: "",
        provenance: "project",
        trusted: false,
      }),
    );
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-status")).toHaveTextContent(
      "not loaded",
    );
    expect(screen.getByTestId("soul-provenance")).toHaveTextContent("project");
    expect(
      screen.getByText("dropped — untrusted project soul"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show persona" }),
    ).not.toBeInTheDocument();
  });

  it("marks a loaded project soul as trusted, and a user soul without the badge", async () => {
    soulFetch.mockResolvedValue(
      snapshot({ provenance: "project", trusted: true }),
    );
    const first = render(<SoulSection />);
    expect(await screen.findByTestId("soul-provenance")).toHaveTextContent(
      "project",
    );
    expect(screen.getByTestId("soul-trust")).toHaveTextContent("trusted");
    expect(
      screen.queryByText("dropped — untrusted project soul"),
    ).not.toBeInTheDocument();
    first.unmount();

    // A user soul is always trusted; its provenance hint says so, so no
    // separate badge (the TUI renders it as plain "user").
    soulFetch.mockResolvedValue(snapshot());
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-provenance")).toHaveTextContent(
      "user",
    );
    expect(screen.queryByTestId("soul-trust")).not.toBeInTheDocument();
  });

  it("names the files that were not found when the daemon selected no persona", async () => {
    soulFetch.mockResolvedValue(
      snapshot({
        present: false,
        content: "",
        sizeBytes: 0,
        sha256: "",
        provenance: "none",
        trusted: false,
      }),
    );
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-status")).toHaveTextContent(
      "not loaded",
    );
    expect(
      screen.getByText(
        "No persona file was found: neither a user soul.md nor a project .mecatl/soul.md.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("soul-trust")).not.toBeInTheDocument();
    expect(screen.queryByTestId("soul-size")).not.toBeInTheDocument();
  });

  it("re-reads the snapshot when the runtime-settings document changes", async () => {
    const { rerender } = render(<SoulSection />);
    await screen.findByTestId("soul-status");
    expect(soulFetch).toHaveBeenCalledTimes(1);
    runtimeSettings.doc = doc({ strict: true });
    soulFetch.mockResolvedValue(snapshot({ drifted: false }));
    rerender(<SoulSection />);
    await waitFor(() => expect(soulFetch).toHaveBeenCalledTimes(2));
  });

  it("says so for an older daemon without the route, and names a read failure", async () => {
    soulFetch.mockResolvedValue(null);
    const { unmount } = render(<SoulSection />);
    expect(
      await screen.findByText(/does not report its persona/),
    ).toBeInTheDocument();
    unmount();

    soulFetch.mockRejectedValue(new Error("management_unauthorized"));
    render(<SoulSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "management_unauthorized",
    );
  });

  it("renders the no-persona note without the capability, keeping the managed controls", () => {
    runtimeSettings.soulSupported = false;
    render(<SoulSection />);
    expect(
      screen.getByText(/This daemon has no persona loaded/),
    ).toBeInTheDocument();
    expect(soulFetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("switch", { name: "Load a persona" }),
    ).toBeInTheDocument();
  });
});

describe("SoulSection settings", () => {
  it("mirrors the saved document and saves the draft only after the restart confirm", async () => {
    const user = userEvent.setup();
    render(<SoulSection />);
    const load = screen.getByRole("switch", { name: "Load a persona" });
    const strict = screen.getByRole("switch", {
      name: "Refuse a drifted persona",
    });
    const file = screen.getByRole("combobox", { name: "Persona file" });
    expect(load).toBeChecked();
    expect(strict).not.toBeChecked();
    expect(file).toHaveValue("");
    expect(file).toHaveAttribute(
      "placeholder",
      "/home/me/.config/mecatl/soul.md",
    );
    const saveButton = screen.getByRole("button", { name: "Save and restart" });
    expect(saveButton).toBeDisabled();

    await user.click(load);
    expect(load).not.toBeChecked();
    // Strict and the file follow the enabled switch.
    expect(strict).toBeDisabled();
    expect(file).toBeDisabled();
    expect(saveButton).toBeEnabled();
    expect(runtimeSettings.save).not.toHaveBeenCalled();

    await user.click(saveButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Restart the daemon to apply persona settings?",
    );
    expect(runtimeSettings.save).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Save and restart", hidden: false }),
    );
    expect(runtimeSettings.save).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      soul: { enabled: false, strict: false, file: "" },
    });
  });

  it("saves strict and a chosen file together, and saves nothing on Cancel or Discard", async () => {
    const user = userEvent.setup();
    render(<SoulSection />);
    await user.click(
      screen.getByRole("switch", { name: "Refuse a drifted persona" }),
    );
    const file = screen.getByRole("combobox", { name: "Persona file" });
    await user.type(file, "/home/me/.config/mecatl/terse.md");
    // The controller's candidate list backs the input.
    expect(file).toHaveAttribute("list", "soul-file-candidates");

    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(runtimeSettings.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Save and restart" })).at(
        -1,
      ) as HTMLElement,
    );
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      soul: {
        enabled: true,
        strict: true,
        file: "/home/me/.config/mecatl/terse.md",
      },
    });

    // A successful save drops the draft, so the switches show the SAVED
    // document again (the mocked document did not change: strict is off).
    runtimeSettings.save.mockClear();
    const strict = screen.getByRole("switch", {
      name: "Refuse a drifted persona",
    });
    expect(strict).not.toBeChecked();
    // Discard drops a new draft without a save.
    await user.click(strict);
    expect(strict).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(strict).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
    expect(runtimeSettings.save).not.toHaveBeenCalled();
  });

  it("offers the baseline approval for a drifted user soul and calls approveSoul on confirm", async () => {
    const user = userEvent.setup();
    soulFetch.mockResolvedValue(snapshot({ drifted: true }));
    render(<SoulSection />);
    const approve = await screen.findByRole("button", {
      name: "Accept current persona as baseline",
    });
    await user.click(approve);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Rewrites /home/me/.config/mecatl/soul.md.sha256",
    );
    expect(runtimeSettings.approveSoul).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Accept and restart" }),
    );
    expect(runtimeSettings.approveSoul).toHaveBeenCalledTimes(1);
  });

  it("withholds the baseline approval for a driver soul, an undrifted soul and a disabled persona", async () => {
    soulFetch.mockResolvedValue(
      snapshot({ drifted: true, provenance: "driver" }),
    );
    const first = render(<SoulSection />);
    await screen.findByTestId("soul-drift");
    expect(
      screen.queryByRole("button", {
        name: "Accept current persona as baseline",
      }),
    ).not.toBeInTheDocument();
    first.unmount();

    soulFetch.mockResolvedValue(snapshot({ drifted: true }));
    runtimeSettings.doc = doc({ enabled: false });
    render(<SoulSection />);
    await screen.findByTestId("soul-drift");
    expect(
      screen.queryByRole("button", {
        name: "Accept current persona as baseline",
      }),
    ).not.toBeInTheDocument();
  });

  it("disables the controls while a write is in flight and surfaces error and notice", async () => {
    runtimeSettings.busy = "save";
    runtimeSettings.error = "soul.file must be inside /home/me/.config/mecatl";
    runtimeSettings.notice =
      "Saved. The daemon restarted with the new settings.";
    render(<SoulSection />);
    await screen.findByTestId("soul-status");
    expect(
      screen.getByRole("switch", { name: "Load a persona" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Persona file" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "soul.file must be inside",
    );
    expect(
      screen.getByRole("combobox", { name: "Persona file" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      /The daemon restarted/,
    );
  });

  it("renders the managed note with no control in external mode, keeping the snapshot", async () => {
    runtimeSettings.manageable = false;
    runtimeSettings.doc = null;
    render(<SoulSection />);
    expect(await screen.findByTestId("soul-status")).toHaveTextContent(
      "loaded",
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the offline note in both cards when the runtime is unreachable", () => {
    runtimeStatus.connected = false;
    runtimeSettings.live = false;
    runtimeSettings.doc = null;
    render(<SoulSection />);
    expect(screen.getAllByText(/The runtime is offline/)).toHaveLength(2);
    expect(soulFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("says it is reading while the document loads", async () => {
    runtimeSettings.doc = null;
    runtimeSettings.isLoading = true;
    render(<SoulSection />);
    await screen.findByTestId("soul-status");
    expect(
      screen.getByText(/Reading the daemon's runtime settings/),
    ).toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("names the baseline file from the chosen or conventional persona path", () => {
    expect(baselinePath(null)).toBe("");
    expect(baselinePath(doc())).toBe("/home/me/.config/mecatl/soul.md.sha256");
    expect(baselinePath(doc({ file: "/ws/.mecatl/soul.md" }))).toBe(
      "/ws/.mecatl/soul.md.sha256",
    );
    expect(driftNote(null)).toMatch(/its recorded \.sha256 baseline/);
  });

  it("approves a baseline only for a drifted, enabled user or project soul", () => {
    const enabled = { enabled: true, strict: false, file: "" };
    expect(canApproveBaseline(snapshot({ drifted: true }), enabled)).toBe(true);
    expect(
      canApproveBaseline(
        snapshot({ drifted: true, provenance: "project" }),
        enabled,
      ),
    ).toBe(true);
    expect(
      canApproveBaseline(
        snapshot({ drifted: true, provenance: "driver" }),
        enabled,
      ),
    ).toBe(false);
    expect(canApproveBaseline(snapshot(), enabled)).toBe(false);
    expect(
      canApproveBaseline(snapshot({ drifted: true }), {
        ...enabled,
        enabled: false,
      }),
    ).toBe(false);
    expect(canApproveBaseline(null, enabled)).toBe(false);
  });
});
