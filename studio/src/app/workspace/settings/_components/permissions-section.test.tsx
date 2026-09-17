import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type { HarnessTrustState } from "@/lib/harness/client";
import {
  effectivePostureNote,
  PermissionsSection,
  POSTURE_OPTIONS,
  trustRowLabel,
} from "./permissions-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The Permissions page: the daemon-wide posture ladder, project trust and
 * shell-less mode. Pins that (1) every tier is named with its consequence,
 * (2) Save stays disabled until the draft differs and calls the controller
 * with exactly the three flags, (3) an allow-all tier (auto/yolo) confirms
 * with the ADR-0022 warning before any write, (4) the Effective-posture row
 * is CAPABILITY-GATED on the daemon's `capabilities.posture` and explains a
 * saved≠effective difference from Studio's own trust flag, and (5) external
 * mode renders the managed note with no form.
 */

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
    router: null,
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
    saveRouter: vi.fn(async () => {}),
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
  it("names all four postures with their consequences and shows the saved one", () => {
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(POSTURE_OPTIONS.map((option) => option.value)).toEqual([
      "strict",
      "trusted",
      "auto",
      "yolo",
    ]);
    // Each tier appears in the ladder legend (the selected one ALSO in the
    // picker trigger and the row description, hence getAll).
    for (const option of POSTURE_OPTIONS) {
      expect(screen.getAllByText(option.label).length).toBeGreaterThan(0);
      expect(screen.getAllByText(option.description).length).toBeGreaterThan(0);
    }
    expect(
      screen.getAllByText(/Ask before every file change and shell command/),
    ).not.toHaveLength(0);
    expect(
      screen.getByText(/subagent shell substitutions/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Operator posture" }),
    ).toHaveTextContent("Strict");
    // The page says what it is NOT: the per-session Mode selector.
    expect(
      screen.getByText(/Mode selector in the composer/),
    ).toBeInTheDocument();
  });

  it("keeps Save disabled until the draft differs, then sends exactly the three flags", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const shell = screen.getByRole("switch", { name: "Shell tool" });
    expect(shell).toBeChecked();
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
    await user.click(screen.getByRole("button", { name: "Operator posture" }));
    await user.click(await screen.findByRole("menuitem", { name: "Yolo" }));
    expect(
      screen.getByRole("button", { name: "Operator posture" }),
    ).toHaveTextContent("Yolo");
    // The in-form warning appears as soon as an allow-all tier is drafted.
    expect(screen.getByRole("note")).toHaveTextContent(
      /Isolated, disposable machines only/,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switch to the yolo posture\?/);
    expect(dialog).toHaveTextContent(/prompt-injection defence is off/);
    expect(dialog).toHaveTextContent(/refuses this posture as root/);
    expect(savePermissions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(savePermissions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Switch to yolo" }),
    );
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "yolo",
      trustProject: false,
      noShell: false,
    });
  });

  it("confirms auto too, without the yolo-only substitution warning", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    await user.click(screen.getByRole("button", { name: "Operator posture" }));
    await user.click(await screen.findByRole("menuitem", { name: "Auto" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switch to the auto posture\?/);
    expect(dialog).not.toHaveTextContent(/prompt-injection defence is off/);
  });

  it("shows the trust switch checked and disabled once the posture implies trust", async () => {
    const user = userEvent.setup();
    render(<PermissionsSection runtime={fakeRuntime()} />);
    const trust = screen.getByRole("switch", { name: "Trust this project" });
    expect(trust).not.toBeChecked();
    expect(trust).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Operator posture" }));
    await user.click(await screen.findByRole("menuitem", { name: "Trusted" }));
    expect(trust).toBeChecked();
    expect(trust).toBeDisabled();
    expect(
      screen.getByText(/Implied by the trusted posture/),
    ).toBeInTheDocument();
    // Saving keeps the user's own switch value: the posture carries the trust.
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "trusted",
      trustProject: false,
      noShell: false,
    });
  });

  it("hides the Effective posture row when the daemon does not report one (capability gate)", () => {
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.queryByText("Effective posture")).not.toBeInTheDocument();
  });

  it("shows the Effective posture row from capabilities.posture and explains Studio's own trust raise", () => {
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
    expect(screen.getByText("Effective posture")).toBeInTheDocument();
    expect(screen.getByText("trusted")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Trusting this project raises the effective posture to trusted.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing extra when saved and effective agree", () => {
    runtimeStatus.serverCapabilities = { posture: "strict" };
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.getByText("Effective posture")).toBeInTheDocument();
    expect(screen.queryByText(/The daemon reports/)).not.toBeInTheDocument();
    expect(screen.queryByText(/raises the effective posture/)).toBeNull();
  });

  it("tells the user Studio's flag out-ranks an imported settings file's posture key", () => {
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
    expect(screen.getByText(/overrides that file.s/)).toBeInTheDocument();
  });

  it("renders the managed note and no form in external mode (the effective badge still shows)", () => {
    runtimeStatus.mode = "external";
    runtimeStatus.serverCapabilities = { posture: "auto" };
    render(
      <PermissionsSection
        runtime={fakeRuntime({ mode: "external", permissions: null })}
      />,
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.getByText("auto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(<PermissionsSection runtime={fakeRuntime({ live: false })} />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("reports a controller that did not answer /permissions instead of inventing defaults", () => {
    render(<PermissionsSection runtime={fakeRuntime({ permissions: null })} />);
    expect(
      screen.getByText(/controller did not report its permissions/),
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
    ).toBe("Trusting this project raises the effective posture to trusted.");
    expect(
      effectivePostureNote({
        saved: "strict",
        effective: "trusted",
        trustProject: false,
        trustOnce: true,
      }),
    ).toMatch(/for this controller session/);
  });

  it("does not blame trust when no trust flag was passed", () => {
    expect(
      effectivePostureNote({ ...base, saved: "strict", effective: "trusted" }),
    ).toMatch(/above the saved strict/);
  });

  it("explains a lower effective tier as a restart still in flight", () => {
    expect(
      effectivePostureNote({ ...base, saved: "yolo", effective: "strict" }),
    ).toMatch(/below the saved yolo/);
  });
});

