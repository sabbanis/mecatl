import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type { useProviderManagement } from "@/features/agent/hooks/use-provider-management";
import type { useProviderStatus } from "@/features/agent/hooks/use-provider-status";
import type { HarnessProviderInfo } from "@/lib/harness/client";
import { ENV_SHADOW_TITLE } from "./provider-inventory";
import { ProviderSection } from "./provider-section";

type Runtime = ReturnType<typeof useHarnessRuntime>;
type Management = ReturnType<typeof useProviderManagement>;

/**
 * Pins the provider management surface's two rules with teeth:
 * 1. NO key-paste UI anywhere (Studio rule 3) — with the Add dialog OPEN,
 *    the whole surface renders zero text inputs/textareas: adding a provider
 *    is a copyable snippet, never a form field a key could be typed into.
 * 2. Mutations confirm with the restart warning before any write, and
 *    external mode renders the managed note with no management controls.
 */

const status = {
  mode: "managed" as const,
  provider: "OpenRouter",
  running: true,
  gateway: null,
  modelRouter: null,
  operatorSettings: false,
  skillsDir: "",
  memoryDir: "",
  isMock: false,
  toolhiveGateway: null,
  configuredProviders: ["openrouter", "anthropic"],
  selectedProvider: "openrouter",
  authFile: "/home/op/.config/mecatl/auth.yaml",
  workspace: "",
  permissions: null,
  storage: null,
  retention: null,
};

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    live: true,
    mode: "managed",
    status,
    router: null,
    models: [
      {
        id: "anthropic/claude",
        providerId: "openrouter",
        displayName: "Claude",
        contextLimit: 200_000,
        image: true,
        reasoning: true,
      },
    ],
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    refresh: vi.fn(async () => {}),
    connectGateway: vi.fn(async () => {}),
    connectGatewayOAuth: vi.fn(async () => {}),
    saveRouter: vi.fn(async () => {}),
    permissions: null,
    savePermissions: vi.fn(async () => {}),
    saveStorage: vi.fn(async () => {}),
    saveRetention: vi.fn(async () => {}),
    ...overrides,
  };
}

const removeProvider = vi.fn(async () => {});
const testKey = vi.fn(async () => {});

function fakeManagement(overrides: Partial<Management> = {}): Management {
  return {
    setActiveProvider: vi.fn(async () => {}),
    live: true,
    manageable: true,
    providers: [
      {
        name: "openrouter",
        configured: true,
        keyPresent: true,
        source: "auth.yaml",
        testable: true,
      },
      {
        name: "openai-codex",
        configured: true,
        keyPresent: false,
        source: "auth.yaml",
        testable: false,
      },
    ],
    known: [
      {
        name: "anthropic",
        label: "Anthropic",
        testable: true,
        snippet: "providers:\n  anthropic:\n    api_key: <YOUR_KEY>\n",
        note: "An Anthropic API key.",
      },
    ],
    health: {},
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    reload: vi.fn(async () => []),
    testKey,
    addCustomProvider: vi.fn(async () => ({ ok: true, restarted: false })),
    removeProvider,
    restartDaemon: vi.fn(async () => {}),
    startToolhive: vi.fn(async () => {}),
    ...overrides,
  };
}

type ProviderStatus = ReturnType<typeof useProviderStatus>;
type StatusRow = ProviderStatus["rows"][number];

/** The daemon's provider_status hook, faked from a fixed row set. */
function fakeProviderStatus(rows: StatusRow[]): ProviderStatus {
  return {
    live: true,
    rows,
    isLoading: false,
    error: null,
    refresh: vi.fn(async () => {}),
    forProvider: (id: string) =>
      rows.find((row) => row.providerId === id) ?? null,
  };
}

/** A controller row with the `providers status` parity fields filled in. */
function parityRow(
  overrides: Partial<HarnessProviderInfo> & { name: string },
): HarnessProviderInfo {
  return {
    configured: true,
    keyPresent: true,
    source: "auth.yaml",
    testable: true,
    class: "built-in",
    authMethod: "api_key",
    envShadowed: false,
    authState: "configured",
    defaultModel: "",
    nextStep: "set as active to use it",
    active: false,
    ...overrides,
  };
}

