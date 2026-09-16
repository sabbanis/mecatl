import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useDaemonDefaults } from "@/features/agent/hooks/use-daemon-defaults";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type {
  HarnessControlStatus,
  HarnessDaemonDefaults,
} from "@/lib/harness/client";
import { EMPTY_DAEMON_DEFAULTS } from "@/lib/harness/client";
import {
  DaemonDefaultsCard,
  defaultsFromDraft,
  draftFromDefaults,
  modelDefaultsKind,
} from "./daemon-defaults-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;
type DefaultsHook = ReturnType<typeof useDaemonDefaults>;

/**
 * Settings → Model provider → "Daemon defaults": the web analogue of
 * mecated's --default-model / --subagent-model / --reasoning-effort /
 * --context-window-override / --llm-per-attempt-timeout /
 * --llm-stream-idle-timeout / --no-prompt-cache / --anthropic-cache-ttl /
 * --*-base-url / --toolhive-llm* / --model-alias / --model-slot /
 * --api-key-file. Pins that (1) the controls render from the saved document
 * for the ACTIVE provider, (2) Save stays disabled until the draft differs,
 * validates with the controller's grammar BEFORE confirming, and always
 * confirms with the restart warning, (3) the body sent is the normalised
 * document with the active provider's model pair folded into `models`,
 * (4) the Anthropic TTL row appears only when anthropic is configured, and
 * (5) external, offline and older-controller states render notes, not a
 * form.
 */

const saved: HarnessDaemonDefaults = {
  ...EMPTY_DAEMON_DEFAULTS,
  models: {
    openrouter: { defaultModel: "anthropic/claude", subagentModel: "" },
    anthropic: { defaultModel: "claude-sonnet-4-5", subagentModel: "" },
  },
  reasoningEffort: "high",
  aliases: { fast: "openai/gpt-4o-mini" },
  activeProvider: "openrouter",
};

function controlStatus(
  overrides: Partial<HarnessControlStatus> = {},
): HarnessControlStatus {
  return {
    mode: "managed",
    provider: "OpenRouter",
    isMock: false,
    running: true,
    gateway: null,
    toolhiveGateway: {
      available: true,
      active: false,
      baseURL: "http://127.0.0.1:14000/v1",
    },
    modelRouter: null,
    operatorSettings: false,
    skillsDir: "",
    memoryDir: "",
    configuredProviders: ["openrouter"],
    selectedProvider: "openrouter",
    authFile: "/home/op/.config/mecatl/auth.yaml",
    workspace: "/repo",
    permissions: null,
    storage: null,
    retention: null,
    daemonDefaults: saved,
    ...overrides,
  };
}

const refresh = vi.fn(async () => {});

function fakeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    live: true,
    mode: "managed",
    status: controlStatus(),
    router: null,
    permissions: null,
    models: [
      {
        id: "anthropic/claude",
        providerId: "openrouter",
        displayName: "Claude",
        contextLimit: 200_000,
        image: true,
        reasoning: true,
      },
      {
        id: "openai/gpt-5",
        providerId: "openrouter",
        displayName: "GPT-5",
        contextLimit: 400_000,
        image: true,
        reasoning: true,
      },
      {
        id: "claude-sonnet-4-5",
        providerId: "anthropic",
        displayName: "Sonnet",
        contextLimit: 200_000,
        image: true,
        reasoning: true,
      },
    ],
    isLoading: false,
    busy: "",
    error: null,
    notice: null,
    refresh,
    connectGateway: vi.fn(async () => {}),
    connectGatewayOAuth: vi.fn(async () => {}),
    saveRouter: vi.fn(async () => {}),
    savePermissions: vi.fn(async () => {}),
    saveStorage: vi.fn(async () => {}),
    ...overrides,
  } as Runtime;
}

const save = vi.fn(async (_next: unknown) => true);

