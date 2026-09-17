import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessRuntimeSettingsDoc } from "@/lib/harness/runtime-settings";
import LearningSettingsPage from "./page";

/**
 * Settings → Learning as a page: the Learning mode card (the web form of
 * `/learning` + `/learning-sensitivity`) renders FIRST whatever the daemon
 * advertises, so the page is never a dead end when learning is off — the
 * "not enabled" note sits BELOW the control that turns it on, and once the
 * daemon reports proposals the note yields to the review queue.
 */

const runtimeStatus = vi.hoisted(() => ({
  connected: true,
  mode: "managed" as "managed" | "external",
  serverCapabilities: {} as Record<string, unknown>,
  refresh: vi.fn(async () => undefined),
}));

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

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtimeStatus,
}));

vi.mock("@/features/agent/hooks/use-runtime-settings", () => ({
  useRuntimeSettings: () => runtimeSettings,
}));

vi.mock("@/lib/harness/learning", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/harness/learning")>()),
  listLearningProposals: vi.fn(async () => ({
    proposals: [],
    nextCursor: "",
  })),
}));

const doc = (): HarnessRuntimeSettingsDoc => ({
  config: {
    learning: { mode: "", sensitivity: "" },
    steer: { enabled: true },
    soul: { enabled: true, strict: false, file: "" },
  },
  managedBy: { learning: "studio", steer: "studio", soul: "studio" },
  inherited: { learning: { mode: "", sensitivity: "" }, steer: null },
  effective: {
    learning: { mode: "off", sensitivity: "balanced" },
    steer: true,
  },
  soulFileDefault: "/home/me/.config/mecatl/soul.md",
  soulCandidates: [],
});

/** True when `first` precedes `second` in document order. */
const precedes = (first: HTMLElement, second: HTMLElement) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !==
  0;

beforeEach(() => {
  runtimeStatus.connected = true;
  runtimeStatus.mode = "managed";
  runtimeStatus.serverCapabilities = {};
  runtimeSettings.live = true;
  runtimeSettings.manageable = true;
  runtimeSettings.doc = doc();
});

describe("LearningSettingsPage", () => {
  it("renders the Learning mode card above the not-enabled note when the daemon advertises neither capability", () => {
    render(<LearningSettingsPage />);
    const modeControl = screen.getByRole("button", { name: "Learning mode" });
    const note = screen.getByRole("heading", {
      name: "Learning is not enabled on this daemon",
    });
    expect(modeControl).toBeInTheDocument();
    expect(precedes(modeControl, note)).toBe(true);
    expect(
      screen.getByText(/Turn learning on above \(managed mode\)/),
    ).toBeInTheDocument();
    // The downstream cards wait for the capabilities.
    expect(
      screen.queryByRole("heading", { name: "Review queue" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the Learning mode card first and drops the note once proposals are advertised", async () => {
    runtimeStatus.serverCapabilities = { learning_proposals: true };
    render(<LearningSettingsPage />);
    const modeControl = screen.getByRole("button", { name: "Learning mode" });
    const queue = await screen.findByRole("heading", { name: "Review queue" });
    expect(precedes(modeControl, queue)).toBe(true);
    expect(
      screen.queryByRole("heading", {
        name: "Learning is not enabled on this daemon",
      }),
    ).not.toBeInTheDocument();
  });

  it("still offers the mode card in external mode, as the managed note", () => {
    runtimeStatus.mode = "external";
    runtimeSettings.manageable = false;
    runtimeSettings.doc = null;
    render(<LearningSettingsPage />);
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Learning is not enabled on this daemon",
      }),
    ).toBeInTheDocument();
  });
});