/**
 * The "Project trust" row: the controller's resolved decision for the
 * current spawn as words (mecatui's trust states), "Forget trust" for a
 * remembered grant, and "Trust again" for a drifted one — the explicit grant
 * route, because a plain save with the switch already on never re-stamps the
 * anchor. Gated on the controller reporting `/status.trust` at all.
 */
describe("PermissionsSection project trust row", () => {
  const untrusted: HarnessTrustState = {
    hasAuthority: true,
    decision: "untrusted",
    source: "none",
    anchor: "a".repeat(64),
  };
  const trustedRuntime = () =>
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

  it("names every decision", () => {
    expect(trustRowLabel(untrusted)).toBe("Untrusted");
    expect(trustRowLabel({ ...untrusted, decision: "drifted" })).toBe(
      "Untrusted — instructions changed",
    );
    expect(
      trustRowLabel({ ...untrusted, decision: "once", source: "studio" }),
    ).toBe("Trusted for this session");
    expect(
      trustRowLabel({ ...untrusted, decision: "trusted", source: "studio" }),
    ).toBe("Trusted (remembered)");
    expect(
      trustRowLabel({ ...untrusted, decision: "trusted", source: "posture" }),
    ).toBe("Trusted (by the posture)");
  });

  it("is absent when the controller reports no trust decision (older controller)", () => {
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.queryByText("Project trust")).toBeNull();
  });

  it("shows Untrusted with the withheld-instructions explanation and the residual, and no buttons", () => {
    runtimeStatus.trust = untrusted;
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(screen.getByText("Project trust")).toBeInTheDocument();
    expect(screen.getByText("Untrusted")).toBeInTheDocument();
    expect(
      screen.getByText(/Mecatl withholds until you trust it/),
    ).toBeInTheDocument();
    expect(screen.getByText(/not visible here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forget trust" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trust again" })).toBeNull();
  });

  it("says when the project ships nothing a grant would admit", () => {
    runtimeStatus.trust = { ...untrusted, hasAuthority: false };
    render(<PermissionsSection runtime={fakeRuntime()} />);
    expect(
      screen.getByText(/ships no instructions a grant would admit/),
    ).toBeInTheDocument();
  });

  it("Forget trust saves the document with the switch off and keeps the other flags", async () => {
    const user = userEvent.setup();
    runtimeStatus.trust = {
      ...untrusted,
      decision: "trusted",
      source: "studio",
    };
    const runtime = trustedRuntime();
    render(<PermissionsSection runtime={runtime} />);
    expect(screen.getByText("Trusted (remembered)")).toBeInTheDocument();
    expect(screen.getByText(/re-checks the project/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Forget trust" }));
    expect(savePermissions).toHaveBeenCalledWith({
      posture: "strict",
      trustProject: false,
      noShell: false,
    });
    expect(runtime.trustProject).not.toHaveBeenCalled();
  });

  it("Trust again on a drifted grant calls the hook's explicit grant (not the generic write), then re-reads the status", async () => {
    const user = userEvent.setup();
    runtimeStatus.trust = { ...untrusted, decision: "drifted" };
    const runtime = trustedRuntime();
    render(<PermissionsSection runtime={runtime} />);
    expect(
      screen.getByText("Untrusted — instructions changed"),
    ).toBeInTheDocument();
    expect(screen.getByText(/started without the grant/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trust again" }));
    await waitFor(() => expect(runtime.trustProject).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(runtimeStatus.refresh).toHaveBeenCalled());
    // Not the generic write: that would carry the stale anchor forward.
    expect(savePermissions).not.toHaveBeenCalled();
    expect(runtime.trustProjectOnce).not.toHaveBeenCalled();
  });

  it("disables both trust buttons while the hook's trust write is in flight", () => {
    runtimeStatus.trust = { ...untrusted, decision: "drifted" };
    render(<PermissionsSection runtime={trustedRuntime()} />);
    expect(screen.getByRole("button", { name: "Trust again" })).toBeEnabled();
    render(
      <PermissionsSection runtime={{ ...trustedRuntime(), busy: "trust" }} />,
    );
    expect(screen.getByRole("button", { name: "Trusting…" })).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Forget trust" }).at(-1),
    ).toBeDisabled();
  });

  it("reads the posture floor and the session grant as trusted", () => {
    runtimeStatus.trust = {
      ...untrusted,
      decision: "trusted",
      source: "posture",
    };
    render(
      <PermissionsSection
        runtime={fakeRuntime({
          permissions: {
            config: {
              posture: "auto",
              trustProject: false,
              noShell: false,
              trustOnce: false,
            },
            operatorSettings: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Trusted (by the posture)")).toBeInTheDocument();
    expect(
      screen.getByText(/auto posture trusts the project/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forget trust" })).toBeNull();
  });
});
