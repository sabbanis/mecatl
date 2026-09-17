"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRuntimeSettings } from "@/features/agent/hooks/use-runtime-settings";
import type {
  HarnessLearningMode,
  HarnessLearningSensitivity,
  HarnessRuntimeSettingsDoc,
} from "@/lib/harness/runtime-settings";
import { OptionField, type OptionItem } from "./option-field";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

/**
 * Settings → Learning → Learning mode: the web form of mecatui's `/learning`
 * and `/learning-sensitivity`. Two selects over the daemon's closed
 * vocabularies, a from → to report of the pending change, and one "Save and
 * restart" that writes both values through the controller (Studio's own
 * CLI-tier settings file — the operator's `~/.config/mecatl/settings.yaml`
 * is never edited) and restarts the daemon.
 *
 * The values shown as CURRENT are the controller's `effective` fold — what
 * mecated actually runs with (Studio's override, else the operator's
 * settings.yaml, else the daemon default) — never just Studio's own file,
 * so a daemon already in Review from settings.yaml reads Review here. Each
 * row says where its value comes from.
 *
 * Managed mode only. An imported operator settings file owns learning
 * (`managedBy.learning === "operator-settings"`): the values render
 * read-only with the instruction to edit that file. External mode renders
 * the managed note plus the TUI's remote wording (edit the server host's
 * settings.yaml and restart that server); offline renders the offline note.
 */

type LearningMode = Exclude<HarnessLearningMode, "">;
type LearningSensitivity = Exclude<HarnessLearningSensitivity, "">;

interface LearningDraft {
  mode: LearningMode;
  sensitivity: LearningSensitivity;
}

/** The three modes, worded as the TUI documents them (docs/tui.md). */
const MODE_OPTIONS: readonly (OptionItem & { value: LearningMode })[] = [
  {
    value: "off",
    label: "Off",
    description:
      "No automatic reflection. Explicit Reflect still works when a reflection provider is configured.",
  },
  {
    value: "review",
    label: "Review",
    description:
      "Stages bounded, evidence-backed proposals for your approval; writes nothing to memory on its own.",
  },
  {
    value: "auto",
    label: "Auto",
    description:
      "Stages proposals and additionally promotes only standard-policy-eligible, non-conflicting facts.",
  },
];

/** The evidence thresholds are the daemon's (user-docs/features/learning.md). */
const SENSITIVITY_OPTIONS: readonly (OptionItem & {
  value: LearningSensitivity;
})[] = [
  {
    value: "conservative",
    label: "Conservative",
    description:
      "Needs the strongest evidence (6 points) before a proposal is staged.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "The daemon default: 4 points of evidence stage a proposal.",
  },
  {
    value: "eager",
    label: "Eager",
    description:
      "Stages a proposal on 3 points of evidence — more proposals, more to review.",
  },
];

const isMode = (value: string): value is LearningMode =>
  MODE_OPTIONS.some((option) => option.value === value);

const isSensitivity = (value: string): value is LearningSensitivity =>
  SENSITIVITY_OPTIONS.some((option) => option.value === value);

/** The daemon's defaults stand in for a value the controller could not
 *  report (an older controller, an unparseable settings.yaml). */
const asLearningMode = (value: string): LearningMode =>
  isMode(value) ? value : "off";

const asLearningSensitivity = (value: string): LearningSensitivity =>
  isSensitivity(value) ? value : "balanced";

const learningModeLabel = (value: string): string =>
  MODE_OPTIONS.find((option) => option.value === value)?.label ??
  learningModeLabel(asLearningMode(value));

const learningSensitivityLabel = (value: string): string =>
  SENSITIVITY_OPTIONS.find((option) => option.value === value)?.label ??
  learningSensitivityLabel(asLearningSensitivity(value));

/** `Off (sensitivity Balanced)` — the TUI's complete pending-state label. */
function describeLearning(settings: LearningDraft): string {
  return `${learningModeLabel(settings.mode)} (sensitivity ${learningSensitivityLabel(settings.sensitivity)})`;
}

/** The TUI's from → to report line for a pending change. */
export function learningChangeReport(
  from: LearningDraft,
  to: LearningDraft,
): string {
  return `${describeLearning(from)} → ${describeLearning(to)}`;
}

export type LearningValueSource = "studio" | "settings.yaml" | "default";

/**
 * Where an effective value comes from: Studio's own file when it carries one
 * (the CLI tier out-ranks the user-global file), else the operator's
 * settings.yaml when that sets it, else the daemon default.
 */
export function learningValueSource(
  studioValue: string,
  inheritedValue: string,
): LearningValueSource {
  if (studioValue) return "studio";
  if (inheritedValue) return "settings.yaml";
  return "default";
}

const SOURCE_HINT: Record<LearningValueSource, (key: string) => string> = {
  studio: () => "Set by Studio.",
  "settings.yaml": (key) => `From your settings.yaml (${key}).`,
  default: () => "Daemon default — nothing sets it yet.",
};

