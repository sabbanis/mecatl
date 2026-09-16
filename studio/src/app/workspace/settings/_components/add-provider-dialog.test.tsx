import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddProviderDialog } from "./add-provider-dialog";

/**
 * The custom-gateway branch of the Add dialog now WRITES the non-secret
 * definition through the controller (`providers add`) when it can: the
 * primary "Save definition" posts exactly the normalized five fields, the
 * YAML collapses behind a disclosure, an api_key provider then continues to
 * the hand-paste key step, a keyless one is finished, a refusal renders in
 * place. With an imported operator settings file the flow stays copy-only.
 * Rule 3 holds throughout: no input is labelled or typed as a key, and the
 * posted definition has no key field.
 */

const known = [
  {
    name: "anthropic",
    label: "Anthropic",
    testable: true,
    snippet: "providers:\n  anthropic:\n    api_key: <YOUR_KEY>\n",
    note: "An Anthropic API key.",
  },
];

const reload = vi.fn(async () => []);
const restartDaemon = vi.fn(async () => {});
const saveDefinition = vi.fn();

type Props = ComponentProps<typeof AddProviderDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  return render(
    <AddProviderDialog
      known={known}
      configured={[]}
      authFile="/home/op/.config/mecatl/auth.yaml"
      settingsFile="/home/op/.config/mecatl/settings.yaml"
      operatorSettings={false}
      reload={reload}
      restartDaemon={restartDaemon}
      restarting={false}
      saveDefinition={saveDefinition}
      {...overrides}
    />,
  );
}

/** Radix Select focuses the selected item on open from a timer, i.e. a
 *  state update outside the click's act scope; letting that timer fire
 *  inside an awaited act keeps vitest-fail-on-console quiet. */
async function flushTimers() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Picks one option from a Radix Select by its trigger and option name. */
async function pick(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  option: RegExp,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
  await flushTimers();
}

/** Opens the dialog on the custom-gateway branch and fills the definition. */
async function describeGateway(
  user: ReturnType<typeof userEvent.setup>,
  { auth = "api_key" }: { auth?: "api_key" | "none" } = {},
) {
  await user.click(screen.getByRole("button", { name: /Add provider/ }));
  await pick(user, await screen.findByRole("combobox"), /Custom gateway/);
  if (auth === "none") {
    await pick(user, screen.getByLabelText("Authentication"), /^None/);
  }
  await user.type(screen.getByLabelText("Provider id"), "my-gateway");
  // Surrounding whitespace is normalized away before the post.
  await user.type(screen.getByLabelText("Base URL"), " https://gw.example/v1 ");
  await user.type(screen.getByLabelText("Default model"), "org/model ");
}

beforeEach(() => {
  reload.mockClear();
  restartDaemon.mockClear();
  saveDefinition.mockReset();
});

