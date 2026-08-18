"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { describeCron } from "@/lib/formatters";
import { PERMISSION_MODES, type ScheduleSpecDraft } from "@/lib/protocol";

/**
 * Form state for authoring a schedule.
 *
 * Write access is a single opt-in: `allowWrites` couples `mutating: true` with
 * a write-capable permission mode, and `writeMode` only exists under that
 * opt-in. The default posture (`allowWrites: false`) is always
 * `mutating: false` + plan mode — the invalid pairing (mutating in plan mode,
 * or writes without the opt-in) cannot be expressed by this state at all.
 */
export interface ScheduleFormValue {
  name: string;
  prompt: string;
  triggerKind: "cron" | "one-shot";
  cron: string;
  timezone: string;
  /** Numeric text; empty or "0" means unlimited (the wire's meaning of 0). */
  maxFires: string;
  /** `datetime-local` value, interpreted in the browser's local time. */
  oneShotAt: string;
  oneShotRetry: boolean;
  oneShotMaxRetries: string;
  allowWrites: boolean;
  writeMode: "default" | "accept_edits";
}

export function emptyScheduleForm(): ScheduleFormValue {
  return {
    name: "",
    prompt: "",
    triggerKind: "cron",
    cron: "0 9 * * *",
    timezone: browserTimezone(),
    maxFires: "",
    oneShotAt: "",
    oneShotRetry: false,
    oneShotMaxRetries: "3",
    allowWrites: false,
    writeMode: "accept_edits",
  };
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

function toLocalDateTimeInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Seed the form from a stored draft (the edit path). A spec whose
 * mode/mutating pairing this form cannot express (e.g. a CLI-authored
 * `mutating: false` + default mode) is coerced to the nearest expressible
 * posture — the form's invariant wins over round-tripping an odd pairing.
 */
export function formFromDraft(draft: ScheduleSpecDraft): ScheduleFormValue {
  const base = emptyScheduleForm();
  return {
    ...base,
    name: draft.name,
    prompt: draft.prompt,
    triggerKind: draft.trigger.kind,
    cron: draft.trigger.kind === "cron" ? draft.trigger.cron : base.cron,
    timezone:
      draft.trigger.kind === "cron" && draft.trigger.timezone
        ? draft.trigger.timezone
        : base.timezone,
    maxFires: draft.maxFires > 0 ? String(draft.maxFires) : "",
    oneShotAt:
      draft.trigger.kind === "one-shot"
        ? toLocalDateTimeInput(draft.trigger.at)
        : "",
    oneShotRetry: draft.oneShotRetry,
    oneShotMaxRetries:
      draft.oneShotMaxRetries > 0 ? String(draft.oneShotMaxRetries) : "3",
    allowWrites: draft.mutating,
    writeMode:
      draft.mode === PERMISSION_MODES.PERMISSION_MODE_DEFAULT
        ? "default"
        : "accept_edits",
  };
}

/**
 * Build the wire draft. `base` is the stored draft on an edit — it supplies
 * the spec fields this form has no controls for (profile, workspace, limits)
 * so they survive the PUT-replaces-everything contract.
 */
export function draftFromForm(
  value: ScheduleFormValue,
  base?: ScheduleSpecDraft,
): ScheduleSpecDraft {
  const mode = value.allowWrites
    ? value.writeMode === "default"
      ? PERMISSION_MODES.PERMISSION_MODE_DEFAULT
      : PERMISSION_MODES.PERMISSION_MODE_ACCEPT_EDITS
    : PERMISSION_MODES.PERMISSION_MODE_PLAN;
  return {
    name: value.name.trim(),
    prompt: value.prompt.trim(),
    trigger:
      value.triggerKind === "cron"
        ? {
            kind: "cron",
            cron: value.cron.trim(),
            timezone: value.timezone.trim(),
          }
        : { kind: "one-shot", at: new Date(value.oneShotAt).getTime() },
    profile: base?.profile ?? "",
    workspace: base?.workspace ?? "",
    mode,
    mutating: value.allowWrites,
    maxFires: Math.max(0, Number(value.maxFires) || 0),
    limits: base?.limits ?? {
      maxTurns: 0,
      maxToolCalls: 0,
      maxConsecutiveFailures: 0,
    },
    oneShotRetry: value.oneShotRetry,
    oneShotMaxRetries: value.oneShotRetry
      ? Math.max(0, Number(value.oneShotMaxRetries) || 0)
      : 0,
  };
}

/**
 * Client-side gate for the submit button only — shape checks a request could
 * never survive. Everything else (frequency floors, cron grammar, name rules)
 * is the daemon's call and its refusal is shown verbatim.
 */
export function scheduleFormProblem(value: ScheduleFormValue): string | null {
  if (!value.name.trim()) return "Name is required.";
  if (!value.prompt.trim()) return "Prompt is required.";
  if (value.triggerKind === "cron") {
    if (!value.cron.trim()) return "Cron expression is required.";
  } else {
    if (!value.oneShotAt) return "Run time is required.";
    if (Number.isNaN(new Date(value.oneShotAt).getTime()))
      return "Run time is not a valid date.";
  }
  return null;
}

/** Badge label for a wire permission mode; list and detail share the wording. */
export function permissionModeLabel(mode: number): string {
  switch (mode) {
    case PERMISSION_MODES.PERMISSION_MODE_DEFAULT:
      return "default";
    case PERMISSION_MODES.PERMISSION_MODE_PLAN:
      return "plan";
    case PERMISSION_MODES.PERMISSION_MODE_ACCEPT_EDITS:
      return "accept edits";
    default:
      return "unspecified";
  }
}

export function ScheduleFormFields({
  value,
  onChange,
  nameLocked = false,
}: {
  value: ScheduleFormValue;
  onChange: (patch: Partial<ScheduleFormValue>) => void;
  /** Edits PUT to the stored name; renaming would target a different spec. */
  nameLocked?: boolean;
}) {
  const cronPreview = describeCron(value.cron.trim());
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="schedule-name">Name</Label>
        <Input
          id="schedule-name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="daily-standup-summary"
          disabled={nameLocked}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-prompt">Prompt</Label>
        <Textarea
          id="schedule-prompt"
          value={value.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Summarise yesterday's activity and post it to the team channel."
          rows={3}
          required
        />
      </div>

      <div className="space-y-3">
        <Label>Trigger</Label>
        <Tabs
          value={value.triggerKind}
          onValueChange={(v) =>
            onChange({ triggerKind: v as ScheduleFormValue["triggerKind"] })
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cron">Recurring</TabsTrigger>
            <TabsTrigger value="one-shot">Run once</TabsTrigger>
          </TabsList>
        </Tabs>

        {value.triggerKind === "cron" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-cron">Cron expression</Label>
              <Input
                id="schedule-cron"
                value={value.cron}
                onChange={(e) => onChange({ cron: e.target.value })}
                placeholder="0 9 * * *"
                className="font-mono"
                required
              />
              {cronPreview !== value.cron.trim() && (
                <p className="text-xs text-muted-foreground">{cronPreview}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label htmlFor="schedule-timezone">Timezone (IANA)</Label>
                <Input
                  id="schedule-timezone"
                  value={value.timezone}
                  onChange={(e) => onChange({ timezone: e.target.value })}
                  placeholder="Europe/London"
                />
              </div>
              <div className="w-[130px] space-y-2">
                <Label htmlFor="schedule-max-fires">Max fires</Label>
                <Input
                  id="schedule-max-fires"
                  type="number"
                  min={0}
                  value={value.maxFires}
                  onChange={(e) => onChange({ maxFires: e.target.value })}
                  placeholder="unlimited"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-one-shot-at">Run at</Label>
              <Input
                id="schedule-one-shot-at"
                type="datetime-local"
                value={value.oneShotAt}
                onChange={(e) => onChange({ oneShotAt: e.target.value })}
                className="w-fit"
                required
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-one-shot-retry">
                  Retry on failure
                </Label>
                <p className="text-xs text-muted-foreground">
                  Re-fire if the run ends in an error.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {value.oneShotRetry && (
                  <Input
                    aria-label="Max retries"
                    type="number"
                    min={0}
                    value={value.oneShotMaxRetries}
                    onChange={(e) =>
                      onChange({ oneShotMaxRetries: e.target.value })
                    }
                    className="w-[80px]"
                  />
                )}
                <Switch
                  id="schedule-one-shot-retry"
                  checked={value.oneShotRetry}
                  onCheckedChange={(checked) =>
                    onChange({ oneShotRetry: checked })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="schedule-allow-writes">
              Allow file and shell writes
            </Label>
            <p className="text-xs text-muted-foreground">
              {value.allowWrites
                ? "Runs may modify files and run mutating commands."
                : "Runs read-only in plan mode."}
            </p>
          </div>
          <Switch
            id="schedule-allow-writes"
            checked={value.allowWrites}
            onCheckedChange={(checked) => onChange({ allowWrites: checked })}
          />
        </div>
        {value.allowWrites && (
          <div className="space-y-2">
            <Label htmlFor="schedule-write-mode">Permission mode</Label>
            <Select
              value={value.writeMode}
              onValueChange={(v) =>
                onChange({ writeMode: v as ScheduleFormValue["writeMode"] })
              }
            >
              <SelectTrigger id="schedule-write-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accept_edits">
                  Accept edits — file edits proceed without approval
                </SelectItem>
                <SelectItem value="default">
                  Default — standard permission rules apply
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