export function learningSourceHint(
  key: "learning.mode" | "learning.sensitivity",
  source: LearningValueSource,
): string {
  return SOURCE_HINT[source](key);
}

/** The effective pair the daemon runs with, as the two selects show it. */
export function currentLearning(doc: HarnessRuntimeSettingsDoc): LearningDraft {
  return {
    mode: asLearningMode(doc.effective.learning.mode),
    sensitivity: asLearningSensitivity(doc.effective.learning.sensitivity),
  };
}

const MODE_DESCRIPTION =
  "What the daemon does after a completed run. Off: nothing automatic. Review: stages proposals for the queue below. Auto: also promotes eligible, non-conflicting facts.";
const SENSITIVITY_DESCRIPTION =
  "How much evidence a run must show before a proposal is staged.";

export function LearningModeSection() {
  const { live, manageable, doc, isLoading, busy, error, notice, save } =
    useRuntimeSettings();
  // The unsaved pair; null = showing the effective values untouched.
  const [draft, setDraft] = useState<LearningDraft | null>(null);
  const [confirming, setConfirming] = useState(false);

  let body: React.ReactNode;
  if (!live) {
    body = <OfflineNote />;
  } else if (!manageable) {
    body = (
      <div className="space-y-2">
        <ExternalManagedNote />
        <Note>
          Edit <code>learning.mode</code> / <code>learning.sensitivity</code> in
          the server host&rsquo;s settings.yaml and restart that server.
        </Note>
      </div>
    );
  } else if (!doc) {
    body = (
      <Note>
        {isLoading
          ? "Reading the daemon's runtime settings…"
          : (error ??
            "The daemon's runtime settings could not be read right now.")}
      </Note>
    );
  } else if (doc.managedBy.learning === "operator-settings") {
    const current = currentLearning(doc);
    body = (
      <>
        <div className="divide-y divide-border/60">
          <SettingsRow label="Learning mode" description={MODE_DESCRIPTION}>
            <span className="text-sm text-muted-foreground">
              {learningModeLabel(current.mode)}
            </span>
          </SettingsRow>
          <SettingsRow
            label="Sensitivity"
            description={SENSITIVITY_DESCRIPTION}
          >
            <span className="text-sm text-muted-foreground">
              {learningSensitivityLabel(current.sensitivity)}
            </span>
          </SettingsRow>
        </div>
        <div className="mt-3">
          <Note>
            Learning is managed by the imported operator settings file — update
            its <code>learning:</code> block and restart the daemon.
          </Note>
        </div>
      </>
    );
  } else {
    const current = currentLearning(doc);
    const shown = draft ?? current;
    const dirty =
      shown.mode !== current.mode || shown.sensitivity !== current.sensitivity;
    const report = learningChangeReport(current, shown);
    const modeHint = learningSourceHint(
      "learning.mode",
      learningValueSource(
        doc.config.learning.mode,
        doc.inherited.learning.mode,
      ),
    );
    const sensitivityHint = learningSourceHint(
      "learning.sensitivity",
      learningValueSource(
        doc.config.learning.sensitivity,
        doc.inherited.learning.sensitivity,
      ),
    );
    const submit = async () => {
      setConfirming(false);
      const ok = await save({
        learning: { mode: shown.mode, sensitivity: shown.sensitivity },
      });
      if (ok) setDraft(null);
    };

    body = (
      <>
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Learning mode"
            description={`${MODE_DESCRIPTION} ${modeHint}`}
          >
            <OptionField
              label="Learning mode"
              value={shown.mode}
              options={MODE_OPTIONS}
              onChange={(value) =>
                setDraft({ ...shown, mode: asLearningMode(value) })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="Sensitivity"
            description={`${SENSITIVITY_DESCRIPTION} ${sensitivityHint}`}
          >
            <OptionField
              label="Sensitivity"
              value={shown.sensitivity}
              options={SENSITIVITY_OPTIONS}
              onChange={(value) =>
                setDraft({
                  ...shown,
                  sensitivity: asLearningSensitivity(value),
                })
              }
            />
          </SettingsRow>
        </div>
        {dirty ? (
          <div className="mt-3 space-y-1" data-testid="learning-pending">
            <p className="text-sm">
              <span className="font-medium">Pending:</span> {report}
            </p>
            <p className="text-xs text-muted-foreground">
              Restart required — saving restarts the daemon. In-flight runs end.
            </p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!dirty || busy !== ""}
            onClick={() => setConfirming(true)}
          >
            Save and restart
          </Button>
          {dirty ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy !== ""}
              onClick={() => setDraft(null)}
            >
              Discard
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          {confirming && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Change learning settings and restart the daemon?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {report}. The daemon restarts with the new settings: in-flight
                  runs end and their session ids die with them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void submit()}>
                  Save and restart
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      </>
    );
  }

  return (
    <SettingsCard
      title="Learning mode"
      description="Whether the managed daemon reflects on completed runs, and how much evidence it needs. Changes restart it."
    >
      {body}
    </SettingsCard>
  );
}
