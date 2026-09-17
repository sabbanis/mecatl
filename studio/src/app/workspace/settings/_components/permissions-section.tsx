"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ALLOW_ALL_POSTURES,
  POSTURES,
  postureImpliesTrust,
  postureRank,
} from "@/lib/controller-permissions.mjs";
import type {
  HarnessPermissionsConfig,
  HarnessTrustState,
} from "@/lib/harness/client";
import { OptionField } from "./option-field";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The ladder, lowest tier first, each with ONE plain sentence on what it
 * means for the person choosing it. The values are the SDK's posture ladder
 * (pinned by posture-vocabulary.test.ts); the labels and sentences are the
 * only words a user sees — the picker shows every one, the row repeats the
 * selected one.
 */
export const POSTURE_OPTIONS: readonly {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: "strict",
    label: "Strict",
    description: "Asks before every change.",
  },
  {
    value: "trusted",
    label: "Trusted",
    description: "Follows this project's own rules, asks otherwise.",
  },
  {
    value: "auto",
    label: "Auto",
    description: "Works without asking. For unattended runs.",
  },
  {
    value: "yolo",
    label: "Yolo",
    description: "No safeguards. Only on a throwaway machine.",
  },
];

/** The user-facing name of a tier (the raw value for one Studio does not know). */
function postureLabel(tier: string): string {
  return POSTURE_OPTIONS.find((option) => option.value === tier)?.label ?? tier;
}

const badgeVariantFor = (
  posture: string,
): "outline" | "info" | "warning" | "destructive" => {
  switch (posture) {
    case "yolo":
      return "destructive";
    case "auto":
      return "warning";
    case "trusted":
      return "info";
    default:
      return "outline";
  }
};

/**
 * One plain line on why the daemon's EFFECTIVE tier (capabilities.posture)
 * differs from the SAVED one, or null when they agree. Studio passes
 * `--posture` explicitly, so an imported settings file cannot be the cause;
 * the one expected raise is Studio's own trust flag (mecated folds
 * `--trust-project` to at least `trusted`). Anything else is most likely a
 * restart still in flight. Exported for its vitest.
 */
export function effectivePostureNote({
  saved,
  effective,
  trustProject,
  trustOnce,
}: {
  saved: string;
  effective: string;
  trustProject: boolean;
  trustOnce: boolean;
}): string | null {
  if (effective === saved) return null;
  const running = `Right now the agent is running at ${postureLabel(effective)}`;
  if (
    saved === "strict" &&
    effective === "trusted" &&
    (trustProject || trustOnce)
  ) {
    return trustOnce && !trustProject
      ? `${running} because this project is trusted until Studio restarts.`
      : `${running} because this project is trusted.`;
  }
  if (postureRank(effective) > postureRank(saved)) {
    return `${running}, above the saved ${postureLabel(saved)}. It may still be restarting; if this stays, something outside Studio raised it.`;
  }
  return `${running}, below the saved ${postureLabel(saved)}. It may still be restarting.`;
}

/**
 * The daemon-wide operator posture, project trust and shell-less mode —
 * mecated spawn flags owned by Studio's controller (never a settings.yaml
 * key). Every save restarts the daemon. This is NOT the composer's
 * per-session Mode selector: that is the session permission mode; this is
 * the ceiling every session runs under. The copy is written for people who
 * are not developers: "the agent", never the daemon or its flags.
 */