describe("AddProviderDialog — custom definition write", () => {
  it("renders Save definition, posts the normalized definition, then continues to the key step", async () => {
    saveDefinition.mockResolvedValue({ ok: true, restarted: false });
    const user = userEvent.setup();
    renderDialog();
    await describeGateway(user);

    expect(screen.getByText("2. Save the definition")).toBeInTheDocument();
    // The YAML is still reachable, behind a disclosure rather than as the
    // primary step.
    expect(screen.getByText("Show YAML")).toBeInTheDocument();
    expect(
      screen.getByText(/api_flavor: openai-responses/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save definition" }));
    expect(saveDefinition).toHaveBeenCalledTimes(1);
    expect(saveDefinition).toHaveBeenCalledWith({
      id: "my-gateway",
      apiFlavor: "openai-responses",
      baseURL: "https://gw.example/v1",
      defaultModel: "org/model",
      authMethod: "api_key",
    });
    expect(await screen.findByText(/Definition saved ✓/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save definition" }),
    ).not.toBeInTheDocument();
    // An api_key provider still needs its key by hand, then Re-check.
    expect(screen.getByText(/api_key: <YOUR_KEY>/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Re-check" }),
    ).toBeInTheDocument();
  });

  it("Re-check for a saved api_key definition waits for the KEY, not just the row", async () => {
    saveDefinition.mockResolvedValue({ ok: true, restarted: false });
    const user = userEvent.setup();
    renderDialog();
    await describeGateway(user);
    await user.click(screen.getByRole("button", { name: "Save definition" }));
    await screen.findByText(/Definition saved ✓/);

    // The definition lists at once (settings-defined) but has no key yet.
    reload.mockResolvedValueOnce([
      {
        name: "my-gateway",
        configured: true,
        keyPresent: false,
        source: "settings.yaml",
        testable: true,
      },
    ] as never);
    await user.click(screen.getByRole("button", { name: "Re-check" }));
    expect(
      await screen.findByText(/The key is not in auth\.yaml yet/),
    ).toBeInTheDocument();

    reload.mockResolvedValueOnce([
      {
        name: "my-gateway",
        configured: true,
        keyPresent: true,
        source: "settings.yaml + auth.yaml",
        testable: true,
      },
    ] as never);
    await user.click(screen.getByRole("button", { name: "Re-check" }));
    expect(await screen.findByText(/found ✓/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restart daemon to apply" }),
    ).toBeInTheDocument();
  });

  it("a keyless definition is finished on save: restarted, ready, nothing to re-check", async () => {
    saveDefinition.mockResolvedValue({ ok: true, restarted: true });
    const user = userEvent.setup();
    renderDialog();
    await describeGateway(user, { auth: "none" });
    expect(screen.getByText(/selectable right away/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save definition" }));
    expect(saveDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ authMethod: "none" }),
    );
    expect(
      await screen.findByText(/the daemon restarted with it/),
    ).toBeInTheDocument();
    expect(screen.getByText(/is ready — set it as active/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Re-check" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restart daemon to apply" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/api_key: <YOUR_KEY>/)).not.toBeInTheDocument();
  });

  it("a refused write shows the controller's reason inside the dialog and keeps the button", async () => {
    saveDefinition.mockResolvedValue({
      ok: false,
      restarted: false,
      error:
        "Refused while an imported operator settings file is active: Studio does not write the settings file then.",
    });
    const user = userEvent.setup();
    renderDialog();
    await describeGateway(user);
    await user.click(screen.getByRole("button", { name: "Save definition" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Refused while an imported operator settings file is active/,
    );
    expect(
      screen.getByRole("button", { name: "Save definition" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Definition saved/)).not.toBeInTheDocument();
  });

  it("with an imported operator settings file the flow is copy-only, with the refusal note", async () => {
    const user = userEvent.setup();
    renderDialog({ operatorSettings: true });
    await describeGateway(user);
    expect(
      screen.queryByRole("button", { name: "Save definition" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("2. Add this to the operator settings"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Studio does not write the settings file while an imported operator settings file is active/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/api_flavor: openai-responses/),
    ).toBeInTheDocument();
    expect(saveDefinition).not.toHaveBeenCalled();
  });

  it("without a saveDefinition callback (older wiring) the flow is copy-only too", async () => {
    const user = userEvent.setup();
    renderDialog({ saveDefinition: undefined });
    await describeGateway(user);
    expect(
      screen.queryByRole("button", { name: "Save definition" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("2. Add this to the operator settings"),
    ).toBeInTheDocument();
  });

  it("rule 3: no input is labelled or typed as a key, and the posted definition has no key field", async () => {
    saveDefinition.mockResolvedValue({ ok: true, restarted: false });
    const user = userEvent.setup();
    renderDialog();
    await describeGateway(user);
    for (const input of document.querySelectorAll("input, textarea")) {
      expect(input.getAttribute("type")).not.toBe("password");
      expect(
        `${input.getAttribute("id")} ${input.getAttribute("placeholder")} ${input.getAttribute("aria-label")}`,
      ).not.toMatch(/key|token|secret/i);
    }
    for (const label of document.querySelectorAll("label")) {
      expect(label.textContent ?? "").not.toMatch(/api key|token|secret/i);
    }
    await user.click(screen.getByRole("button", { name: "Save definition" }));
    const posted = saveDefinition.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(posted).sort()).toEqual([
      "apiFlavor",
      "authMethod",
      "baseURL",
      "defaultModel",
      "id",
    ]);
  });
});
