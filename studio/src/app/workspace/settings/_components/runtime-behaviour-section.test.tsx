import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessRuntimeSettingsDoc } from "@/lib/harness/runtime-settings";
import {
  RuntimeBehaviourSection,
  steerRowDescription,
} from "./runtime-behaviour-section";

/**
 * Settings → Agent → Daemon behaviour: the operator half of the TUI's steer
 * opt-out. Pins that (1) the switch mirrors the saved `steer.enabled`, a
 * flip opens the restart confirm and only the confirm calls
 * `save({ steer: { enabled } })` — Cancel saves nothing; (2) an operator
 * `steer: false` in settings.yaml (inherited) replaces the switch with Off
 * and says why; (3) external mode renders the managed note and offline the
 * offline note, neither with a switch; (4) the row names the daemon's live
 * `capabilities.steer` when it reports one.
 */

const runtimeSettings = vi.hoisted(() => ({
  live: true,
  manageable: true,
  doc: null as HarnessRuntimeSettingsDoc | null,
  isLoading: false,
  busy: "" as "" | "save" | "approve-soul",
  error: null as string | null,
  notice: null as string | null,
  save: vi.fn(async () => true),
}));

const runtimeStatus = vi.hoisted(() => ({
  serverCapabilities: {} as Record<string, unknown>,
}));

vi.mock("@/features/agent/hooks/use-runtime-settings", () => ({
  useRuntimeSettings: () => runtimeSettings,
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtimeStatus,
}));

const doc = (
  overrides: Partial<{
    enabled: boolean;
    inheritedSteer: boolean | null;
  }> = {},
): HarnessRuntimeSettingsDoc => {
  const enabled = overrides.enabled ?? true;
  const inheritedSteer = overrides.inheritedSteer ?? null;
  return {
    config: {
      learning: { mode: "", sensitivity: "" },
      steer: { enabled },
      soul: { enabled: true, strict: false, file: "" },
    },
    managedBy: { learning: "studio", steer: "studio", soul: "studio" },
    inherited: {
      learning: { mode: "", sensitivity: "" },
      steer: inheritedSteer,
    },
    effective: {
      learning: { mode: "off", sensitivity: "balanced" },
      steer: enabled && inheritedSteer !== false,
    },
    soulFileDefault: "/home/me/.config/mecatl/soul.md",
    soulCandidates: [],
  };
};

beforeEach(() => {
  runtimeSettings.live = true;
  runtimeSettings.manageable = true;
  runtimeSettings.doc = doc();
  runtimeSettings.isLoading = false;
  runtimeSettings.busy = "";
  runtimeSettings.error = null;
  runtimeSettings.notice = null;
  runtimeSettings.save.mockClear();
  runtimeStatus.serverCapabilities = {};
});

describe("RuntimeBehaviourSection", () => {
  it("mirrors the saved value and saves steer off only after the restart confirm", async () => {
    const user = userEvent.setup();
    render(<RuntimeBehaviourSection />);
    const toggle = screen.getByRole("switch", { name: "Mid-run steering" });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Turn mid-run steering off?");
    expect(dialog).toHaveTextContent(/The daemon restarts/);
    // Nothing is saved (and the switch does not move) until the confirm.
    expect(runtimeSettings.save).not.toHaveBeenCalled();
    expect(toggle).toBeChecked();

    await user.click(
      screen.getByRole("button", { name: "Restart and turn off" }),
    );
    expect(runtimeSettings.save).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      steer: { enabled: false },
    });
  });

  it("saves nothing when the confirm is cancelled", async () => {
    const user = userEvent.setup();
    render(<RuntimeBehaviourSection />);
    await user.click(screen.getByRole("switch", { name: "Mid-run steering" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(runtimeSettings.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("offers to turn steering back on when it is saved off", async () => {
    const user = userEvent.setup();
    runtimeSettings.doc = doc({ enabled: false });
    render(<RuntimeBehaviourSection />);
    const toggle = screen.getByRole("switch", { name: "Mid-run steering" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Turn mid-run steering on?",
    );
    await user.click(
      screen.getByRole("button", { name: "Restart and turn on" }),
    );
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      steer: { enabled: true },
    });
  });

  it("replaces the switch with Off and explains an operator steer: false", () => {
    runtimeSettings.doc = doc({ enabled: true, inheritedSteer: false });
    render(<RuntimeBehaviourSection />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getByText(/settings\.yaml sets/)).toBeInTheDocument();
    expect(screen.getByText("steer: false")).toBeInTheDocument();
  });

  it("names the daemon's live capability in the row and surfaces error and notice", () => {
    runtimeStatus.serverCapabilities = { steer: false };
    runtimeSettings.error = "mecated refused to start";
    runtimeSettings.notice =
      "Saved. The daemon restarted with the new settings.";
    render(<RuntimeBehaviourSection />);
    expect(
      screen.getByText(/The daemon currently reports steering off\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "mecated refused to start",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /The daemon restarted/,
    );
  });

  it("disables the switch while a save is in flight", () => {
    runtimeSettings.busy = "save";
    render(<RuntimeBehaviourSection />);
    expect(
      screen.getByRole("switch", { name: "Mid-run steering" }),
    ).toBeDisabled();
  });

  it("renders the managed note, not a switch, in external mode", () => {
    runtimeSettings.manageable = false;
    runtimeSettings.doc = null;
    render(<RuntimeBehaviourSection />);
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    runtimeSettings.live = false;
    runtimeSettings.doc = null;
    render(<RuntimeBehaviourSection />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("says it is reading while the document loads, and names a read failure", () => {
    runtimeSettings.doc = null;
    runtimeSettings.isLoading = true;
    const { unmount } = render(<RuntimeBehaviourSection />);
    expect(
      screen.getByText(/Reading the daemon's runtime settings/),
    ).toBeInTheDocument();
    unmount();

    runtimeSettings.isLoading = false;
    runtimeSettings.error = "controller unreachable";
    render(<RuntimeBehaviourSection />);
    expect(screen.getByText("controller unreachable")).toBeInTheDocument();
  });
});

describe("steerRowDescription", () => {
  it("appends the live capability only when the daemon reports a boolean", () => {
    expect(steerRowDescription(undefined)).not.toMatch(/currently reports/);
    expect(steerRowDescription(true)).toMatch(/reports steering on\.$/);
    expect(steerRowDescription(false)).toMatch(/reports steering off\.$/);
    expect(steerRowDescription("yes")).not.toMatch(/currently reports/);
  });
});
