import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type { useProviderManagement } from "@/features/agent/hooks/use-provider-management";
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
    removeProvider,
    restartDaemon: vi.fn(async () => {}),
    ...overrides,
  };
}

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

  it("confirms Remove with the restart warning before calling the controller", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSection runtime={fakeRuntime()} management={fakeManagement()} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for openrouter" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(removeProvider).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/the daemon restarts: in-flight/),
    ).toBeInTheDocument();
    // The selected provider gets the extra MECATL_STUDIO_PROVIDER warning.
    expect(screen.getByText(/SELECTED provider/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeProvider).toHaveBeenCalledWith("openrouter");
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
  });
});