const toolhiveRow = (
  overrides: Partial<HarnessProviderInfo> = {},
): HarnessProviderInfo =>
  parityRow({
    name: "toolhive",
    configured: false,
    source: "thv llm proxy",
    testable: false,
    class: "external",
    authMethod: "external",
    authState: "gateway not reachable",
    nextStep: "start the gateway (thv llm proxy start)",
    baseURL: "http://127.0.0.1:14000/v1",
    reachable: false,
    thvOnPath: true,
    ...overrides,
  });

beforeEach(() => {
  removeProvider.mockClear();
  testKey.mockClear();
});

describe("provider management surface", () => {
  it("renders provider rows with key health and never a key value", () => {
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    expect(screen.getByText("openrouter")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText(/untested/)).toBeInTheDocument();
    expect(screen.getByText(/no key in block/)).toBeInTheDocument();
  });

  it("offers NO key input anywhere, even with the Add dialog open", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    await user.click(screen.getByRole("button", { name: /Add provider/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Studio never handles API keys/)).toBeTruthy();
    // Rule 3's UI half: the entire surface — rows, kebab, open dialog —
    // contains no element a credential could be typed or pasted into.
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("confirms Remove key (a built-in's whole block) with the restart warning before calling the controller", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for openrouter" }),
    );
    // A built-in has no definition to keep, so its one destructive item is
    // the whole-block cut — and there is no "keep provider" variant.
    expect(
      screen.queryByRole("menuitem", { name: "Remove key (keep provider)" }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("menuitem", { name: "Remove key" }),
    );
    expect(removeProvider).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/the daemon restarts: in-flight/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/key included — is removed from auth\.yaml/),
    ).toBeInTheDocument();
    // The selected provider gets the extra MECATL_STUDIO_PROVIDER warning.
    expect(screen.getByText(/SELECTED provider/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeProvider).toHaveBeenCalledWith("openrouter", "all");
  });

  it("disables Test key when the provider kind is not testable", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for openai-codex" }),
    );
    const item = await screen.findByRole("menuitem", { name: "Test key" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(testKey).not.toHaveBeenCalled();
  });

  it("lists a settings-defined keyless custom provider as a normal row", () => {
    // G1.3 (ADR 0238): an auth.method none provider has no auth.yaml block,
    // so it reaches the UI only because the controller also lists the
    // settings providers: section. keyPresent true = "no credential needed",
    // so Set-as-active stays enabled.
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [
            {
              name: "my-gateway",
              configured: true,
              keyPresent: true,
              source: "settings.yaml",
              testable: false,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("my-gateway")).toBeInTheDocument();
    expect(screen.getByText(/settings\.yaml/)).toBeInTheDocument();
  });

  it("custom gateway flow emits both snippets and never a key input", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    await user.click(screen.getByRole("button", { name: /Add provider/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: /Custom gateway/ }),
    );

    await user.type(screen.getByLabelText("Provider id"), "my-gateway");
    await user.type(screen.getByLabelText("Base URL"), "https://gw.example/v1");
    await user.type(screen.getByLabelText("Default model"), "org/model");

    // Both copyable snippets: the settings providers: block (with the strict
    // fields the daemon requires, default_model included) and the auth.yaml
    // key block with its placeholder.
    expect(
      screen.getByText(/api_flavor: openai-responses/),
    ).toBeInTheDocument();
    expect(screen.getByText(/default_model: "org\/model"/)).toBeInTheDocument();
    expect(screen.getByText(/method: api_key/)).toBeInTheDocument();
    expect(screen.getByText(/api_key: <YOUR_KEY>/)).toBeInTheDocument();

    // Rule 3 still holds with the custom form open: the inputs collect the
    // NON-secret definition (id, URL, model) — nothing password-shaped, and
    // no field whose name suggests a credential.
    for (const input of document.querySelectorAll("input, textarea")) {
      expect(input.getAttribute("type")).not.toBe("password");
      expect(
        `${input.getAttribute("id")} ${input.getAttribute("placeholder")}`,
      ).not.toMatch(/key|token|secret/i);
    }
  });

  it("external mode renders the managed note and no management controls", () => {
    render(
      <ProviderSection
        runtime={fakeRuntime({
          mode: "external",
          status: { ...status, mode: "external" },
        })}
        management={fakeManagement({
          manageable: false,
          providers: [],
          known: [],
        })}
      />,
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add provider/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Test key/)).not.toBeInTheDocument();
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /Switch to offline mock/ }),
    ).not.toBeInTheDocument();
  });

  it("offers the explicit --mock switch, confirms the restart, then calls setActiveProvider('mock')", async () => {
    // The daemon landed on the mock only implicitly before (no selection, or
    // the last provider removed); this is the deliberate `--mock` control.
    const user = userEvent.setup();
    const setActiveProvider = vi.fn(async () => {});
    const refresh = vi.fn(async () => {});
    render(
      <ProviderSection
        runtime={fakeRuntime({ refresh })}
        management={fakeManagement({ setActiveProvider })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Switch to offline mock" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Switch to the offline mock\?/);
    expect(dialog).toHaveTextContent(/die with the restart/);
    expect(setActiveProvider).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Switch to mock" }));
    expect(setActiveProvider).toHaveBeenCalledWith("mock");
    // The status poll is refreshed so the card shows the mock as active.
    expect(refresh).toHaveBeenCalled();
    // Still no key-shaped input anywhere.
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("hides the mock switch while the offline mock is already active", () => {
    render(
      <ProviderSection
        runtime={fakeRuntime({
          status: {
            ...status,
            provider: "offline mock",
            isMock: true,
            selectedProvider: "mock",
          },
        })}
        management={fakeManagement()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Switch to offline mock/ }),
    ).not.toBeInTheDocument();
  });
});

/**
 * `providers status` parity: class + authentication state (env shadowing
 * in amber with the explanatory title), the default model, the next step,
 * the daemon's own provider_status hint, the ToolHive external row with its
 * `thv llm` delegation, the unconfigured kinds that open the Add dialog
 * preselected, and the zero-provider guidance. Still no key input anywhere.
 */
/**
 * Removal in the TUI's two scopes (`providers logout` vs `providers
 * remove`): a custom row's kebab offers "Remove key (keep provider)" only
 * when an api_key is actually in its auth.yaml block, plus "Remove provider"
 * (withheld while an imported operator settings file is active — the
 * controller refuses to edit the settings file then); the confirm names
 * exactly what is cut and the scope is passed through to the hook.
 */
describe("provider removal scopes", () => {
  const keyedCustom = parityRow({
    name: "my-gw",
    class: "custom",
    authMethod: "api_key",
    keyPresent: true,
    source: "settings.yaml + auth.yaml",
    testable: true,
  });
  const keylessCustom = parityRow({
    name: "open-gw",
    class: "custom",
    authMethod: "none",
    keyPresent: true,
    source: "settings.yaml",
    testable: false,
    authState: "not required",
  });

  it("Remove key (keep provider) confirms the api_key-only cut and passes scope credential", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({ providers: [keyedCustom] })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for my-gw" }));
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Remove key (keep provider)",
      }),
    );
    expect(removeProvider).not.toHaveBeenCalled();
    const description = await screen.findByText(
      /Only its api_key line is cut from auth\.yaml/,
    );
    expect(description).toHaveTextContent(/definition stays in settings\.yaml/);
    expect(description).toHaveTextContent(/the daemon restarts: in-flight/);
    await user.click(screen.getByRole("button", { name: "Remove key" }));
    expect(removeProvider).toHaveBeenCalledWith("my-gw", "credential");
  });

  it("Remove provider names the definition AND the key block, and passes scope all", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({ providers: [keyedCustom] })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for my-gw" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Remove provider" }),
    );
    expect(
      await screen.findByText(
        /Its definition is removed from settings\.yaml, and its key block from auth\.yaml,/,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeProvider).toHaveBeenCalledWith("my-gw", "all");
  });

  it("a keyless custom row disables the key-only cut; Remove provider names only the definition", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({ providers: [keylessCustom] })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for open-gw" }),
    );
    expect(
      await screen.findByRole("menuitem", {
        name: "Remove key (keep provider)",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("menuitem", { name: "Remove provider" }));
    const description = await screen.findByText(
      /Its definition is removed from settings\.yaml on the daemon/,
    );
    expect(description).not.toHaveTextContent(/key block/);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeProvider).toHaveBeenCalledWith("open-gw", "all");
  });

  it("withholds Remove provider while an imported operator settings file is active, keeping the key-only cut", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection
        runtime={fakeRuntime({
          status: { ...status, operatorSettings: true },
        })}
        management={fakeManagement({ providers: [keyedCustom] })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for my-gw" }));
    const remove = await screen.findByRole("menuitem", {
      name: "Remove provider",
    });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAttribute(
      "title",
      expect.stringMatching(
        /Refused while an imported operator settings file is active/,
      ),
    );
    expect(
      screen.getByRole("menuitem", { name: "Remove key (keep provider)" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("provider inventory parity", () => {
  it("renders class, env-shadowed auth state (amber, titled), default model and next step", () => {
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [
            parityRow({
              name: "openai",
              envShadowed: true,
              authState: "configured (environment shadows auth.yaml)",
              source: "auth.yaml + environment",
              defaultModel: "gpt-5",
              nextStep: "set as active to use it",
            }),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("provider-class")).toHaveTextContent("built-in");
    const state = screen.getByText(
      "configured (environment shadows auth.yaml)",
    );
    expect(state).toHaveClass("text-warning");
    expect(state).toHaveAttribute("title", ENV_SHADOW_TITLE);
    expect(screen.getByText(/default: gpt-5/)).toBeInTheDocument();
    expect(
      screen.getByText("Next: set as active to use it"),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("merges the daemon's provider_status hint into the row only when its state is not ok", () => {
    const { rerender } = render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [parityRow({ name: "openrouter", defaultModel: "a/b" })],
        })}
        providerStatus={fakeProviderStatus([
          {
            providerId: "openrouter",
            state: "unreachable",
            hint: "check the network",
            defaultModelAutoSelected: false,
            modelCount: 0,
            availableNotDefault: false,
          },
        ])}
      />,
    );
    expect(
      screen.getByText("daemon: unreachable — check the network"),
    ).toBeInTheDocument();

    rerender(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [parityRow({ name: "openrouter", defaultModel: "a/b" })],
        })}
        providerStatus={fakeProviderStatus([
          {
            providerId: "openrouter",
            state: "ok",
            hint: "",
            defaultModelAutoSelected: true,
            modelCount: 3,
            availableNotDefault: true,
          },
        ])}
      />,
    );
    expect(screen.queryByText(/^daemon:/)).not.toBeInTheDocument();
    // The daemon's flags decorate the row: auto-selected default, available-not-default.
    expect(
      screen.getByText(/default: a\/b \(auto-selected\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("available, not default")).toBeInTheDocument();
  });

  it("ToolHive row: Start gateway only when thv is on PATH and the proxy is down; it calls startToolhive", async () => {
    const user = userEvent.setup();
    const startToolhive = vi.fn(async () => {});
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [parityRow({ name: "openrouter" }), toolhiveRow()],
          startToolhive,
        })}
      />,
    );
    const row = screen.getByTestId("toolhive-gateway-row");
    expect(row).toHaveTextContent("external");
    expect(row).toHaveTextContent("gateway not reachable");
    expect(row).toHaveTextContent("http://127.0.0.1:14000/v1");
    expect(row).toHaveTextContent(/thv llm login/);
    await user.click(screen.getByRole("button", { name: "Start gateway" }));
    expect(startToolhive).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Set as active" }),
    ).not.toBeInTheDocument();
  });

  it("ToolHive row: no Start gateway without thv; Set as active when reachable", async () => {
    const user = userEvent.setup();
    const setActiveProvider = vi.fn(async () => {});
    const { rerender } = render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [toolhiveRow({ thvOnPath: false })],
          setActiveProvider,
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Start gateway" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Install ToolHive and run thv llm proxy start/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Re-check" }),
    ).toBeInTheDocument();

    rerender(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [
            toolhiveRow({
              configured: true,
              reachable: true,
              authState: "gateway reachable",
              nextStep: "set as active to use it",
            }),
          ],
          setActiveProvider,
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Start gateway" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set as active" }));
    expect(setActiveProvider).toHaveBeenCalledWith("toolhive");
  });

  it("shows the zero-provider guidance when only the gateway and unconfigured kinds remain", () => {
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [
            toolhiveRow(),
            parityRow({
              name: "anthropic",
              configured: false,
              keyPresent: false,
              source: "",
              testable: false,
              authState: "not configured",
              nextStep: "add an API key to auth.yaml",
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        /No providers are configured — mecated is running on the offline mock/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/or start a ToolHive gateway/)).toBeInTheDocument();
    // The unconfigured kind is NOT a configured row (no kebab), only an
    // "Available kinds" entry.
    expect(
      screen.queryByRole("button", { name: "Actions for anthropic" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("available-kinds")).toHaveTextContent(
      "Available kinds (1)",
    );
  });

  it("an unconfigured kind opens the Add dialog preselected on that kind", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection
        runtime={fakeRuntime()}
        management={fakeManagement({
          providers: [
            parityRow({ name: "openrouter" }),
            parityRow({
              name: "anthropic",
              configured: false,
              keyPresent: false,
              source: "",
              testable: false,
              authState: "not configured",
              nextStep: "add an API key to auth.yaml",
            }),
          ],
        })}
      />,
    );
    const available = screen.getByTestId("available-kinds");
    expect(available).toHaveTextContent("not configured");
    expect(available).toHaveTextContent("Next: add an API key to auth.yaml");
    await user.click(screen.getByRole("button", { name: "Add Anthropic" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Preselected: the chooser shows Anthropic and its snippet is on screen.
    expect(screen.getByRole("combobox")).toHaveTextContent("Anthropic");
    expect(screen.getByText(/anthropic:/)).toBeInTheDocument();
    expect(screen.getByText(/api_key: <YOUR_KEY>/)).toBeInTheDocument();
    // Rule 3 holds with the preselected dialog open too: the only field a
    // built-in kind shows is the optional gateway base URL — nothing
    // password-shaped, nothing named like a credential.
    for (const input of document.querySelectorAll("input, textarea")) {
      expect(input.getAttribute("type")).not.toBe("password");
      expect(
        `${input.getAttribute("id")} ${input.getAttribute("placeholder")}`,
      ).not.toMatch(/key|token|secret/i);
    }
  });

  it("external mode lists the daemon's status rows read-only, with a hint only when not ok", () => {
    render(
      <ProviderSection
        runtime={fakeRuntime({
          mode: "external",
          status: { ...status, mode: "external" },
        })}
        management={fakeManagement({
          manageable: false,
          providers: [],
          known: [],
        })}
        providerStatus={fakeProviderStatus([
          {
            providerId: "fixture",
            state: "ok",
            hint: "",
            defaultModelAutoSelected: false,
            modelCount: 1,
            availableNotDefault: false,
          },
          {
            providerId: "toolhive",
            state: "unreachable",
            hint: "start it with `thv llm proxy start`",
            defaultModelAutoSelected: false,
            modelCount: 0,
            availableNotDefault: false,
          },
        ])}
      />,
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    const ok = document.querySelector("[data-provider-status='fixture']");
    expect(ok).toHaveTextContent("ok · 1 model");
    expect(ok?.querySelector("[data-role='hint']")).toBeNull();
    const down = document.querySelector("[data-provider-status='toolhive']");
    expect(down?.querySelector("[data-role='hint']")).toHaveTextContent(
      "start it with `thv llm proxy start`",
    );
    // Read-only: no controls, no key input.
    expect(screen.queryByRole("button", { name: /Start gateway/ })).toBeNull();
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
  });
});
