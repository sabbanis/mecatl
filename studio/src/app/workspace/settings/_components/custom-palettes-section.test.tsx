import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteProvider } from "@/components/palette-provider";
import {
  CUSTOM_PALETTES_KEY,
  loadOperatorPalettes,
  resetCustomPalettesForTests,
} from "@/lib/custom-palettes";
import { EXAMPLE_PALETTE_DOCUMENT } from "@/lib/palette-schema";
import { memoryStorage } from "@/test/memory-storage";
import { CustomPalettesSection } from "./custom-palettes-section";

const EMBER = JSON.stringify({
  name: "ember",
  label: "Ember",
  palette: { brand: "#ff6600" },
  dark: { brand: "#ff9966" },
});

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

/** Mounts the section and lets the one-per-page operator fetch settle. */
async function renderSection() {
  const view = render(
    <PaletteProvider>
      <CustomPalettesSection />
    </PaletteProvider>,
  );
  await act(async () => {
    await loadOperatorPalettes();
  });
  return view;
}

const paletteList = () => screen.getByRole("list", { name: "Custom palettes" });

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  resetCustomPalettesForTests();
  stubFetch({ palettes: [] });
});
afterEach(() => {
  resetCustomPalettesForTests();
  document.documentElement.removeAttribute("data-palette");
});

/**
 * Settings → Personalize → Custom palettes is the web form of mecatui's
 * custom {name, palette} JSON themes: paste or upload a document, it joins
 * the picker at once (this browser only), operator palettes are listed
 * read-only, and every refusal is the validator's own sentence.
 */
describe("CustomPalettesSection", () => {
  it("starts empty and explains the format with the allowed tokens", async () => {
    await renderSection();
    expect(screen.getByText("No custom palettes yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Document format and allowed tokens"),
    ).toBeInTheDocument();
    const tokens = screen.getByRole("list", { name: "Allowed tokens" });
    expect(within(tokens).getByText("brand")).toBeInTheDocument();
    expect(within(tokens).getByText("shell-gradient-end")).toBeInTheDocument();
    expect(screen.getByText(/8 of 8 slots left/)).toBeInTheDocument();
  });

  it("adds a pasted document, stores it, and offers Use and Remove", async () => {
    const user = userEvent.setup();
    await renderSection();
    const textarea = screen.getByLabelText("Palette document (JSON)");
    await user.click(textarea);
    await user.paste(EMBER);
    await user.click(screen.getByRole("button", { name: "Add palette" }));

    const list = paletteList();
    expect(within(list).getByText("Ember")).toBeInTheDocument();
    expect(
      within(list).getByText("custom:ember · 1 token · 1 dark override"),
    ).toBeInTheDocument();
    expect(within(list).getByText("this browser")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
    expect(
      JSON.parse(window.localStorage.getItem(CUSTOM_PALETTES_KEY) ?? "null"),
    ).toEqual([
      {
        name: "ember",
        label: "Ember",
        palette: { brand: "#ff6600" },
        dark: { brand: "#ff9966" },
      },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Added palette "Ember"');
    expect(screen.getByText(/7 of 8 slots left/)).toBeInTheDocument();

    // Use applies it to <html> at once — no reload.
    await user.click(screen.getByRole("button", { name: "Use Ember" }));
    expect(document.documentElement.getAttribute("data-palette")).toBe(
      "custom:ember",
    );
    expect(
      screen.getByRole("button", { name: "Ember is the active palette" }),
    ).toBeDisabled();

    // Remove takes it out of storage; the active choice resolves back to
    // the default rather than pointing at a palette that no longer exists.
    await user.click(screen.getByRole("button", { name: "Remove Ember" }));
    expect(screen.getByText("No custom palettes yet.")).toBeInTheDocument();
    expect(window.localStorage.getItem(CUSTOM_PALETTES_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute("data-palette")).toBe(false);
  });

  it("shows the validator's error inline and stores nothing", async () => {
    const user = userEvent.setup();
    await renderSection();
    const textarea = screen.getByLabelText("Palette document (JSON)");
    await user.click(textarea);
    await user.paste(
      '{"name":"x","palette":{"brand":"url(https://evil.example)"}}',
    );
    await user.click(screen.getByRole("button", { name: "Add palette" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      '"palette.brand" is not a supported colour',
    );
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", alert.id);
    expect(window.localStorage.getItem(CUSTOM_PALETTES_KEY)).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();

    // An empty submit says what to do instead of silently doing nothing.
    await user.clear(textarea);
    await user.click(screen.getByRole("button", { name: "Add palette" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Paste a palette document first.",
    );
  });

  it("accepts an uploaded .json file and refuses an oversize one", async () => {
    const user = userEvent.setup();
    await renderSection();
    const input = screen.getByLabelText("Upload a palette file");
    await user.upload(
      input,
      new File([EMBER], "ember.json", { type: "application/json" }),
    );
    expect(await within(paletteList()).findByText("Ember")).toBeInTheDocument();

    await user.upload(
      input,
      new File([" ".repeat(9000)], "big.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "big.json is larger than 8 KiB.",
    );
  });

  it("lists operator palettes read-only and lets the user apply one", async () => {
    stubFetch({
      palettes: [
        { name: "midnight", label: "Midnight", palette: { brand: "#4f7cff" } },
      ],
    });
    const user = userEvent.setup();
    await renderSection();
    const list = paletteList();
    expect(within(list).getByText("Midnight")).toBeInTheDocument();
    expect(within(list).getByText("operator · read-only")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Midnight" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use Midnight" }));
    expect(document.documentElement.getAttribute("data-palette")).toBe(
      "custom:midnight",
    );
  });

  it("says when the operator list could not be read", async () => {
    stubFetch({ error: "boom" }, 500);
    await renderSection();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Operator palettes could not be loaded (HTTP 500).",
    );
    expect(screen.getByText("No custom palettes yet.")).toBeInTheDocument();
  });

  it("fills the editor with the example document, which validates", async () => {
    const user = userEvent.setup();
    await renderSection();
    await user.click(screen.getByRole("button", { name: "Insert example" }));
    expect(screen.getByLabelText("Palette document (JSON)")).toHaveValue(
      EXAMPLE_PALETTE_DOCUMENT,
    );
    await user.click(screen.getByRole("button", { name: "Add palette" }));
    expect(within(paletteList()).getByText("Midnight")).toBeInTheDocument();
  });
});
