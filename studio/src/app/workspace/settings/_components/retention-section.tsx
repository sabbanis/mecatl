"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useStorageHealth } from "@/features/agent/hooks/use-storage-health";
import { useConfirm } from "@/hooks/use-confirm";
import {
  formatBytes,
  formatDuration,
  formatRelativeTime,
  formatUntilTime,
} from "@/lib/formatters";
import type {
  HarnessRetentionFamily,
  HarnessRetentionSettings,
} from "@/lib/harness/client";
import type { StorageHealth } from "@/lib/harness/storage";
import {
  mainRetentionEnabled,
  normalizeRetentionSettings,
} from "@/lib/retention-settings.mjs";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

const FAMILIES = ["main", "child", "scheduled"] as const;
type Family = (typeof FAMILIES)[number];

const FAMILY_LABEL: Record<Family, string> = {
  main: "Main chats",
  child: "Child runs",
  scheduled: "Scheduled fires",
};

const FAMILY_HINT: Record<Family, string> = {
  main: "Your own chats. Off by default; enabling either limit deletes chats permanently and needs the acknowledgement below.",
  child:
    "Runs a chat delegated to subagents, parallel branches and teams (their InspectSubagent and resume handles). Daemon default: 168h, 500 per family.",
  scheduled:
    "Sessions a scheduled task's fires produced. Daemon default: 168h, no count cap.",
};

/** One row of the effective-policy table, rendered as the daemon applies it. */
export interface PolicyRow {
  family: Family;
  label: string;
  maxAge: string;
  maxCount: string;
  stored: string;
}

/** "Off" for mecated's 0-disables convention, else the humanised span. */
const describeAge = (seconds: number) =>
  seconds > 0 ? formatDuration(seconds) : "Off";
const describeCount = (count: number) =>
  count > 0 ? count.toLocaleString() : "Off";

/**
 * The effective-policy table rows from a storage-health read: Main / Child
 * / Scheduled × (max age, max count, stored count). Exported for its vitest.
 */
export function policyRows(health: StorageHealth): PolicyRow[] {
  const policy = health.policy;
  if (!policy) return [];
  return [
    {
      family: "main",
      label: FAMILY_LABEL.main,
      maxAge: describeAge(policy.mainMaxAgeSeconds),
      maxCount: describeCount(policy.mainMaxCount),
      stored: health.mainCount.toLocaleString(),
    },
    {
      family: "child",
      label: FAMILY_LABEL.child,
      maxAge: describeAge(policy.childMaxAgeSeconds),
      maxCount: describeCount(policy.childMaxCount),
      stored: health.childCount.toLocaleString(),
    },
    {
      family: "scheduled",
      label: FAMILY_LABEL.scheduled,
      maxAge: describeAge(policy.scheduledMaxAgeSeconds),
      maxCount: describeCount(policy.scheduledMaxCount),
      stored: health.scheduledCount.toLocaleString(),
    },
  ];
}

/** The sweep schedule lines beneath the table. Exported for its vitest. */
export function describeSweep(health: StorageHealth): {
  cadence: string;
  last: string;
  next: string;
} {
  const cadence = health.policy?.sweepCadenceSeconds ?? 0;
  return {
    cadence:
      cadence > 0
        ? `every ${formatDuration(cadence)}`
        : "Off — the daemon sweeps once at startup only",
    last:
      health.lastSweepAt === null
        ? "never"
        : `${formatRelativeTime(health.lastSweepAt) || "<1m"} ago`,
    next:
      health.nextSweepAt === null
        ? "not scheduled"
        : `in ${formatUntilTime(health.nextSweepAt) || "<1m"}`,
  };
}

/** The form's working copy: every limit AS TYPED (blank = leave the
 *  daemon's default). */
export interface RetentionDraft {
  main: { maxAge: string; maxCount: string };
  child: { maxAge: string; maxCount: string };
  scheduled: { maxAge: string; maxCount: string };
  sweepCadence: string;
  acknowledgeMainDeletion: boolean;
}

const familyDraft = (family: HarnessRetentionFamily) => ({
  maxAge: family.maxAge ?? "",
  maxCount: family.maxCount === null ? "" : String(family.maxCount),
});

