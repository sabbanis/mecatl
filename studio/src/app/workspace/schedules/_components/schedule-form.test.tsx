import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PERMISSION_MODES, type ScheduleSpecDraft } from "@/lib/protocol";
import {
  draftFromForm,
  emptyScheduleForm,
  formFromDraft,
  ScheduleFormFields,
  type ScheduleFormValue,
  WRITE_ACCESS_OFF_NOTE,
  WRITE_ACCESS_ON_NOTE,
} from "./schedule-form";

/**
 * Pins the write-access opt-in (the TUI form's y/n mutating toggle): the
 * mode/mutating pairing the form emits per state, how a stored spec seeds
 * it, and the switch + permission-mode picker that let a user change it.
 */

const SWITCH_NAME = "Allow file and shell writes";

function makeDraft(overrides: Partial<ScheduleSpecDraft>): ScheduleSpecDraft {
  return {
    name: "nightly-digest",
    prompt: "Summarise the day",
    trigger: { kind: "cron", cron: "0 9 * * *", timezone: "" },
    profile: "",
    mode: PERMISSION_MODES.PERMISSION_MODE_PLAN,
    mutating: false,
    maxFires: 0,
    limits: { maxTurns: 0, maxToolCalls: 0, maxConsecutiveFailures: 0 },
    oneShotRetry: false,
    oneShotMaxRetries: 0,
    ...overrides,
  };
}

describe("draftFromForm write access", () => {
  it("defaults to plan mode with mutating off", () => {
    const draft = draftFromForm(emptyScheduleForm());
    expect(draft.mode).toBe(PERMISSION_MODES.PERMISSION_MODE_PLAN);
    expect(draft.mutating).toBe(false);
  });

  it("couples the opt-in with accept-edits mode", () => {
    const draft = draftFromForm({
      ...emptyScheduleForm(),
      allowWrites: true,
      writeMode: "accept_edits",
    });
    expect(draft.mode).toBe(PERMISSION_MODES.PERMISSION_MODE_ACCEPT_EDITS);
    expect(draft.mutating).toBe(true);
  });

  it("couples the opt-in with default mode when picked", () => {
    const draft = draftFromForm({
      ...emptyScheduleForm(),
      allowWrites: true,
      writeMode: "default",
    });
    expect(draft.mode).toBe(PERMISSION_MODES.PERMISSION_MODE_DEFAULT);
    expect(draft.mutating).toBe(true);
  });

  it("never emits the pairing the daemon rejects (non-mutating outside plan)", () => {
    // The writeMode is ignored while the opt-in is off: plan mode wins.
    const draft = draftFromForm({
      ...emptyScheduleForm(),
      allowWrites: false,
      writeMode: "default",
    });
    expect(draft.mode).toBe(PERMISSION_MODES.PERMISSION_MODE_PLAN);
    expect(draft.mutating).toBe(false);
  });
});

describe("formFromDraft write access", () => {
  it("seeds a mutating default-mode spec as writes on + default", () => {
    const value = formFromDraft(
      makeDraft({
        mutating: true,
        mode: PERMISSION_MODES.PERMISSION_MODE_DEFAULT,
      }),
    );
    expect(value.allowWrites).toBe(true);
    expect(value.writeMode).toBe("default");
  });

  it("seeds a mutating accept-edits spec as writes on + accept edits", () => {
    const value = formFromDraft(
      makeDraft({
        mutating: true,
        mode: PERMISSION_MODES.PERMISSION_MODE_ACCEPT_EDITS,
      }),
    );
    expect(value.allowWrites).toBe(true);
    expect(value.writeMode).toBe("accept_edits");
  });

  it("seeds a plan-mode read-only spec as writes off", () => {
    const value = formFromDraft(
      makeDraft({
        mutating: false,
        mode: PERMISSION_MODES.PERMISSION_MODE_PLAN,
      }),
    );
    expect(value.allowWrites).toBe(false);
  });

  it("round-trips a mutating spec through the form unchanged", () => {
    const stored = makeDraft({
      mutating: true,
      mode: PERMISSION_MODES.PERMISSION_MODE_DEFAULT,
    });
    const back = draftFromForm(formFromDraft(stored), stored);
    expect(back.mode).toBe(stored.mode);
    expect(back.mutating).toBe(stored.mutating);
  });
});

/** Controlled wrapper: the real dialog folds patches into state the same way. */
function Harness({
  initial,
  onChange,
}: {
  initial?: Partial<ScheduleFormValue>;
  onChange?: (patch: Partial<ScheduleFormValue>) => void;
}) {
  const [value, setValue] = useState<ScheduleFormValue>(() => ({
    ...emptyScheduleForm(),
    ...initial,
  }));
  return (
    <ScheduleFormFields
      value={value}
      onChange={(patch) => {
        onChange?.(patch);
        setValue((v) => ({ ...v, ...patch }));
      }}
    />
  );
}

describe("ScheduleFormFields write access control", () => {
  it("renders the switch off by default with the read-only note and no mode picker", () => {
    render(<Harness />);
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByText(WRITE_ACCESS_OFF_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(WRITE_ACCESS_ON_NOTE)).toBeNull();
    expect(
      screen.queryByRole("combobox", { name: "Permission mode" }),
    ).toBeNull();
  });

  it("turning the switch on patches allowWrites, swaps the note and reveals the mode picker", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const writes = screen.getByRole("switch", { name: SWITCH_NAME });
    await user.click(writes);

    expect(onChange).toHaveBeenCalledWith({ allowWrites: true });
    expect(writes).toBeChecked();
    expect(screen.getByText(WRITE_ACCESS_ON_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(WRITE_ACCESS_OFF_NOTE)).toBeNull();
    // Accept edits is the default write mode; the picker shows it by name.
    expect(
      screen.getByRole("combobox", { name: "Permission mode" }),
    ).toHaveTextContent("Accept edits");
  });

  it("picking Default in the mode picker patches writeMode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ allowWrites: true }} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Permission mode" }));
    await user.click(
      await screen.findByRole("option", {
        name: "Default — standard permission rules apply",
      }),
    );

    expect(onChange).toHaveBeenCalledWith({ writeMode: "default" });
    expect(
      screen.getByRole("combobox", { name: "Permission mode" }),
    ).toHaveTextContent("Default");
  });

  it("turning the switch back off hides the mode picker and restores the read-only note", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ allowWrites: true }} onChange={onChange} />);

    const writes = screen.getByRole("switch", { name: SWITCH_NAME });
    expect(writes).toBeChecked();
    await user.click(writes);

    expect(onChange).toHaveBeenCalledWith({ allowWrites: false });
    expect(writes).not.toBeChecked();
    expect(
      screen.queryByRole("combobox", { name: "Permission mode" }),
    ).toBeNull();
    expect(screen.getByText(WRITE_ACCESS_OFF_NOTE)).toBeInTheDocument();
  });

  it("is keyboard operable: Space toggles the focused switch", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const writes = screen.getByRole("switch", { name: SWITCH_NAME });
    writes.focus();
    expect(writes).toHaveFocus();
    await user.keyboard(" ");
    expect(writes).toBeChecked();
    await user.keyboard(" ");
    expect(writes).not.toBeChecked();
  });
});
