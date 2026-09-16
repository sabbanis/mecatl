import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postureSummary } from "@/lib/posture";
import { POSTURE_DEFENSE_ROWS, PostureCard } from "./posture-card";

/**
 * The Diagnostics page's posture card: the TUI's `/posture` one-liner as a
 * card. Pins that (1) the tier badge and the four defense rows are bound to
 * the daemon-REPORTED `capabilities.posture` (auto: allow-all + main
 * substitution on, child substitution off, project trust on), (2) the
 * always-on Deny/Ask caveat and the byte-identical TUI sentence render
 * with a working Copy, (3) an empty/absent tier says "Not reported" rather
 * than guessing, (4) managed mode names the CONFIGURED tier and links to
 * the Permissions page (the one writer of `--posture`) while external mode
 * renders the managed note, and (5) offline renders the offline note.
 */

const runtimeStatus = {
  connected: true,
  mode: "managed" as "managed" | "external",
  serverCapabilities: {} as Record<string, unknown>,
  permissions: null as {
    posture: string;
    trustProject: boolean;
    noShell: boolean;
    trustOnce: boolean;
  } | null,
};

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtimeStatus,
}));

beforeEach(() => {
  runtimeStatus.connected = true;
  runtimeStatus.mode = "managed";
  runtimeStatus.serverCapabilities = {};
  runtimeStatus.permissions = null;
});

describe("PostureCard", () => {
  it("renders the reported tier and the four defense rows for auto", () => {
    runtimeStatus.serverCapabilities = { posture: "auto" };
    render(<PostureCard />);

    expect(screen.getByTestId("posture-tier")).toHaveTextContent("auto");
    expect(POSTURE_DEFENSE_ROWS.map((row) => row.key)).toEqual([
      "allowAll",
      "mainSubstitution",
      "childSubstitution",
      "projectTrust",
    ]);
    for (const row of POSTURE_DEFENSE_ROWS)
      expect(screen.getByText(row.label)).toBeInTheDocument();

    const state = (key: string) => screen.getByTestId(`posture-defense-${key}`);
    expect(state("allowAll")).toHaveTextContent("on");
    expect(state("mainSubstitution")).toHaveTextContent("on");
    expect(state("childSubstitution")).toHaveTextContent("off");
    expect(state("projectTrust")).toHaveTextContent("on");
    expect(state("childSubstitution")).toHaveAttribute("data-on", "false");

    expect(
      screen.getByText(/Deny rules and configured Ask rules always apply/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("posture-summary")).toHaveTextContent(
      postureSummary("auto"),
    );
    // What it is NOT: the composer's per-session Mode.
    expect(
      screen.getByText(/Mode selector in the composer/),
    ).toBeInTheDocument();
  });

  it("switches every defense on for yolo and off for strict", () => {
    runtimeStatus.serverCapabilities = { posture: "yolo" };
    const { unmount } = render(<PostureCard />);
    for (const row of POSTURE_DEFENSE_ROWS)
      expect(
        screen.getByTestId(`posture-defense-${row.key}`),
      ).toHaveTextContent("on");
    unmount();

    runtimeStatus.serverCapabilities = { posture: "strict" };
    render(<PostureCard />);
    for (const row of POSTURE_DEFENSE_ROWS)
      expect(
        screen.getByTestId(`posture-defense-${row.key}`),
      ).toHaveTextContent("off");
  });

  it("copies the TUI sentence to the clipboard", () => {
    runtimeStatus.serverCapabilities = { posture: "trusted" };
    const writeText = vi.fn(async () => {});
    // A plain DOM click: user-event's setup() installs its own clipboard
    // stub over navigator.clipboard, which would swallow this spy.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<PostureCard />);
    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith(postureSummary("trusted"));
  });

  it("says the tier is not reported when the daemon omits it, instead of guessing", () => {
    runtimeStatus.serverCapabilities = { posture: "" };
    const { unmount } = render(<PostureCard />);
    expect(screen.getByText("Not reported by this daemon")).toBeInTheDocument();
    expect(screen.queryByTestId("posture-tier")).toBeNull();
    expect(screen.queryByTestId("posture-defense-allowAll")).toBeNull();
    unmount();

    runtimeStatus.serverCapabilities = {};
    render(<PostureCard />);
    expect(screen.getByText("Not reported by this daemon")).toBeInTheDocument();
  });

  it("names the configured tier and links to Permissions in managed mode, flagging a difference", () => {
    runtimeStatus.serverCapabilities = { posture: "trusted" };
    runtimeStatus.permissions = {
      posture: "strict",
      trustProject: true,
      noShell: false,
      trustOnce: false,
    };
    render(<PostureCard />);
    const link = screen.getByRole("link", { name: "Change posture" });
    expect(link).toHaveAttribute("href", "/workspace/settings/permissions");
    // One footer paragraph carries the SAVED tier, the reported one when
    // they differ, and the link (the card description also says "as the
    // daemon reports it", so assert on the paragraph, not a bare regex).
    const footer = screen.getByText(/Configured on the Permissions page as/);
    expect(footer).toHaveTextContent(
      /as strict \(the daemon reports trusted\)/,
    );
    expect(footer).toContainElement(link);
    expect(
      screen.queryByText(/Managed by the external mecated deployment/),
    ).toBeNull();
  });

  it("renders the managed note and no link in external mode", () => {
    runtimeStatus.mode = "external";
    runtimeStatus.serverCapabilities = { posture: "trusted" };
    render(<PostureCard />);
    expect(screen.getByTestId("posture-tier")).toHaveTextContent("trusted");
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Change posture" })).toBeNull();
  });

  it("renders the offline note when the daemon is unreachable", () => {
    runtimeStatus.connected = false;
    runtimeStatus.serverCapabilities = { posture: "auto" };
    render(<PostureCard />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByTestId("posture-tier")).toBeNull();
  });
});