export function draftFromSettings(
  settings: HarnessRetentionSettings,
): RetentionDraft {
  return {
    main: familyDraft(settings.main),
    child: familyDraft(settings.child),
    scheduled: familyDraft(settings.scheduled),
    sweepCadence: settings.sweepCadence ?? "",
    acknowledgeMainDeletion: settings.acknowledgeMainDeletion,
  };
}

/**
 * The exact document Save sends, through the SAME normaliser the
 * controller applies (src/lib/retention-settings.mjs): blanks become null,
 * durations are trimmed, counts become numbers. Throws the controller's
 * own 400 message for an invalid draft — see `retentionProblem`.
 */
export function retentionSettingsFor(
  draft: RetentionDraft,
): HarnessRetentionSettings {
  return normalizeRetentionSettings(draft) as HarnessRetentionSettings;
}

/** Why the draft cannot be saved (the controller's own wording), or null. */
export function retentionProblem(draft: RetentionDraft): string | null {
  try {
    retentionSettingsFor(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * The confirm dialog's body: the restart every save costs, then — when the
 * document switches on main-chat deletion — exactly what will be deleted.
 * Exported for its vitest.
 */
export function retentionChangeSummary(
  settings: HarnessRetentionSettings,
): string {
  const lines = ["Saving restarts the daemon: in-flight runs end."];
  if (mainRetentionEnabled(settings)) {
    const { maxAge, maxCount } = settings.main;
    const clauses: string[] = [];
    if (maxAge !== null && maxAge !== "0")
      clauses.push(`main chats older than ${maxAge}`);
    if (maxCount !== null && maxCount > 0)
      clauses.push(`main chats beyond the newest ${maxCount.toLocaleString()}`);
    lines.push(
      `From the next sweep on, ${clauses.join(" and ")} are deleted permanently — yours included, with their transcripts and event logs.`,
    );
  }
  return lines.join(" ");
}

function EffectivePolicy({
  supported,
  health,
}: {
  supported: boolean;
  health: StorageHealth | null;
}) {
  if (!supported) {
    return (
      <Note>
        This daemon does not report storage health, so the policy it applies
        cannot be shown here.
      </Note>
    );
  }
  if (health === null) {
    return (
      <Note>
        The daemon&rsquo;s storage health is not available right now, so the
        policy it applies cannot be shown.
      </Note>
    );
  }
  if (!health.available) {
    return (
      <Note>
        The session store cannot be read
        {health.unavailableReason ? `: ${health.unavailableReason}` : "."} No
        retention policy applies until it can.
      </Note>
    );
  }
  const rows = policyRows(health);
  if (rows.length === 0) {
    return <Note>The daemon reported no retention policy.</Note>;
  }
  const sweep = describeSweep(health);
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label="Effective retention policy">
          <TableHeader>
            <TableRow>
              <TableHead>Family</TableHead>
              <TableHead>Max age</TableHead>
              <TableHead>Max count</TableHead>
              <TableHead className="text-right">Stored</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.family}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>{row.maxAge}</TableCell>
                <TableCell>{row.maxCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.stored}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Sweep cadence</dt>
        <dd>{sweep.cadence}</dd>
        <dt className="text-muted-foreground">Last sweep</dt>
        <dd>{sweep.last}</dd>
        <dt className="text-muted-foreground">Next sweep</dt>
        <dd>{sweep.next}</dd>
        {health.currentBytes !== null && (
          <>
            <dt className="text-muted-foreground">Store size</dt>
            <dd>
              {formatBytes(health.currentBytes)}
              {health.reclaimableBytes !== null && health.reclaimableBytes > 0
                ? ` (${formatBytes(health.reclaimableBytes)} reclaimable)`
                : ""}
            </dd>
          </>
        )}
        {health.unknownCount > 0 && (
          <>
            <dt className="text-muted-foreground">Protected</dt>
            <dd>
              {health.unknownCount.toLocaleString()} session
              {health.unknownCount === 1 ? "" : "s"} of unknown kind — never
              swept
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function FamilyFields({
  family,
  value,
  saved,
  disabled,
  onChange,
}: {
  family: Family;
  value: { maxAge: string; maxCount: string };
  saved: HarnessRetentionFamily;
  disabled: boolean;
  onChange: (next: { maxAge: string; maxCount: string }) => void;
}) {
  const label = FAMILY_LABEL[family];
  return (
    <fieldset className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="max-w-xl text-xs text-muted-foreground">
        {FAMILY_HINT[family]}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`retention-${family}-max-age`}
            className="text-xs text-muted-foreground"
          >
            Max age
          </Label>
          <Input
            id={`retention-${family}-max-age`}
            aria-label={`${label} max age`}
            value={value.maxAge}
            onChange={(event) =>
              onChange({ ...value, maxAge: event.target.value })
            }
            placeholder={saved.maxAge ?? "daemon default"}
            spellCheck={false}
            autoComplete="off"
            disabled={disabled}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`retention-${family}-max-count`}
            className="text-xs text-muted-foreground"
          >
            Max count
          </Label>
          <Input
            id={`retention-${family}-max-count`}
            aria-label={`${label} max count`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value.maxCount}
            onChange={(event) =>
              onChange({ ...value, maxCount: event.target.value })
            }
            placeholder={
              saved.maxCount === null
                ? "daemon default"
                : String(saved.maxCount)
            }
            disabled={disabled}
            className="font-mono"
          />
        </div>
      </div>
    </fieldset>
  );
}

/**
 * The daemon's session RETENTION: the policy it applies right now (from its
 * own storage health — the truth whatever flags or settings file produced
 * it), and, in managed mode, the limits Studio's controller passes as
 * spawn flags. Main-chat deletion is destructive and gated on an explicit
 * acknowledgement here AND in mecated itself; every save restarts the
 * daemon.
 */
export function RetentionSection({ runtime }: { runtime: Runtime }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const { health, supported, refresh } = useStorageHealth();
  const [draft, setDraft] = useState<RetentionDraft | null>(null);

  if (!runtime.live) {
    return (
      <SettingsCard title="Retention">
        <OfflineNote />
      </SettingsCard>
    );
  }

  const description =
    "How long the daemon keeps chats before its sweep deletes them. Above: the policy the daemon applies right now. Main chats are never deleted unless a main limit is switched on.";

  if (runtime.mode === "external") {
    return (
      <SettingsCard title="Retention" description={description}>
        <div className="flex flex-col gap-4">
          <EffectivePolicy supported={supported} health={health} />
          <ExternalManagedNote />
        </div>
      </SettingsCard>
    );
  }

  const saved = runtime.status?.retention ?? null;
  if (!saved) {
    return (
      <SettingsCard title="Retention" description={description}>
        <div className="flex flex-col gap-4">
          <EffectivePolicy supported={supported} health={health} />
          <Note>
            The controller did not report its retention settings. Restart Studio
            (task studio:dev) so the current controller is running.
          </Note>
        </div>
      </SettingsCard>
    );
  }

  if (saved.managedBy === "operator-settings") {
    return (
      <SettingsCard title="Retention" description={description}>
        <div className="flex flex-col gap-4">
          <EffectivePolicy supported={supported} health={health} />
          <Note>
            Managed by the imported operator settings file: while it is active
            the controller passes no retention flags, so its{" "}
            <code className="font-mono">retention:</code> block (if any) and the
            daemon&rsquo;s defaults apply. Edit that file to change the policy.
          </Note>
        </div>
      </SettingsCard>
    );
  }

  const view = draft ?? draftFromSettings(saved.settings);
  const savedDraft = draftFromSettings(saved.settings);
  const dirty = JSON.stringify(view) !== JSON.stringify(savedDraft);
  const problem = dirty ? retentionProblem(view) : null;
  const busy = runtime.busy === "retention";
  const patch = (next: Partial<RetentionDraft>) =>
    setDraft({ ...view, ...next });
  // What the draft would switch on, ignoring the acknowledgement for the
  // moment — drives the destructive styling before the box is ticked.
  const mainOn = mainRetentionEnabled(normalizeRetentionSettingsLoosely(view));

  const save = async () => {
    let next: HarnessRetentionSettings;
    try {
      next = retentionSettingsFor(view);
    } catch {
      return;
    }
    const destructive = mainRetentionEnabled(next);
    const confirmed = await confirm({
      title: destructive
        ? "Delete old main chats automatically?"
        : "Change the retention policy?",
      description: retentionChangeSummary(next),
      confirmText: destructive
        ? "Enable deletion and restart"
        : "Save and restart",
      destructive,
    });
    if (!confirmed) return;
    await runtime.saveRetention(next);
    refresh();
    setDraft(null);
  };

  return (
    <SettingsCard title="Retention" description={description}>
      <div className="flex flex-col gap-5">
        <EffectivePolicy supported={supported} health={health} />

        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Limits Studio passes</h3>
            <p className="max-w-xl text-xs text-muted-foreground">
              Blank leaves the daemon&rsquo;s default; 0 switches a limit off.
              Durations use Go units — 168h, 30m, 1h30m — hours, not days. These
              become mecated flags on the restart and out-rank a settings file
              field by field.
            </p>
          </div>

          <div className="divide-y divide-border/60">
            {FAMILIES.map((family) => (
              <FamilyFields
                key={family}
                family={family}
                value={view[family]}
                saved={saved.settings[family]}
                disabled={busy}
                onChange={(next) => patch({ [family]: next })}
              />
            ))}
            <div className="flex flex-col gap-1.5 py-4 last:pb-0">
              <Label
                htmlFor="retention-sweep-cadence"
                className="text-sm font-medium"
              >
                Sweep cadence
              </Label>
              <p className="max-w-xl text-xs text-muted-foreground">
                How often the daemon re-checks every family after its startup
                sweep. Daemon default: 1h; 0 sweeps at startup only.
              </p>
              <Input
                id="retention-sweep-cadence"
                value={view.sweepCadence}
                onChange={(event) =>
                  patch({ sweepCadence: event.target.value })
                }
                placeholder={saved.settings.sweepCadence ?? "daemon default"}
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                className="font-mono sm:max-w-xs"
              />
            </div>
          </div>

          <div
            className={
              mainOn
                ? "flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
                : "flex items-start gap-3 rounded-lg border px-3 py-2"
            }
          >
            <Checkbox
              id="retention-acknowledge"
              checked={view.acknowledgeMainDeletion}
              onCheckedChange={(checked) =>
                patch({ acknowledgeMainDeletion: checked === true })
              }
              disabled={busy}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="retention-acknowledge"
                className={
                  mainOn
                    ? "text-sm font-medium text-destructive"
                    : "text-sm font-medium"
                }
              >
                Delete my own chats automatically (required for Main limits)
              </Label>
              <p className="text-xs text-muted-foreground">
                mecated refuses to start with a main age or count limit unless
                this is set. Deleted chats cannot be recovered.
              </p>
            </div>
          </div>

          {problem && (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{problem}</span>
            </p>
          )}

          <Note>
            Saving restarts the daemon: in-flight runs end and session ids die
            with it.
          </Note>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setDraft(null)}
                disabled={busy}
              >
                Discard
              </Button>
            )}
            <Button
              variant={mainOn ? "destructive" : "action"}
              className="rounded-full"
              disabled={!dirty || busy || problem !== null}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}

/**
 * The draft's main limits as the normaliser would read them, WITHOUT the
 * acknowledgement gate — so the form can style the main-deletion warning
 * red before the box is ticked. An unparsable draft reads as "off".
 */
function normalizeRetentionSettingsLoosely(
  draft: RetentionDraft,
): HarnessRetentionSettings {
  try {
    return normalizeRetentionSettings({
      ...draft,
      acknowledgeMainDeletion: true,
    }) as HarnessRetentionSettings;
  } catch {
    return {
      main: { maxAge: null, maxCount: null },
      child: { maxAge: null, maxCount: null },
      scheduled: { maxAge: null, maxCount: null },
      sweepCadence: null,
      acknowledgeMainDeletion: false,
    };
  }
}
