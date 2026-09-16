import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "@/test/memory-storage";
import { ModelEffortSelector } from "./chat-input";
import {
  FILTER_MODELS_LABEL,
  filterModelOptions,
  MODEL_SWITCH_NOTE,
  NO_MODELS_MATCH,
} from "./model-picker";

const DEFAULT_KEY = "mecatl-studio.default-model";

const models = [
  {
    id: "gpt-5",
    label: "GPT-5",
    providerId: "openai",
    reasoning: true,
    image: true,
    contextLimit: 400_000,
  },
  {
    id: "claude-sonnet",
    label: "Sonnet",
    providerId: "anthropic",
    reasoning: true,
    image: false,
    contextLimit: 200_000,
  },
  {
    id: "small",
    label: "Small",
    providerId: "openrouter",
    reasoning: false,
    image: false,
    contextLimit: 0,
  },
];

/** The trigger is the only button before the menu opens. */
const trigger = () => screen.getByRole("button");

/** Opens the root menu with a real pointer, then the Model submenu with a
 *  plain click (jsdom's zero-size rects make a simulated pointer move read
 *  to Radix as leaving the submenu). Returns the filter box. */
async function openModels(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Model/ }));
  return screen.findByRole("combobox", { name: FILTER_MODELS_LABEL });
}

const rowNames = () =>
  screen.getAllByRole("option").map((row) => row.textContent ?? "");

const header = () => screen.getByTestId("model-picker-current");

/**
 * The pure filter behind both pickers: a case-insensitive substring match
 * over provider id, model id and display name.
 */
describe("filterModelOptions", () => {
  it("matches provider, id and label case-insensitively", () => {
    expect(filterModelOptions(models, "OPENAI").map((m) => m.id)).toEqual([
      "gpt-5",
    ]);
    expect(filterModelOptions(models, "sonnet").map((m) => m.id)).toEqual([
      "claude-sonnet",
    ]);
    expect(filterModelOptions(models, "gpt").map((m) => m.id)).toEqual([
      "gpt-5",
    ]);
  });

  it("keeps every row for an empty or whitespace query", () => {
    expect(filterModelOptions(models, "")).toHaveLength(3);
    expect(filterModelOptions(models, "   ")).toHaveLength(3);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterModelOptions(models, "gemini")).toEqual([]);
  });
});

/**
 * The composer's Model submenu, driven through the real ModelEffortSelector
 * (Radix menu + cmdk list): provider-qualified rows with glyphs and context,
 * type-to-filter with a two-stage Escape, the `current:` provenance header,
 * and the browser-local default for new chats (★ + set/clear).
 */
