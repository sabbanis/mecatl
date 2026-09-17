import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "@/test/memory-storage";
import LabsSettingsPage from "./page";

/**
 * Labs hosts the two browser-local opt-ins: the mock feature tour and the
 * developer tools (the `/debug-ask` fake ask + the steer trace). Both write
 * the keys the chat reads, default OFF. The runtime provider is mocked: the
 * mock-tour switch-back coupling needs it, the developer switch never does.
 */

const MOCK_FEATURES_KEY = "mecatl-studio.mock-features";
const DEVELOPER_TOOLS_KEY = "mecatl-studio.developer-tools";

const switchProvider = vi.fn(async () => undefined);

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => ({
    mode: "external",
    isMock: false,
    configuredProviders: [],
    switchProvider,
  }),
}));

describe("LabsSettingsPage — developer tools", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    switchProvider.mockClear();
  });

  it("offers Developer tools off by default and stores the preference via the switch", async () => {
    render(<LabsSettingsPage />);
    const toggle = screen.getByRole("switch", { name: "Developer tools" });
    expect(toggle).not.toBeChecked();
    expect(window.localStorage.getItem(DEVELOPER_TOOLS_KEY)).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(window.localStorage.getItem(DEVELOPER_TOOLS_KEY)).toBe("1");

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(window.localStorage.getItem(DEVELOPER_TOOLS_KEY)).toBeNull();
    // The developer switch is a pure browser preference: no daemon call.
    expect(switchProvider).not.toHaveBeenCalled();
  });

  it("hydrates a stored Developer tools preference as on", async () => {
    window.localStorage.setItem(DEVELOPER_TOOLS_KEY, "1");
    render(<LabsSettingsPage />);
    expect(
      await screen.findByRole("switch", {
        name: "Developer tools",
        checked: true,
      }),
    ).toBeInTheDocument();
  });

  it("says what the tools add, and keeps the mock-features switch independent", async () => {
    render(<LabsSettingsPage />);
    expect(screen.getByText(/\/debug-ask command/)).toBeInTheDocument();
    expect(screen.getByText(/never sent to the daemon/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("switch", { name: "Developer tools" }),
    );
    expect(window.localStorage.getItem(MOCK_FEATURES_KEY)).toBeNull();
    expect(
      screen.getByRole("switch", { name: "Show mock features" }),
    ).not.toBeChecked();
  });
});
