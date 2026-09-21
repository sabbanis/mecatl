// SPDX-License-Identifier: Apache-2.0

import type { CreateScheduleData, ListSchedulesResponse } from "@mecatl-studio/contracts/generated";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  builderToCron,
  type CronIntervalUnit,
  type CronRepeat,
  cronToBuilder,
  describeCron,
  ordinal,
} from "./cron-builder";
import {
  compileSchedulePhrase,
  looksLikeCron,
  oneShotInstant,
  type SchedulePhraseResult,
  toLocalDateTimeInput,
} from "./schedule-phrase";

type Schedule = ListSchedulesResponse["items"][number];
type ScheduleBody = CreateScheduleData["body"];

/** What the phrase input last produced — drives the line under it. */
type PhraseOutcome = SchedulePhraseResult | { cron: string; kind: "raw-cron" } | { kind: "none" };

const NO_PHRASE: PhraseOutcome = { kind: "none" };

const PHRASE_PLACEHOLDER = "every 30 minutes · daily at 9am · next monday 3pm · in 2 hours";
const PHRASE_HINT = 'Not recognised — try "every weekday at 9am" or a cron expression';

/** The plain-English preview of what a phrase compiled to. */
function describePhraseOutcome(outcome: PhraseOutcome): string | null {
  if (outcome.kind === "none") return null;
  if (outcome.kind === "one-shot") return `Once at ${new Date(outcome.at).toLocaleString()}`;
  // A five-field fallback the describer cannot read is still a cron; say so
  // rather than echo the raw string bare.
  const described = describeCron(outcome.cron);
  return outcome.kind === "raw-cron" && described === outcome.cron
    ? `Cron expression ${outcome.cron}`
    : described;
}

interface FormValue {
  allowWrites: boolean;
  cron: string;
  maxFires: string;
  name: string;
  oneShotAt: string;
  /** The schedule's original one-shot instant, re-sent unchanged while the wall clock is unedited. */
  oneShotOriginal: string;
  oneShotMaxRetries: string;
  oneShotRetry: boolean;
  profile: "all" | "noFilesystem";
  prompt: string;
  timezone: string;
  triggerKind: "cron" | "once";
  writeMode: "acceptEdits" | "default";
}

