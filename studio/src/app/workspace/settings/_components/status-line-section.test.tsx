import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STATUS_LINE,
  STATUS_LINE_KEY,
} from "@/lib/statusline/preferences";
import { memoryStorage } from "@/test/memory-storage";
import { StatusLineSection } from "./status-line-section";

/**
 * Settings → Status line: both lanes' three templates are editable text
 * fields with a live preview over sample facts, the fact chips insert a
 * placeholder at the caret of the focused template, the interval clamps, the
 * JSON import refuses (and names) problems instead of repairing them, and
 * Reset asks first.
 */

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(async () => true),
}));
vi.mock("@/lib/clipboard", () => ({ copyToClipboard }));

const stored = () => {
  const raw = window.localStorage.getItem(STATUS_LINE_KEY);
  return raw ? JSON.parse(raw) : null;
};

const field = (name: string) =>
  screen.getByRole("textbox", { name }) as HTMLTextAreaElement;

describe("StatusLineSection", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("lists both lanes' templates with their defaults and a sample-fact preview", () => {
    render(<StatusLineSection />);
    expect(
      screen.getByRole("heading", { name: "Status line" }),
    ).toBeInTheDocument();
    expect(field("Header full template")).toHaveValue("");
    expect(field("Header compact template")).toHaveValue("");
    expect(field("Header minimal template")).toHaveValue("");
    expect(field("Footer full template")).toHaveValue("{{context_meter}}");
    expect(field("Footer compact template")).toHaveValue("{{context_meter}}");
    expect(field("Footer minimal template")).toHaveValue("{{context_bar}}");

    expect(
      screen.getByTestId("status-line-header-full-preview"),
    ).toHaveTextContent("nothing — the lane stays hidden");
    expect(
      screen.getByTestId("status-line-footer-full-preview"),
    ).toHaveTextContent("gpt-5.1 · High");
    expect(
      screen.getByTestId("status-line-footer-full-preview"),
    ).toHaveTextContent("84.0k / 200.0k · 42%");
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply JSON" })).toBeDisabled();
    expect(stored()).toBeNull();
  });

  it("stores a typed template in this browser and previews it as text", () => {
    render(<StatusLineSection />);
    fireEvent.change(field("Footer full template"), {
      target: {
        value: "<b>{{model}}</b> {{context_percent}} of {{context_window}}",
      },
    });
    expect(stored()).toEqual({
      header: DEFAULT_STATUS_LINE.header,
      footer: {
        ...DEFAULT_STATUS_LINE.footer,
        full: "<b>{{model}}</b> {{context_percent}} of {{context_window}}",
      },
      intervalSeconds: 60,
    });
    const preview = screen.getByTestId("status-line-footer-full-preview");
    expect(preview).toHaveTextContent("<b>gpt-5.1</b> ~42% of 200.0k");
    expect(preview.querySelector("b")).toBeNull();
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
  });

  it("inserts a fact chip at the caret of the focused template", async () => {
    const user = userEvent.setup();
    render(<StatusLineSection />);
    const headerChips = screen.getByRole("group", {
      name: "Facts for the Header lane",
    });
    // Nothing focused yet: chips target the Full template.
    await user.click(
      within(headerChips).getByRole("button", {
        name: "Insert {{model}} into the Full Header template",
      }),
    );
    expect(field("Header full template")).toHaveValue("{{model}}");
    expect(stored()?.header.full).toBe("{{model}}");

    // Focus Compact; the chip row follows the focused field.
    await user.click(field("Header compact template"));
    await user.click(
      within(headerChips).getByRole("button", {
        name: "Insert {{clock}} into the Compact Header template",
      }),
    );
    expect(field("Header compact template")).toHaveValue("{{clock}}");
    expect(field("Header full template")).toHaveValue("{{model}}");
    expect(
      screen.getByTestId("status-line-header-compact-preview"),
    ).toHaveTextContent("09:41");
  });

  it("clamps the refresh interval when committed", () => {
    render(<StatusLineSection />);
    const input = screen.getByLabelText("Refresh interval (seconds)");
    expect(input).toHaveValue(60);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(stored()?.intervalSeconds).toBe(1);
    expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(stored()?.intervalSeconds).toBe(3600);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(3600);
  });

  it("refuses a malformed JSON import with the reasons, and applies a clean one", () => {
    render(<StatusLineSection />);
    const json = screen.getByLabelText("Copy to another browser");
    expect(json).toHaveValue(JSON.stringify(DEFAULT_STATUS_LINE, null, 2));

    fireEvent.change(json, {
      target: {
        value: JSON.stringify({ zzz: 1, header: { full: "{{model}}" } }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      'Not applied: "zzz" is not a known setting.',
    );
    expect(stored()).toBeNull();

    fireEvent.change(json, {
      target: {
        value: JSON.stringify({
          header: { full: "{{model}}" },
          intervalSeconds: 5,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(stored()).toEqual({
      header: { full: "{{model}}", compact: "", minimal: "" },
      footer: DEFAULT_STATUS_LINE.footer,
      intervalSeconds: 5,
    });
    expect(field("Header full template")).toHaveValue("{{model}}");
    expect(toast.success).toHaveBeenCalledWith("Status line settings applied");

    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('"intervalSeconds": 5'),
      "Status line settings",
    );
  });

  it("Reset asks first, then puts the defaults back", async () => {
    const user = userEvent.setup();
    render(<StatusLineSection />);
    fireEvent.change(field("Header full template"), {
      target: { value: "{{model}}" },
    });
    expect(stored()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Reset the status line?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Reset" }));

    expect(stored()).toBeNull();
    expect(field("Header full template")).toHaveValue("");
    expect(toast.success).toHaveBeenCalledWith("Status line reset to defaults");
  });
});
