import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessRuntimeSettingsDoc } from "@/lib/harness/runtime-settings";
import {
  currentLearning,
  LearningModeSection,
  learningChangeReport,
  learningSourceHint,
  learningValueSource,
} from "./learning-mode-section";

/**
 * Settings → Learning → Learning mode: the web form of the TUI's `/learning`
 * + `/learning-sensitivity`. Pins that (1) the two selects show the
 * EFFECTIVE values (what mecated runs with), each row naming where its value
 * comes from; (2) picking a new value renders the TUI's from → to report and
 * the restart notice and enables Save, which saves nothing until the confirm
 * — the confirm calls `save` with BOTH values; Cancel and Discard save
 * nothing; (3) an imported operator settings file renders the values
 * read-only with the edit-that-file note; (4) external mode renders the
 * managed note plus the remote-refusal wording and offline the offline note,
 * neither with a control; (5) busy disables Save; error and notice render.
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

vi.mock("@/features/agent/hooks/use-runtime-settings", () => ({
  useRuntimeSettings: () => runtimeSettings,
}));

const doc = (
  overrides: Partial<{
    studioMode: "" | "off" | "review" | "auto";
    studioSensitivity: "" | "conservative" | "balanced" | "eager";
    inheritedMode: string;
    inheritedSensitivity: string;
    effectiveMode: string;
    effectiveSensitivity: string;
    managedBy: "studio" | "operator-settings";
  }> = {},
): HarnessRuntimeSettingsDoc => ({
  config: {
    learning: {
      mode: overrides.studioMode ?? "",
      sensitivity: overrides.studioSensitivity ?? "",
    },
    steer: { enabled: true },
    soul: { enabled: true, strict: false, file: "" },
  },
  managedBy: {
    learning: overrides.managedBy ?? "studio",
    steer: "studio",
    soul: "studio",
  },
  inherited: {
    learning: {
      mode: overrides.inheritedMode ?? "",
      sensitivity: overrides.inheritedSensitivity ?? "",
    },
    steer: null,
  },
  effective: {
    learning: {
      mode: overrides.effectiveMode ?? "off",
      sensitivity: overrides.effectiveSensitivity ?? "balanced",
    },
    steer: true,
  },
  soulFileDefault: "/home/me/.config/mecatl/soul.md",
  soulCandidates: [],
});

const modeTrigger = () => screen.getByRole("button", { name: "Learning mode" });
const sensitivityTrigger = () =>
  screen.getByRole("button", { name: "Sensitivity" });
const saveButton = () =>
  screen.getByRole("button", { name: "Save and restart" });

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  label: RegExp,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", { name: label }));
}

beforeEach(() => {
  runtimeSettings.live = true;
  runtimeSettings.manageable = true;
  runtimeSettings.doc = doc();
  runtimeSettings.isLoading = false;
  runtimeSettings.busy = "";
  runtimeSettings.error = null;
  runtimeSettings.notice = null;
  runtimeSettings.save.mockClear();
});

describe("LearningModeSection", () => {
  it("shows the effective mode and sensitivity, names their source, and keeps Save disabled", () => {
    runtimeSettings.doc = doc({
      effectiveMode: "review",
      effectiveSensitivity: "eager",
      inheritedMode: "review",
    });
    render(<LearningModeSection />);
    expect(modeTrigger()).toHaveTextContent("Review");
    expect(sensitivityTrigger()).toHaveTextContent("Eager");
    // The mode comes from the operator's own file, the sensitivity from
    // nowhere — the daemon default.
    expect(
      screen.getByText(/From your settings\.yaml \(learning\.mode\)\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Daemon default — nothing sets it yet\./),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("learning-pending")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
  });

  it("reports from → to on a pending change and saves both values only after the confirm", async () => {
    const user = userEvent.setup();
    render(<LearningModeSection />);
    expect(modeTrigger()).toHaveTextContent("Off");

    await user.click(modeTrigger());
    for (const label of ["Off", "Review", "Auto"]) {
      expect(
        await screen.findByRole("menuitem", { name: new RegExp(`^${label}`) }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole("menuitem", { name: /^Review/ }));

    expect(modeTrigger()).toHaveTextContent("Review");
    const pending = screen.getByTestId("learning-pending");
    expect(pending).toHaveTextContent(
      "Off (sensitivity Balanced) → Review (sensitivity Balanced)",
    );
    expect(pending).toHaveTextContent(/Restart required/);
    expect(saveButton()).toBeEnabled();
    expect(runtimeSettings.save).not.toHaveBeenCalled();

    await user.click(saveButton());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Change learning settings and restart the daemon?",
    );
    expect(dialog).toHaveTextContent(
      "Off (sensitivity Balanced) → Review (sensitivity Balanced)",
    );
    expect(runtimeSettings.save).not.toHaveBeenCalled();

    await user.click(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
        dialog,
    );
    expect(runtimeSettings.save).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      learning: { mode: "review", sensitivity: "balanced" },
    });
  });

  it("carries a changed sensitivity together with the (unchanged) mode", async () => {
    const user = userEvent.setup();
    runtimeSettings.doc = doc({ effectiveMode: "auto" });
    render(<LearningModeSection />);
    await pick(user, sensitivityTrigger(), /^Eager/);
    expect(screen.getByTestId("learning-pending")).toHaveTextContent(
      "Auto (sensitivity Balanced) → Auto (sensitivity Eager)",
    );
    await user.click(saveButton());
    await screen.findByRole("alertdialog");
    await user.click(
      screen.getAllByRole("button", { name: "Save and restart" }).at(-1) ??
        document.body,
    );
    expect(runtimeSettings.save).toHaveBeenCalledWith({
      learning: { mode: "auto", sensitivity: "eager" },
    });
  });

  it("saves nothing on Cancel, and Discard returns to the effective values", async () => {
    const user = userEvent.setup();
    render(<LearningModeSection />);
    await pick(user, modeTrigger(), /^Auto/);
    await user.click(saveButton());
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(runtimeSettings.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    // The draft survives the cancel...
    expect(modeTrigger()).toHaveTextContent("Auto");
    // ...until Discard drops it.
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(modeTrigger()).toHaveTextContent("Off");
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("learning-pending")).not.toBeInTheDocument();
  });

  it("treats picking the current value again as no change", async () => {
    const user = userEvent.setup();
    render(<LearningModeSection />);
    await pick(user, modeTrigger(), /^Review/);
    expect(saveButton()).toBeEnabled();
    await pick(user, modeTrigger(), /^Off/);
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("learning-pending")).not.toBeInTheDocument();
  });

  it("renders the values read-only with the operator note when an imported settings file owns learning", () => {
    runtimeSettings.doc = doc({
      managedBy: "operator-settings",
      effectiveMode: "review",
      effectiveSensitivity: "conservative",
    });
    render(<LearningModeSection />);
    expect(
      screen.queryByRole("button", { name: "Learning mode" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save and restart" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(
      screen.getByText(/managed by the imported operator settings file/),
    ).toBeInTheDocument();
    expect(screen.getByText("learning:")).toBeInTheDocument();
  });

  it("renders the managed note plus the remote wording, and no control, in external mode", () => {
    runtimeSettings.manageable = false;
    runtimeSettings.doc = null;
    render(<LearningModeSection />);
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/settings\.yaml and restart that server\./),
    ).toBeInTheDocument();
    expect(screen.getByText("learning.mode")).toBeInTheDocument();
    expect(screen.getByText("learning.sensitivity")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Learning mode" }),
    ).not.toBeInTheDocument();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    runtimeSettings.live = false;
    runtimeSettings.doc = null;
    render(<LearningModeSection />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Learning mode" }),
    ).not.toBeInTheDocument();
  });

  it("says it is reading while the document loads, and names a read failure", () => {
    runtimeSettings.doc = null;
    runtimeSettings.isLoading = true;
    const { unmount } = render(<LearningModeSection />);
    expect(
      screen.getByText(/Reading the daemon's runtime settings/),
    ).toBeInTheDocument();
    unmount();

    runtimeSettings.isLoading = false;
    runtimeSettings.error = "controller unreachable";
    render(<LearningModeSection />);
    expect(screen.getByText("controller unreachable")).toBeInTheDocument();
  });

  it("disables Save while a save is in flight", async () => {
    const user = userEvent.setup();
    runtimeSettings.busy = "save";
    render(<LearningModeSection />);
    await pick(user, modeTrigger(), /^Review/);
    expect(screen.getByTestId("learning-pending")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("surfaces the hook's error and completion notice", () => {
    runtimeSettings.doc = doc({
      studioMode: "review",
      effectiveMode: "review",
    });
    runtimeSettings.error = "mecated refused to start";
    runtimeSettings.notice =
      "Saved. The daemon restarted with the new settings.";
    render(<LearningModeSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "mecated refused to start",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /The daemon restarted/,
    );
    expect(screen.getByText(/Set by Studio\./)).toBeInTheDocument();
  });
});

describe("learning helpers", () => {
  it("formats the TUI's from → to report", () => {
    expect(
      learningChangeReport(
        { mode: "off", sensitivity: "balanced" },
        { mode: "review", sensitivity: "eager" },
      ),
    ).toBe("Off (sensitivity Balanced) → Review (sensitivity Eager)");
  });

  it("resolves the value source: Studio's file first, then settings.yaml, then the default", () => {
    expect(learningValueSource("review", "auto")).toBe("studio");
    expect(learningValueSource("", "auto")).toBe("settings.yaml");
    expect(learningValueSource("", "")).toBe("default");
    expect(learningSourceHint("learning.sensitivity", "settings.yaml")).toBe(
      "From your settings.yaml (learning.sensitivity).",
    );
  });

  it("falls back to the daemon defaults for an unknown effective value", () => {
    expect(
      currentLearning(
        doc({ effectiveMode: "weird", effectiveSensitivity: "" }),
      ),
    ).toEqual({ mode: "off", sensitivity: "balanced" });
  });
});