export function ScheduleForm({
  schedule,
  onCancel,
  onSubmit,
}: {
  schedule?: Schedule;
  onCancel: () => void;
  onSubmit: (body: ScheduleBody) => Promise<void>;
}) {
  const [value, setValue] = useState<FormValue>(() => valueFromSchedule(schedule));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  // The phrase is an authoring aid: it compiles INTO value.cron/oneShotAt,
  // which stay the wire truth. Its text and preview are local; a successful
  // compile bumps phraseVersion, which remounts CronFields so its Custom
  // pick re-derives from the new string instead of sticking.
  const [phrase, setPhrase] = useState("");
  const [phraseOutcome, setPhraseOutcome] = useState<PhraseOutcome>(NO_PHRASE);
  const [phraseVersion, setPhraseVersion] = useState(0);

  /**
   * Trigger edits made through the structured controls (tabs, cron builder,
   * the one-shot date/time) consume the phrase: left in place, its text
   * would describe a trigger the form no longer holds.
   */
  function changeTrigger(patch: Partial<FormValue>) {
    if (phrase) {
      setPhrase("");
      setPhraseOutcome(NO_PHRASE);
    }
    setValue((current) => ({ ...current, ...patch }));
  }

  function handlePhrase(text: string) {
    setPhrase(text);
    const compiled = compileSchedulePhrase(text);
    let outcome: PhraseOutcome = NO_PHRASE;
    let patch: Partial<FormValue> | null = null;
    if (compiled?.kind === "cron") {
      outcome = compiled;
      patch = { cron: compiled.cron, triggerKind: "cron" };
    } else if (compiled?.kind === "one-shot") {
      outcome = compiled;
      patch = { oneShotAt: toLocalDateTimeInput(compiled.at), triggerKind: "once" };
    } else if (looksLikeCron(text)) {
      // The unmatched five-field fallback: it IS the cron, verbatim; the
      // builder lands on Custom (or the shape it happens to parse as).
      const cron = text.trim();
      outcome = { cron, kind: "raw-cron" };
      patch = { cron, triggerKind: "cron" };
    }
    setPhraseOutcome(outcome);
    if (patch) {
      setPhraseVersion((v) => v + 1);
      setValue((current) => ({ ...current, ...patch }));
    }
  }

  const phrasePreview = describePhraseOutcome(phraseOutcome);
  const phraseNote = phrasePreview ?? (phrase.trim() ? PHRASE_HINT : null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await onSubmit(bodyFromValue(value));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{schedule ? "Edit scheduled task" : "Schedule a task"}</DialogTitle>
            <DialogDescription>
              Mecatl validates the cadence and runs the prompt unattended.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <Field label="Name">
              <Input
                disabled={Boolean(schedule)}
                onChange={(event) => setValue({ ...value, name: event.target.value })}
                placeholder="daily-summary"
                required
                value={value.name}
              />
            </Field>
            <Field label="Prompt">
              <Textarea
                onChange={(event) => setValue({ ...value, prompt: event.target.value })}
                placeholder="Summarize the latest project activity."
                required
                rows={4}
                value={value.prompt}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Trigger</legend>
              <Field label="Describe the schedule">
                <Input
                  aria-describedby={phraseNote ? "schedule-phrase-note" : undefined}
                  autoComplete="off"
                  className="font-normal"
                  onChange={(event) => handlePhrase(event.target.value)}
                  placeholder={PHRASE_PLACEHOLDER}
                  value={phrase}
                />
                {phraseNote && (
                  <p
                    className="text-xs font-normal text-muted-foreground"
                    id="schedule-phrase-note"
                  >
                    {phraseNote}
                  </p>
                )}
              </Field>
              <div className="mt-3 grid grid-cols-2 rounded-lg bg-muted p-1">
                {(["cron", "once"] as const).map((kind) => (
                  <button
                    className={`h-8 rounded-md text-sm ${value.triggerKind === kind ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                    key={kind}
                    onClick={() => changeTrigger({ triggerKind: kind })}
                    type="button"
                  >
                    {kind === "cron" ? "Recurring" : "Run once"}
                  </button>
                ))}
              </div>
            </fieldset>

            {value.triggerKind === "cron" ? (
              <div className="space-y-4">
                <CronFields
                  cron={value.cron}
                  key={phraseVersion}
                  onChange={(cron) => changeTrigger({ cron })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Timezone">
                    <Input
                      onChange={(event) => setValue({ ...value, timezone: event.target.value })}
                      placeholder="UTC"
                      value={value.timezone}
                    />
                  </Field>
                  <Field label="Maximum runs (0 = unlimited)">
                    <Input
                      min="0"
                      onChange={(event) => setValue({ ...value, maxFires: event.target.value })}
                      type="number"
                      value={value.maxFires}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Run at">
                  <Input
                    onChange={(event) => changeTrigger({ oneShotAt: event.target.value })}
                    required
                    type="datetime-local"
                    value={value.oneShotAt}
                  />
                  {resolvedOneShot(value.oneShotAt, value.oneShotOriginal) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saves as {resolvedOneShot(value.oneShotAt, value.oneShotOriginal)}
                    </p>
                  ) : null}
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={value.oneShotRetry}
                    onChange={(event) => setValue({ ...value, oneShotRetry: event.target.checked })}
                    type="checkbox"
                  />
                  Retry if the run fails
                </label>
                {value.oneShotRetry && (
                  <Field label="Maximum retries">
                    <Input
                      min="0"
                      onChange={(event) =>
                        setValue({ ...value, oneShotMaxRetries: event.target.value })
                      }
                      type="number"
                      value={value.oneShotMaxRetries}
                    />
                  </Field>
                )}
              </div>
            )}

            <div className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={value.allowWrites}
                  onChange={(event) => setValue({ ...value, allowWrites: event.target.checked })}
                  type="checkbox"
                />
                Allow this task to make changes
              </label>
              {value.allowWrites && (
                <select
                  className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={(event) =>
                    setValue({ ...value, writeMode: event.target.value as FormValue["writeMode"] })
                  }
                  value={value.writeMode}
                >
                  <option value="acceptEdits">Accept edits automatically</option>
                  <option value="default">Ask when approval is needed</option>
                </select>
              )}
            </div>

            <Field label="Tool profile">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                onChange={(event) =>
                  setValue({ ...value, profile: event.target.value as FormValue["profile"] })
                }
                value={value.profile}
              >
                <option value="all">All</option>
                <option value="noFilesystem">No filesystem</option>
              </select>
              <p className="text-xs font-normal text-muted-foreground">
                {value.profile === "noFilesystem"
                  ? "No file or shell tools; other tools stay available."
                  : "The agent can use every tool, including file and shell access."}
              </p>
            </Field>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="mt-5">
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={submitting} type="submit" variant="action">
              {submitting ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <fieldset className="block space-y-2 text-sm font-medium">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

const REPEAT_OPTIONS: Array<{ label: string; value: CronRepeat }> = [
  { label: "Daily", value: "daily" },
  { label: "Weekdays", value: "weekdays" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Every…", value: "interval" },
  { label: "Custom", value: "custom" },
];

const WEEKDAY_OPTIONS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
];

const MONTHDAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

const INTERVAL_UNIT_OPTIONS: Array<{ label: string; value: CronIntervalUnit }> = [
  { label: "Minutes", value: "minutes" },
  { label: "Hours", value: "hours" },
];

/** The daemon-independent step ceiling per unit (a cron field's own range). */
const INTERVAL_MAX: Record<CronIntervalUnit, number> = { hours: 23, minutes: 59 };

const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

/**
 * The structured cron editor: a "Repeat" picker plus the controls that shape
 * implies (weekday / day of month / interval step, and a time for anything
 * but Every…), falling back to the raw cron string under "Custom". Mirrors
 * Studio's cron builder over the same `cron-builder.ts` derivation.
 */
function CronFields({ cron, onChange }: { cron: string; onChange: (cron: string) => void }) {
  const parsed = cronToBuilder(cron);
  const [customPicked, setCustomPicked] = useState(() => parsed.repeat === "custom");
  const repeat: CronRepeat = customPicked ? "custom" : parsed.repeat;
  // The interval step as typed, while the field has focus: a controlled
  // number input snaps back on every keystroke otherwise.
  const [everyDraft, setEveryDraft] = useState<string | null>(null);

  function rebuild(patch: {
    every?: number;
    monthday?: number;
    repeat?: Exclude<CronRepeat, "custom">;
    time?: string;
    unit?: CronIntervalUnit;
    weekday?: number;
  }) {
    const next = { ...parsed, ...patch };
    if (next.repeat === "custom") return;
    onChange(builderToCron({ ...next, repeat: next.repeat }));
  }

  const cronPreview = describeCron(cron.trim());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[130px] flex-1 space-y-2 text-sm font-medium">
          <label htmlFor="schedule-repeat">Repeat</label>
          <select
            className={selectClass}
            id="schedule-repeat"
            onChange={(event) => {
              const next = event.target.value as CronRepeat;
              if (next === "custom") {
                setCustomPicked(true);
                return;
              }
              setCustomPicked(false);
              rebuild({ repeat: next });
            }}
            value={repeat}
          >
            {REPEAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {repeat === "weekly" && (
          <div className="min-w-[130px] flex-1 space-y-2 text-sm font-medium">
            <label htmlFor="schedule-weekday">On</label>
            <select
              className={selectClass}
              id="schedule-weekday"
              onChange={(event) => rebuild({ weekday: Number(event.target.value) })}
              value={parsed.weekday}
            >
              {WEEKDAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {repeat === "monthly" && (
          <div className="min-w-[130px] flex-1 space-y-2 text-sm font-medium">
            <label htmlFor="schedule-monthday">On the</label>
            <select
              className={selectClass}
              id="schedule-monthday"
              onChange={(event) => rebuild({ monthday: Number(event.target.value) })}
              value={parsed.monthday}
            >
              {MONTHDAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {ordinal(day)}
                </option>
              ))}
            </select>
          </div>
        )}

        {repeat === "interval" && (
          <>
            <div className="w-[90px] space-y-2 text-sm font-medium">
              <label htmlFor="schedule-interval-every">Every</label>
              <Input
                id="schedule-interval-every"
                inputMode="numeric"
                max={INTERVAL_MAX[parsed.unit]}
                min={1}
                onBlur={() => setEveryDraft(null)}
                onChange={(event) => {
                  setEveryDraft(event.target.value);
                  // The builder clamps an out-of-range step; an empty field
                  // commits nothing until a number is typed.
                  if (event.target.value) rebuild({ every: Number(event.target.value) });
                }}
                step={1}
                type="number"
                value={everyDraft ?? String(parsed.every)}
              />
            </div>
            <div className="min-w-[130px] flex-1 space-y-2 text-sm font-medium">
              <label htmlFor="schedule-interval-unit">Unit</label>
              <select
                className={selectClass}
                id="schedule-interval-unit"
                onChange={(event) => rebuild({ unit: event.target.value as CronIntervalUnit })}
                value={parsed.unit}
              >
                {INTERVAL_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {repeat !== "custom" && repeat !== "interval" && (
          <div className="w-[120px] space-y-2 text-sm font-medium">
            <label htmlFor="schedule-time">At</label>
            <Input
              id="schedule-time"
              onChange={(event) => {
                // Segment editing fires transient empty values; rebuilding on
                // those snaps the field back to the default mid-edit.
                if (event.target.value) rebuild({ time: event.target.value });
              }}
              type="time"
              value={parsed.time}
            />
          </div>
        )}
      </div>

      {repeat === "custom" && (
        <Field label="Cron expression">
          <Input
            className="font-mono"
            onChange={(event) => onChange(event.target.value)}
            placeholder="0 9 * * *"
            required
            value={cron}
          />
        </Field>
      )}

      {/* The builder's own controls already read as plain English; the
          preview only earns its place under a raw Custom expression. */}
      {repeat === "custom" && cronPreview !== cron.trim() && (
        <p className="text-xs font-normal text-muted-foreground">{cronPreview}</p>
      )}
    </div>
  );
}

function valueFromSchedule(schedule?: Schedule): FormValue {
  const timezone =
    schedule?.trigger.kind === "cron" ? schedule.trigger.timezone : browserTimezone();
  return {
    allowWrites: schedule?.mutating ?? false,
    cron: schedule?.trigger.kind === "cron" ? schedule.trigger.expression : "0 9 * * *",
    maxFires: String(schedule?.maxFires ?? 0),
    name: schedule?.name ?? "",
    oneShotAt: schedule?.trigger.kind === "once" ? toLocalInput(schedule.trigger.at) : "",
    oneShotOriginal: schedule?.trigger.kind === "once" ? schedule.trigger.at : "",
    oneShotMaxRetries: String(schedule?.oneShotMaxRetries || 3),
    oneShotRetry: schedule?.oneShotRetry ?? false,
    profile: schedule?.profile ?? "all",
    prompt: schedule?.prompt ?? "",
    timezone,
    triggerKind: schedule?.trigger.kind ?? "cron",
    writeMode: schedule?.mode === "default" ? "default" : "acceptEdits",
  };
}

function bodyFromValue(value: FormValue): ScheduleBody {
  return {
    maxFires: Math.max(0, Number(value.maxFires) || 0),
    mode: value.allowWrites ? value.writeMode : "plan",
    mutating: value.allowWrites,
    name: value.name.trim(),
    oneShotMaxRetries: value.oneShotRetry ? Math.max(0, Number(value.oneShotMaxRetries) || 0) : 0,
    oneShotRetry: value.triggerKind === "once" && value.oneShotRetry,
    profile: value.profile,
    prompt: value.prompt.trim(),
    trigger:
      value.triggerKind === "cron"
        ? { expression: value.cron.trim(), kind: "cron", timezone: value.timezone.trim() }
        : { at: oneShotInstant(value.oneShotAt, value.oneShotOriginal) ?? "", kind: "once" },
  };
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The absolute instant the form will save, formatted with its offset so an
 * ambiguous wall clock is never saved blind.
 */
function resolvedOneShot(local: string, original: string): string {
  const instant = oneShotInstant(local, original);
  if (instant === null) return "";
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { timeZoneName: "short" });
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "detail" in error) return String(error.detail);
  return error instanceof Error ? error.message : "The schedule could not be saved.";
}
