import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type { HarnessTrustState } from "@/lib/harness/client";
import {
  effectivePostureNote,
  PermissionsSection,
  POSTURE_OPTIONS,
} from "./permissions-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The Permissions page: the daemon-wide posture ladder ("Safety level"),
 * project trust and shell-less mode, in plain words. Pins that (1) every
 * tier is named with one plain sentence inside the picker and the row
 * repeats only the selected one, (2) Save stays disabled until the draft
 * differs and calls the controller with exactly the three flags, (3) an
 * allow-all tier (auto/yolo) confirms with the ADR-0022 warning before any
 * write, (4) the reported tier is CAPABILITY-GATED on the daemon's
 * `capabilities.posture` — a badge only where there is no picker, one plain
 * line under the picker when it differs from the saved tier — and (5)
 * external mode renders the managed note with no form. (6) The card never
 * shows a developer word: daemon, controller, flags, session ids.
 */

/** Words the product owner ruled out of this card's copy. */
const JARGON =
  /daemon|mecated|controller|--[a-z]|AGENTS\.md|soul|catalog|session id|in-flight|allow rule|substitution|subagent|posture/i;

const runtimeStatus = {
  connected: true,
  mode: "managed" as "managed" | "external",
  serverCapabilities: {} as Record<string, unknown>,
  // The controller's own project-trust decision (`/status.trust`); null
  // against an older controller, so the row stays capability-gated on it.
  trust: null as HarnessTrustState | null,
  refresh: vi.fn(async () => {}),
};

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtimeStatus,
}));

const savePermissions = vi.fn(async () => {});

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    live: true,
    mode: "managed",
    status: null,
    permissions: {
      config: {
        posture: "strict",
        trustProject: false,
        noShell: false,
        trustOnce: false,
      },
      operatorSettings: false,
    },
    models: [],
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    refresh: vi.fn(async () => {}),
    connectGateway: vi.fn(async () => {}),
    connectGatewayOAuth: vi.fn(async () => {}),
    savePermissions,
    saveStorage: vi.fn(async () => {}),
    saveRetention: vi.fn(async () => {}),
    trustProject: vi.fn(async () => {}),
    trustProjectOnce: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  savePermissions.mockClear();
  runtimeStatus.refresh.mockClear();
  runtimeStatus.mode = "managed";
  runtimeStatus.serverCapabilities = {};
  runtimeStatus.trust = null;
});