describe("Model picker", () => {
  // jsdom exposes no localStorage here; the shared in-memory stub stands in
  // (the global afterEach unstubs it, so every test starts with no default).
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("renders provider · name rows with capability glyphs and the context window, auto first", async () => {
    const user = userEvent.setup();
    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={() => {}}
        onSwitchEffort={() => {}}
        currentModelId="gpt-5"
        currentEffort=""
        autoModelLabel="Auto-routed"
      />,
    );
    await openModels(user);
    const rows = screen.getAllByRole("option");
    expect(rows[0]).toHaveTextContent("Auto-routed");
    expect(rows[1]).toHaveTextContent("openai·GPT-5400k");
    expect(rows[2]).toHaveTextContent("anthropic·Sonnet200k");
    // No context label for an unknown (0) window.
    expect(rows[3]).toHaveTextContent("openrouter·Small");
    expect(rows[3]).not.toHaveTextContent("k");
    // Glyphs carry accessible names; GPT-5 has both, Sonnet reasoning only.
    expect(screen.getAllByRole("img", { name: "Accepts images" })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("img", { name: "Reasoning" })).toHaveLength(2);
    // The current model is marked.
    expect(rows[1]).toHaveAttribute("data-current", "true");
    expect(screen.getByText(MODEL_SWITCH_NOTE)).toBeInTheDocument();
  });

  it("filters rows by provider, id or name and shows an empty state", async () => {
    const user = userEvent.setup();
    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={() => {}}
        onSwitchEffort={() => {}}
        currentModelId=""
        currentEffort=""
      />,
    );
    const input = await openModels(user);
    fireEvent.change(input, { target: { value: "anthro" } });
    await waitFor(() =>
      expect(rowNames()).toEqual(["Default model", "anthropic·Sonnet200k"]),
    );
    fireEvent.change(input, { target: { value: "claude-son" } });
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    fireEvent.change(input, { target: { value: "gemini" } });
    await waitFor(() =>
      expect(screen.getByText(NO_MODELS_MATCH)).toBeInTheDocument(),
    );
    // The auto row stays pinned even when nothing else matches.
    expect(rowNames()).toEqual(["Default model"]);
  });

  it("two-stage Escape: clears a non-empty filter first, closes the menu when empty", async () => {
    const user = userEvent.setup();
    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={() => {}}
        onSwitchEffort={() => {}}
        currentModelId=""
        currentEffort=""
      />,
    );
    const input = await openModels(user);
    fireEvent.change(input, { target: { value: "small" } });
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    fireEvent.keyDown(input, { key: "Escape" });
    // Stage one: the filter is cleared, the menu stays open.
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(
      screen.getByRole("combobox", { name: FILTER_MODELS_LABEL }),
    ).toHaveValue("");
    fireEvent.keyDown(input, { key: "Escape" });
    // Stage two: Radix closes the whole menu.
    await waitFor(() =>
      expect(
        screen.queryByRole("combobox", { name: FILTER_MODELS_LABEL }),
      ).toBeNull(),
    );
  });

  it("live chat: picking a row forks, re-picking the current one is a no-op, auto forks with null", async () => {
    const user = userEvent.setup();
    const onSwitchModel = vi.fn();
    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={onSwitchModel}
        onSwitchEffort={() => {}}
        currentModelId="gpt-5"
        currentEffort=""
      />,
    );
    await openModels(user);
    fireEvent.click(screen.getByRole("option", { name: /GPT-5/ }));
    expect(onSwitchModel).not.toHaveBeenCalled();
    // The menu closed on the pick (cmdk rows are not Radix items).
    await waitFor(() =>
      expect(
        screen.queryByRole("combobox", { name: FILTER_MODELS_LABEL }),
      ).toBeNull(),
    );
    await openModels(user);
    fireEvent.click(screen.getByRole("option", { name: /Sonnet/ }));
    expect(onSwitchModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "claude-sonnet", providerId: "anthropic" }),
    );
    await openModels(user);
    fireEvent.click(screen.getByRole("option", { name: /Default model/ }));
    expect(onSwitchModel).toHaveBeenLastCalledWith(null);
  });

  it("header names the live model and its provenance: daemon default, your pick, Studio default", async () => {
    const user = userEvent.setup();
    const view = render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={() => {}}
        onSwitchEffort={() => {}}
        currentModelId=""
        currentEffort=""
      />,
    );
    await openModels(user);
    expect(header()).toHaveTextContent(
      "current: Default model — daemon default",
    );
    view.unmount();

    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={() => {}}
        onSwitchEffort={() => {}}
        currentModelId="claude-sonnet"
        currentEffort=""
      />,
    );
    await openModels(user);
    expect(header()).toHaveTextContent("current: Sonnet — your pick");
    // Marking it as the default relabels the provenance live.
    fireEvent.click(
      screen.getByRole("button", { name: "Set Sonnet as my default" }),
    );
    await waitFor(() =>
      expect(header()).toHaveTextContent("current: Sonnet — Studio default"),
    );
    expect(
      screen.getByRole("img", { name: "Your default for new chats" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBe(
      '{"modelId":"claude-sonnet","providerId":"anthropic"}',
    );
    // The action flips to clear for the highlighted default row.
    fireEvent.click(screen.getByRole("button", { name: "Clear my default" }));
    await waitFor(() =>
      expect(header()).toHaveTextContent("current: Sonnet — your pick"),
    );
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBeNull();
  });

  it("Shift+Enter marks the highlighted row as the default instead of picking it", async () => {
    const user = userEvent.setup();
    const onSwitchModel = vi.fn();
    render(
      <ModelEffortSelector
        models={models}
        onSwitchModel={onSwitchModel}
        onSwitchEffort={() => {}}
        currentModelId="gpt-5"
        currentEffort=""
      />,
    );
    const input = await openModels(user);
    // The highlight starts on the current model.
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    await waitFor(() =>
      expect(window.localStorage.getItem(DEFAULT_KEY)).toBe(
        '{"modelId":"gpt-5","providerId":"openai"}',
      ),
    );
    expect(onSwitchModel).not.toHaveBeenCalled();
    // The menu stays open for further filtering.
    expect(
      screen.getByRole("combobox", { name: FILTER_MODELS_LABEL }),
    ).toBeInTheDocument();
  });

  it("draft: an untouched picker starts on the Studio default and reports the resolved pick", async () => {
    window.localStorage.setItem(
      DEFAULT_KEY,
      '{"modelId":"claude-sonnet","providerId":"anthropic"}',
    );
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(
      <ModelEffortSelector
        models={models}
        onModelChange={onModelChange}
        onEffortChange={() => {}}
      />,
    );
    // The trigger shows the default, not "Default model".
    expect(trigger()).toHaveAttribute("title", "Sonnet · Auto");
    await openModels(user);
    expect(header()).toHaveTextContent("current: Sonnet — Studio default");
    expect(screen.getByRole("option", { name: /Sonnet/ })).toHaveAttribute(
      "data-current",
      "true",
    );
    // Picking the auto row is an explicit pick for the daemon default.
    fireEvent.click(screen.getByRole("option", { name: /Default model/ }));
    expect(onModelChange).toHaveBeenCalledWith("");
    await waitFor(() =>
      expect(trigger()).toHaveAttribute("title", "Default model · Auto"),
    );
    await openModels(user);
    expect(header()).toHaveTextContent("current: Default model — your pick");
    // Reset returns to untouched (null), so the Studio default applies again.
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: FILTER_MODELS_LABEL }),
      { key: "Escape" },
    );
    await user.click(trigger());
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Reset to default" }),
    );
    expect(onModelChange).toHaveBeenLastCalledWith(null);
    await waitFor(() =>
      expect(trigger()).toHaveAttribute("title", "Sonnet · Auto"),
    );
  });

  it("draft: a Studio default the inventory lacks is not applied — the daemon default stands", async () => {
    window.localStorage.setItem(
      DEFAULT_KEY,
      '{"modelId":"gone","providerId":"nowhere"}',
    );
    const user = userEvent.setup();
    render(
      <ModelEffortSelector
        models={models}
        onModelChange={() => {}}
        onEffortChange={() => {}}
      />,
    );
    expect(trigger()).toHaveAttribute("title", "Default model · Auto");
    await openModels(user);
    expect(header()).toHaveTextContent(
      "current: Default model — daemon default",
    );
    // No row wears the star, but the stale default can still be cleared.
    expect(
      screen.queryByRole("img", { name: "Your default for new chats" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear my default" }));
    await waitFor(() =>
      expect(window.localStorage.getItem(DEFAULT_KEY)).toBeNull(),
    );
  });
});