export function PermissionsSection({ runtime }: { runtime: Runtime }) {
  const runtimeStatus = useRuntimeStatus();
  const { serverCapabilities } = runtimeStatus;
  // The controller's OWN trust decision for the current spawn (null against
  // an older controller / in external mode / before the first status poll).
  const trust: HarnessTrustState | null = runtimeStatus.trust ?? null;
  const { confirm, ConfirmDialog } = useConfirm();
  const [draft, setDraft] = useState<HarnessPermissionsConfig | null>(null);

  // CAPABILITY GATE: an older daemon omits the posture from its
  // compatibility document; the badge renders only when it is present.
  const effective =
    typeof serverCapabilities.posture === "string"
      ? serverCapabilities.posture
      : null;

  // Shown only where there is no picker (external mode, or a controller
  // that did not answer): there the reported tier is the only way to see
  // the level at all. The managed form explains a difference in one line
  // under the picker instead.
  const effectiveRow =
    effective !== null ? (
      <SettingsRow
        label="Safety level"
        description="What the agent is running at right now."
      >
        <Badge variant={badgeVariantFor(effective)}>
          {postureLabel(effective)}
        </Badge>
      </SettingsRow>
    ) : null;

  if (!runtime.live) {
    return (
      <SettingsCard title="Permissions">
        <OfflineNote />
      </SettingsCard>
    );
  }

  if (runtime.mode === "external") {
    return (
      <SettingsCard title="Permissions">
        <div className="flex flex-col gap-3">
          {effectiveRow && (
            <div className="divide-y divide-border/60">{effectiveRow}</div>
          )}
          <ExternalManagedNote />
        </div>
      </SettingsCard>
    );
  }

  const saved = runtime.permissions?.config ?? null;
  if (!saved) {
    return (
      <SettingsCard title="Permissions">
        <div className="flex flex-col gap-3">
          {effectiveRow && (
            <div className="divide-y divide-border/60">{effectiveRow}</div>
          )}
          <Note>
            Studio could not read these settings. Restart Studio and try again.
          </Note>
        </div>
      </SettingsCard>
    );
  }

  const view: HarnessPermissionsConfig = draft ?? {
    posture: saved.posture,
    trustProject: saved.trustProject,
    noShell: saved.noShell,
  };
  const dirty =
    view.posture !== saved.posture ||
    view.trustProject !== saved.trustProject ||
    view.noShell !== saved.noShell;
  const busy = runtime.busy === "permissions";
  const patch = (next: Partial<HarnessPermissionsConfig>) =>
    setDraft({ ...view, ...next });

  const trustImplied = postureImpliesTrust(view.posture);
  const allowAll = ALLOW_ALL_POSTURES.includes(view.posture);
  const selected =
    POSTURE_OPTIONS.find((option) => option.value === view.posture) ??
    POSTURE_OPTIONS[0];
  const differenceNote =
    effective !== null
      ? effectivePostureNote({
          saved: saved.posture,
          effective,
          trustProject: saved.trustProject,
          trustOnce: saved.trustOnce,
        })
      : null;

  const save = async () => {
    if (allowAll && view.posture !== saved.posture) {
      const confirmed = await confirm({
        title: `Switch to ${selected.label}?`,
        description:
          view.posture === "yolo"
            ? `Yolo removes every safeguard: the agent runs everything without asking, for everyone using it. Only use this on a throwaway machine.`
            : `Auto lets the agent make changes and run commands without asking, for everyone using it.`,
        confirmText: `Switch to ${selected.label}`,
        destructive: true,
      });
      if (!confirmed) return;
    }
    await runtime.savePermissions(view);
    setDraft(null);
  };

  const _trustBadgeVariant =
    trust?.decision === "trusted" || trust?.decision === "once"
      ? "info"
      : trust?.decision === "drifted"
        ? "warning"
        : "outline";

  return (
    <SettingsCard title="Permissions">
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-border/60">
          <SettingsRow label="Safety level" description={selected.description}>
            <OptionField
              label="Safety level"
              value={view.posture}
              options={POSTURE_OPTIONS}
              onChange={(posture) => {
                if (POSTURES.includes(posture)) patch({ posture });
              }}
            />
          </SettingsRow>
          {allowAll && (
            <p
              role="note"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {view.posture === "yolo"
                  ? "Yolo removes every safeguard. Only use it on a throwaway machine."
                  : "Auto lets the agent work without asking, for everyone using it."}
              </span>
            </p>
          )}

          <SettingsRow
            label="Trust this project"
            htmlFor="permissions-trust-project"
            description={
              trustImplied
                ? "Included in the Trusted level and above."
                : "Let this project's own instructions guide the agent."
            }
          >
            <Switch
              id="permissions-trust-project"
              checked={trustImplied || view.trustProject}
              disabled={trustImplied}
              onCheckedChange={(checked) => patch({ trustProject: checked })}
            />
          </SettingsRow>

          <SettingsRow
            label="Shell tool"
            htmlFor="permissions-shell"
            description="Let the agent run terminal commands."
          >
            <Switch
              id="permissions-shell"
              checked={!view.noShell}
              onCheckedChange={(checked) => patch({ noShell: !checked })}
            />
          </SettingsRow>
        </div>

        {differenceNote && <Note>{differenceNote}</Note>}

        {runtime.permissions?.operatorSettings && (
          <Note>
            A separate settings file is also in use. The safety level chosen
            here takes priority over it.
          </Note>
        )}

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
            variant="action"
            className="rounded-full"
            disabled={!dirty || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}