describe("PermissionsSection", () => {
  it("names all four levels with one plain sentence each inside the picker, and the row repeats only the saved one", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(POSTURE_OPTIONS.map((option) => option.value)).toEqual([
      "strict",
      "trusted",
      "auto",
      "yolo",
    ]);
    // The row explains the SELECTED level only; the old legend is gone.
    expect(screen.getByText("Asks before every change.")).toBeInTheDocument();
    expect(
      screen.queryByText("No safeguards. Only on a throwaway machine."),
    ).toBeNull();
    const picker = screen.getByRole("button", { name: "Safety level" });
    expect(picker).toHaveTextContent("Strict");
    // Every level is explained where the person picks it.
    await user.click(picker);
    for (const option of POSTURE_OPTIONS) {
      const item = await screen.findByRole("menuitem", {
        name: new RegExp(`^${option.label}`),
      });
      expect(item).toHaveTextContent(option.description);
    }
  });

  it("uses no developer vocabulary anywhere on the managed card, including the warning and the restart note", async () => {
    const user = userEvent.setup();
    runtimeStatus.serverCapabilities = { posture: "trusted" };
    runtimeStatus.trust = {
      hasAuthority: true,
      decision: "drifted",
      source: "studio",
      anchor: "a".repeat(64),
    };
    const { container } = render(
      <PermissionsSection
        runtime={fakeRuntime({
          permissions: {
            config: {
              posture: "strict",
              trustProject: true,
              noShell: false,
              trustOnce: false,
            },
            operatorSettings: true,
          },
        })}
      />,
    );
    expect(container.textContent).not.toMatch(JARGON);
    await user.click(screen.getByRole("button", { name: "Safety level" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Yolo/ }));
    expect(container.textContent).not.toMatch(JARGON);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).not.toMatch(JARGON);
  });

  it("keeps Save disabled until the draft differs, then sends exactly the three flags", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const shell = screen.getByRole("switch", { name: "Shell tool" });
    expect(shell).toBeChecked();
    expect(
      screen.getByText("Let the agent run terminal commands."),
    ).toBeInTheDocument();
    await user.click(shell);
    expect(shell).not.toBeChecked();
    expect(save).toBeEnabled();

    await user.click(save);
    // No allow-all tier involved → no confirmation dialog, straight to the write.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "strict",
      trustProject: false,
      noShell: true,
    });
  });

  it("toggling back to the saved values disables Save again", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    const trust = screen.getByRole("switch", { name: "Trust this project" });
    await user.click(trust);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(trust);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("requires the ADR-0022 confirmation before saving yolo, and cancels cleanly", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    await user.click(screen.getByRole("button", { name: "Safety level" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Yolo/ }));
    expect(
      screen.getByRole("button", { name: "Safety level" }),
    ).toHaveTextContent("Yolo");
    // The in-form warning appears as soon as an allow-all tier is drafted.
    expect(screen.getByRole("note")).toHaveTextContent(/throwaway machine/);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switch to Yolo\?/);
    expect(dialog).toHaveTextContent(/removes every safeguard/);
    expect(savePermissions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(savePermissions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Switch to Yolo" }),
    );
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "yolo",
      trustProject: false,
      noShell: false,
    });
  });

  it("confirms auto too, without the yolo-only no-safeguards warning", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    await user.click(screen.getByRole("button", { name: "Safety level" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Auto/ }));
    expect(screen.getByRole("note")).toHaveTextContent(/without asking/);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switch to Auto\?/);
    expect(dialog).toHaveTextContent(/without asking/);
    expect(dialog).not.toHaveTextContent(/removes every safeguard/);
  });

  it("shows the trust switch checked and disabled once the level implies trust", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    const trust = screen.getByRole("switch", { name: "Trust this project" });
    expect(trust).not.toBeChecked();
    expect(trust).toBeEnabled();
    expect(
      screen.getByText("Let this project's own instructions guide the agent."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Safety level" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Trusted/ }));
    expect(trust).toBeChecked();
    expect(trust).toBeDisabled();
    expect(
      screen.getByText("Included in the Trusted level and above."),
    ).toBeInTheDocument();
    // Saving keeps the user's own switch value: the posture carries the trust.
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "trusted",
      trustProject: false,
      noShell: false,
    });
  });

  it("shows no reported-level badge or note in the managed form when saved and reported agree", () => {
    runtimeStatus.serverCapabilities = { posture: "strict" };
    render(<PermissionsSection runtime={fakeRuntime()} />);
    // One "Safety level" row — the picker's — and no badge row beside it.
    expect(screen.getAllByText("Safety level")).toHaveLength(1);
    expect(
      screen.queryByText("What the agent is running at right now."),
    ).toBeNull();
    expect(screen.queryByText(/Right now the agent is running/)).toBeNull();
  });

  it("explains a reported level that differs from the saved one in one plain line (Studio's own trust raise)", () => {
    runtimeStatus.serverCapabilities = { posture: "trusted" };
    render(
      <PermissionsSection
        runtime={fakeRuntime({
          permissions: {
            config: {
              posture: "strict",
              trustProject: true,
              noShell: false,
              trustOnce: false,
            },
            operatorSettings: false,
          },
        })}
      />,
    );
    expect(
      screen.getByText(
        "Right now the agent is running at Trusted because this project is trusted.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("What the agent is running at right now."),
    ).toBeNull();
  });

  it("says nothing about the reported level when the daemon does not report one (capability gate)", () => {
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.queryByText(/Right now the agent is running/)).toBeNull();
    expect(
      screen.queryByText("What the agent is running at right now."),
    ).toBeNull();
  });

  it("tells the user this setting takes priority over a separate settings file", () => {
    render(
      <PermissionsSection
        runtime={fakeRuntime({
          permissions: {
            config: {
              posture: "strict",
              trustProject: false,
              noShell: false,
              trustOnce: false,
            },
            operatorSettings: true,
          },
        })}
      />,
    );
    expect(screen.getByText(/takes priority over it/)).toBeInTheDocument();
  });

  it("renders the managed note and no form in external mode (the reported level still shows)", () => {
    runtimeStatus.mode = "external";
    runtimeStatus.serverCapabilities = { posture: "auto" };
    render(
      <PermissionsSection
        runtime={fakeRuntime({ mode: "external", permissions: null })}
      />,
    );
    expect(
      screen.getByText(/The agent is run somewhere else/),
    ).toBeInTheDocument();
    expect(screen.getByText("Safety level")).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(
      screen.getByText("What the agent is running at right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(<PermissionsSection runtime={fakeRuntime({ live: false })} />);
    expect(
      screen.getByText(/The agent is offline, so these settings/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("reports a controller that did not answer /permissions instead of inventing defaults", () => {
    render(<PermissionsSection runtime={fakeRuntime({ permissions: null })} />);
    expect(
      screen.getByText(/could not read these settings/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});

describe("effectivePostureNote", () => {
  const base = { trustProject: false, trustOnce: false };

  it("is silent when saved and effective agree", () => {
    for (const posture of ["strict", "trusted", "auto", "yolo"]) {
      expect(
        effectivePostureNote({ ...base, saved: posture, effective: posture }),
      ).toBeNull();
    }
  });

  it("attributes strict→trusted to Studio's own trust flag, naming trust-once when that is the cause", () => {
    expect(
      effectivePostureNote({
        saved: "strict",
        effective: "trusted",
        trustProject: true,
        trustOnce: false,
      }),
    ).toBe(
      "Right now the agent is running at Trusted because this project is trusted.",
    );
    expect(
      effectivePostureNote({
        saved: "strict",
        effective: "trusted",
        trustProject: false,
        trustOnce: true,
      }),
    ).toMatch(/trusted until Studio restarts/);
  });

  it("does not blame trust when no trust flag was passed", () => {
    expect(
      effectivePostureNote({ ...base, saved: "strict", effective: "trusted" }),
    ).toMatch(/above the saved Strict/);
  });

  it("explains a lower effective tier as a restart still in flight", () => {
    expect(
      effectivePostureNote({ ...base, saved: "yolo", effective: "strict" }),
    ).toMatch(/below the saved Yolo/);
  });

  it("never uses a developer word", () => {
    for (const [saved, effective] of [
      ["strict", "trusted"],
      ["strict", "yolo"],
      ["yolo", "strict"],
    ]) {
      expect(
        effectivePostureNote({ ...base, saved, effective, trustOnce: true }),
      ).not.toMatch(JARGON);
    }
  });
});

/**
 * The "Project trust" row: the controller's resolved decision for the
 * current spawn in plain words (mecatui's trust states), "Forget trust" for
 * a remembered grant, and "Trust again" for a drifted one — the explicit
 * grant route, because a plain save with the switch already on never
 * re-stamps the anchor. Gated on the controller reporting `/status.trust`
 * at all.
 */
describe("PermissionsSection project trust row", () => {
  const _untrusted: HarnessTrustState = {
    hasAuthority: true,
    decision: "untrusted",
    source: "none",
    anchor: "a".repeat(64),
  };
  const _trustedRuntime = () =>
    fakeRuntime({
      permissions: {
        config: {
          posture: "strict",
          trustProject: true,
          noShell: false,
          trustOnce: false,
        },
        operatorSettings: false,
      },
    });

  it("is absent when the controller reports no trust decision (older controller)", () => {
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.queryByText("Project trust")).toBeNull();
  });
});