function fakeDefaults(overrides: Partial<DefaultsHook> = {}): DefaultsHook {
  return {
    live: true,
    manageable: true,
    defaults: saved,
    isLoading: false,
    busy: false,
    error: null,
    notice: null,
    reload: vi.fn(async () => saved),
    save,
    ...overrides,
  };
}

beforeEach(() => {
  save.mockClear();
  refresh.mockClear();
});

describe("DaemonDefaultsCard", () => {
  it("renders the active provider's saved model pair, effort and caching from the document", () => {
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Default model" }),
    ).toHaveTextContent("Claude");
    expect(
      screen.getByRole("combobox", { name: "Subagent model" }),
    ).toHaveTextContent("Inherit the session model");
    expect(
      screen.getByRole("combobox", { name: "Default reasoning effort" }),
    ).toHaveTextContent("High");
    expect(
      screen.getByRole("textbox", { name: "Context window override" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("switch", { name: "Provider-side prompt caching" }),
    ).toBeChecked();
    expect(screen.getByText(/Saving restarts the daemon/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    // Anthropic is not configured: its TTL row stays out of the way.
    expect(
      screen.queryByRole("combobox", { name: "Anthropic cache TTL" }),
    ).toBeNull();
    // Advanced is collapsed until asked for.
    expect(screen.queryByLabelText("OpenRouter base URL")).toBeNull();
  });

  it("shows the Anthropic TTL picker only when anthropic is a configured provider", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime({
          status: controlStatus({
            configuredProviders: ["openrouter", "anthropic"],
          }),
        })}
        defaults={fakeDefaults()}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Anthropic cache TTL" }),
    ).toHaveTextContent("API default (5 minutes)");
  });

  it("picks a default model, confirms the restart, and PUTs the pair folded into models", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Default model" }));
    await user.click(await screen.findByRole("option", { name: /GPT-5/ }));
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Save the daemon defaults\?/);
    expect(dialog).toHaveTextContent(/The daemon restarts/);
    expect(dialog).toHaveTextContent(/refused at startup/);
    expect(save).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(save).not.toHaveBeenCalled();

    await user.click(saveButton);
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({
      ...saved,
      models: {
        anthropic: { defaultModel: "claude-sonnet-4-5", subagentModel: "" },
        openrouter: { defaultModel: "openai/gpt-5", subagentModel: "" },
      },
      activeProvider: null,
    });
    // The status poll is refreshed so the top card reads the new spawn.
    expect(refresh).toHaveBeenCalled();
  });

  it("renders the LLM stream timeouts from the saved document with mecated's defaults filled in", () => {
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    // The empty document holds mecated's own bounds, shown as real values
    // (not blanks) so the operator sees what the daemon actually runs with.
    expect(
      screen.getByRole("textbox", { name: "LLM connect timeout" }),
    ).toHaveValue("300");
    expect(
      screen.getByRole("textbox", { name: "LLM idle timeout" }),
    ).toHaveValue("180");
    expect(screen.getByText(/--llm-per-attempt-timeout/)).toBeInTheDocument();
    expect(screen.getByText(/--llm-stream-idle-timeout/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("edits the idle timeout, confirms the restart, and PUTs whole-second llmTimeouts", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    const idle = screen.getByRole("textbox", { name: "LLM idle timeout" });
    await user.clear(idle);
    await user.type(idle, "600");
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/The daemon restarts/);
    await user.click(
      within(dialog).getByRole("button", { name: "Save and restart" }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      llmTimeouts: { perAttemptSeconds: 300, streamIdleSeconds: 600 },
    });
    // The untouched connect bound stays mecated's default, the rest of the
    // document rides along unchanged.
    expect(save.mock.calls[0][0]).toMatchObject({
      reasoningEffort: "high",
      aliases: { fast: "openai/gpt-4o-mini" },
    });
  });

  it("disables a bound with 0 and refuses a fractional or suffixed timeout before any confirm", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    const connect = screen.getByRole("textbox", {
      name: "LLM connect timeout",
    });
    await user.clear(connect);
    await user.type(connect, "1.5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /LLM connect timeout must be a whole number of seconds/,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(save).not.toHaveBeenCalled();

    await user.clear(connect);
    await user.type(connect, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      llmTimeouts: { perAttemptSeconds: 0, streamIdleSeconds: 180 },
    });
  });

  it("switches caching off, shows the ADR 0100 note, and sends promptCache.disabled", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    await user.click(
      screen.getByRole("switch", { name: "Provider-side prompt caching" }),
    );
    expect(screen.getByText(/ADR 0100/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      promptCache: { disabled: true, anthropicTtl: "" },
    });
  });

  it("refuses an invalid draft with the controller's message before any confirm", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    const window = screen.getByRole("textbox", {
      name: "Context window override",
    });
    await user.type(window, "-5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /context window override must be a whole number/,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("edits the advanced knobs: a base-URL override, ToolHive, an alias and the credentials file", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    const advanced = screen.getByRole("button", { name: "Advanced" });
    expect(advanced).toHaveAttribute("aria-expanded", "false");
    await user.click(advanced);
    expect(advanced).toHaveAttribute("aria-expanded", "true");

    await user.type(
      screen.getByLabelText("OpenRouter base URL"),
      "https://gw.example/v1",
    );
    await user.click(
      screen.getByRole("switch", { name: /Detect the gateway/ }),
    );
    // The saved alias renders as a row; add a slot too.
    expect(screen.getByDisplayValue("fast")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    await user.type(screen.getByLabelText("Slot"), "compaction");
    await user.type(screen.getByLabelText("Model or alias"), "fast");
    await user.type(
      screen.getByLabelText("Credentials file"),
      "/home/op/.config/mecatl/team.yaml",
    );
    // Rule 3: nothing on this surface is password-shaped or key-named.
    for (const input of document.querySelectorAll("input")) {
      expect(input.getAttribute("type")).not.toBe("password");
      expect(
        `${input.getAttribute("id")} ${input.getAttribute("placeholder")}`,
      ).not.toMatch(/secret|token|api[-_]?key(?!-file)/i);
    }

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Save and restart" }),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      baseUrls: {
        openrouter: "https://gw.example/v1",
        openai: "",
        anthropic: "",
        opencode: "",
      },
      toolhive: { enabled: false, baseUrl: "", mode: "auto" },
      aliases: { fast: "openai/gpt-4o-mini" },
      slots: { compaction: "fast" },
      apiKeyFile: "/home/op/.config/mecatl/team.yaml",
    });
  });

  it("refuses the router slot with the Model router page's ownership message", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    await user.type(screen.getByLabelText("Slot"), "router");
    await user.type(screen.getByLabelText("Model or alias"), "fast");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /owned by the Model router page/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("Discard returns to the saved values and disables Save again", async () => {
    const user = userEvent.setup();
    render(
      <DaemonDefaultsCard runtime={fakeRuntime()} defaults={fakeDefaults()} />,
    );
    await user.click(
      screen.getByRole("switch", { name: "Provider-side prompt caching" }),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      screen.getByRole("switch", { name: "Provider-side prompt caching" }),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("hides the model rows on the offline mock and explains why", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime({
          status: controlStatus({
            provider: "offline mock",
            isMock: true,
            selectedProvider: "mock",
          }),
        })}
        defaults={fakeDefaults()}
      />,
    );
    expect(
      screen.queryByRole("combobox", { name: "Default model" }),
    ).toBeNull();
    expect(
      screen.getByText(/set a provider as active above/),
    ).toBeInTheDocument();
    // The rest of the flags are still editable on the mock.
    expect(
      screen.getByRole("combobox", { name: "Default reasoning effort" }),
    ).toBeInTheDocument();
  });

  it("surfaces the hook's error and notice, and shows Saving… while busy", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime()}
        defaults={fakeDefaults({
          busy: true,
          error: '--default-model "nope": not catalogued',
          notice: null,
        })}
      />,
    );
    expect(screen.getByText(/not catalogued/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("renders the managed note and no form in external mode", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime({
          mode: "external",
          status: controlStatus({ mode: "external", daemonDefaults: null }),
        })}
        defaults={fakeDefaults({ manageable: false, defaults: null })}
      />,
    );
    expect(
      screen.getByText(/Managed by the external mecated deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("renders the offline note when the runtime is unreachable", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime({ live: false })}
        defaults={fakeDefaults()}
      />,
    );
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("reports a controller that did not answer with defaults instead of inventing them", () => {
    render(
      <DaemonDefaultsCard
        runtime={fakeRuntime()}
        defaults={fakeDefaults({ defaults: null, isLoading: false })}
      />,
    );
    expect(
      screen.getByText(/controller did not report its daemon defaults/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});

describe("draftFromDefaults / defaultsFromDraft", () => {
  it("round-trips the saved document for the active provider and keeps other providers' pairs", () => {
    const draft = draftFromDefaults(saved, "openrouter");
    expect(draft.defaultModel).toBe("anthropic/claude");
    expect(draft.aliases).toEqual([
      { key: "fast", value: "openai/gpt-4o-mini" },
    ]);
    expect(draft.contextWindowOverride).toBe("");
    expect(defaultsFromDraft(draft, saved, "openrouter")).toEqual({
      ...saved,
      activeProvider: null,
    });
    const moved = defaultsFromDraft(
      { ...draft, defaultModel: "", subagentModel: "openai/gpt-5" },
      saved,
      "openrouter",
    );
    expect(moved.models).toEqual({
      anthropic: { defaultModel: "claude-sonnet-4-5", subagentModel: "" },
      openrouter: { defaultModel: "", subagentModel: "openai/gpt-5" },
    });
  });

  it("drops abandoned blank rows and parses the typed window", () => {
    const draft = draftFromDefaults(saved, null);
    const document = defaultsFromDraft(
      {
        ...draft,
        contextWindowOverride: " 32000 ",
        aliases: [
          { key: "fast", value: "openai/gpt-4o-mini" },
          { key: "", value: "" },
        ],
      },
      saved,
      null,
    );
    expect(document.contextWindowOverride).toBe(32_000);
    expect(document.aliases).toEqual({ fast: "openai/gpt-4o-mini" });
    // A null kind (the mock) leaves every saved pair alone.
    expect(document.models).toEqual(saved.models);
  });

  it("renders the LLM timeouts as digit strings and reads a blanked field as mecated's default", () => {
    const draft = draftFromDefaults(
      {
        ...saved,
        llmTimeouts: { perAttemptSeconds: 0, streamIdleSeconds: 45 },
      },
      null,
    );
    expect(draft.llmPerAttemptTimeout).toBe("0");
    expect(draft.llmStreamIdleTimeout).toBe("45");
    const document = defaultsFromDraft(
      { ...draft, llmPerAttemptTimeout: "", llmStreamIdleTimeout: " 45 " },
      saved,
      null,
    );
    expect(document.llmTimeouts).toEqual({
      perAttemptSeconds: 300,
      streamIdleSeconds: 45,
    });
  });
});

describe("modelDefaultsKind", () => {
  it("is the active provider, the ToolHive fallback, and never the mock", () => {
    expect(modelDefaultsKind(controlStatus())).toBe("openrouter");
    expect(
      modelDefaultsKind(
        controlStatus({
          selectedProvider: null,
          toolhiveGateway: { available: true, active: true },
        }),
      ),
    ).toBe("toolhive");
    expect(
      modelDefaultsKind(controlStatus({ selectedProvider: "mock" })),
    ).toBeNull();
    expect(
      modelDefaultsKind(
        controlStatus({ selectedProvider: null, toolhiveGateway: null }),
      ),
    ).toBeNull();
    expect(modelDefaultsKind(null)).toBeNull();
  });
});
