import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { PREFERENCES_FORMAT } from "@/lib/preferences-file";
import { memoryStorage } from "@/test/memory-storage";
import { PreferencesFileSection } from "./preferences-file-section";

function prefsFile(preferences: Record<string, unknown>, format?: unknown) {
  return new File(
    [
      JSON.stringify({
        format: format === undefined ? PREFERENCES_FORMAT : format,
        exportedAt: "2026-09-17T10:00:00.000Z",
        preferences,
      }),
    ],
    "prefs.json",
    { type: "application/json" },
  );
}

const importInput = () => screen.getByLabelText("Import a preferences file");

let storage: Storage;
let reload: Mock<() => void>;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  reload = vi.fn<() => void>();
});
afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

/**
 * Settings → Personalize → Preferences file: the portable form of every
 * browser-local preference. Export downloads what is set; Import shows
 * exactly what would be set, cleared and refused BEFORE any write, and only
 * "Replace and reload" applies it and reloads.
 */
describe("PreferencesFileSection", () => {
  it("counts the preferences set in this browser", async () => {
    storage.setItem("theme", "dark");
    storage.setItem("mecatl-studio.agent-name", "Astra");
    storage.setItem("mecatl-studio.thread-sessions", "{}"); // state, not counted
    render(<PreferencesFileSection reload={reload} />);
    expect(
      await screen.findByText(
        "Downloads the 2 preferences set in this browser as JSON.",
      ),
    ).toBeInTheDocument();
  });

  it("exports the set preferences as a downloadable JSON file", async () => {
    const user = userEvent.setup();
    storage.setItem("theme", "dark");
    storage.setItem("mecatl-studio.ui-scale", "1.1");
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return "blob:prefs";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<PreferencesFileSection reload={reload} />);
    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs).toHaveLength(1);
    const doc = JSON.parse(await blobs[0].text());
    expect(doc.format).toBe(PREFERENCES_FORMAT);
    expect(doc.preferences).toEqual({
      theme: "dark",
      "mecatl-studio.ui-scale": "1.1",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Exported 2 preferences to mecatl-studio-preferences.json",
    );
    click.mockRestore();
  });

  it("previews set / cleared / refused keys before writing, then replaces and reloads", async () => {
    const user = userEvent.setup();
    storage.setItem("mecatl-studio.ui-scale", "1.2"); // not in file → cleared
    storage.setItem("mecatl-studio.launch-target", "latest"); // refused → kept
    storage.setItem("theme", "light"); // replaced

    render(<PreferencesFileSection reload={reload} />);
    await user.upload(
      importInput(),
      prefsFile({
        theme: "dark",
        "mecatl-studio.agent-name": "Astra",
        "mecatl-studio.launch-target": "sideways",
        bogus: "1",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Replace this browser’s preferences?",
    });
    expect(dialog).toHaveTextContent("From prefs.json, exported");
    const toSet = within(dialog).getByRole("list", {
      name: "Preferences to set",
    });
    expect(
      within(toSet)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Theme", "Agent name"]);
    const toClear = within(dialog).getByRole("list", {
      name: "Preferences to clear",
    });
    expect(within(toClear).getByText("Interface scale")).toBeInTheDocument();
    const refused = within(dialog).getByRole("list", {
      name: "Preferences not imported",
    });
    expect(
      within(refused)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      'mecatl-studio.launch-target — must be one of "draft", "latest"',
      "bogus — not a Studio preference",
    ]);

    // Nothing written yet.
    expect(storage.getItem("theme")).toBe("light");
    expect(storage.getItem("mecatl-studio.agent-name")).toBeNull();
    expect(reload).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "Replace and reload" }),
    );
    expect(storage.getItem("theme")).toBe("dark");
    expect(storage.getItem("mecatl-studio.agent-name")).toBe("Astra");
    expect(storage.getItem("mecatl-studio.ui-scale")).toBeNull();
    expect(storage.getItem("mecatl-studio.launch-target")).toBe("latest");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cancelling the preview writes nothing", async () => {
    const user = userEvent.setup();
    render(<PreferencesFileSection reload={reload} />);
    await user.upload(importInput(), prefsFile({ theme: "dark" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem("theme")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("disables the confirm when the file matches this browser", async () => {
    const user = userEvent.setup();
    storage.setItem("theme", "dark");
    render(<PreferencesFileSection reload={reload} />);
    await user.upload(importInput(), prefsFile({ theme: "dark" }));
    const dialog = await screen.findByRole("dialog");
    // The file's value replaces the same value: a write, so still enabled…
    expect(
      within(dialog).getByRole("button", { name: "Replace and reload" }),
    ).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    // …but a file carrying only a refused key changes nothing.
    await user.upload(importInput(), prefsFile({ theme: "sepia" }));
    const second = await screen.findByRole("dialog");
    expect(
      within(second).getByText(
        "Nothing to change — this file matches this browser.",
      ),
    ).toBeInTheDocument();
    expect(
      within(second).getByRole("button", { name: "Replace and reload" }),
    ).toBeDisabled();
  });

  it("refuses a file with the wrong format outright, with no preview", async () => {
    const user = userEvent.setup();
    render(<PreferencesFileSection reload={reload} />);
    await user.upload(importInput(), prefsFile({ theme: "dark" }, "other/1"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      'Not imported — prefs.json: not a Studio preferences file — "format" is "other/1"',
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem("theme")).toBeNull();

    await user.upload(
      importInput(),
      new File(["{oops"], "broken.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not imported — broken.json: is not valid JSON",
    );
  });
});
