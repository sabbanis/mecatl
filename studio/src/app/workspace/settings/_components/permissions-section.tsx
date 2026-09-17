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

/** The ladder, lowest tier first, with the plain-language consequence of
 *  each tier for the person choosing it. */
export const POSTURE_OPTIONS: readonly {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: "strict",
    label: "Strict",
    description:
      "Ask before every file change and shell command. Nothing checked into the project can widen that.",
  },
  {
    value: "trusted",
    label: "Trusted",
    description:
      "Honour this project's allow rules, soul, agents, commands and skills. Still asks where no rule allows.",
  },
  {
    value: "auto",
    label: "Auto",
    description:
      "Auto-approve tools; ask only where a rule says so. For unattended runs.",
  },
  {
    value: "yolo",
    label: "Yolo",
    description:
      "Auto-run everything, including subagent shell substitutions. Isolated, disposable machines only.",
  },
];

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
 * Why the daemon's EFFECTIVE posture (capabilities.posture) differs from the
 * SAVED one, or null when they agree. Studio passes `--posture` explicitly,
 * so an imported settings file cannot be the cause; the one expected raise
 * is Studio's own trust flag (mecated folds `--trust-project` to at least
 * `trusted`). Anything else is most likely a restart still in flight.
 * Exported for its vitest.
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
  if (
    saved === "strict" &&
    effective === "trusted" &&
    (trustProject || trustOnce)
  ) {
    return trustOnce && !trustProject
      ? "Trusting this project for this controller session raises the effective posture to trusted."
      : "Trusting this project raises the effective posture to trusted.";
  }
  if (postureRank(effective) > postureRank(saved)) {
    return `The daemon reports ${effective}, above the saved ${saved}. It may still be restarting on the new flags; if this stays, something in the daemon's own environment raised it.`;
  }
  return `The daemon reports ${effective}, below the saved ${saved}. It may still be restarting on the new flags.`;
}

/**
 * The "Project trust" row's badge text for the controller's resolved
 * decision (mecatui's trust states, as words). Exported for its vitest.
 */
export function trustRowLabel(trust: HarnessTrustState): string {
  switch (trust.decision) {
    case "trusted":
      return trust.source === "posture"
        ? "Trusted (by the posture)"
        : "Trusted (remembered)";
    case "once":
      return "Trusted for this session";
    case "drifted":
      return "Untrusted — instructions changed";
    default:
      return "Untrusted";
  }
}

/** The row's explanation: what the decision means and what it cannot see. */
function trustRowDescription(
  trust: HarnessTrustState,
  posture: string,
): string {
  const residual =
    "A grant made in mecatui or settings.yaml is not visible here.";
  switch (trust.decision) {
    case "trusted":
      return trust.source === "posture"
        ? `The ${posture} posture trusts the project on its own; the trust switch and the anchor do not matter at this tier.`
        : "Studio remembers this grant and re-checks the project's soul, agents, commands and skills at every daemon start; a change withholds the grant until you trust the project again.";
    case "once":
      return "Granted for this controller session only — it lasts until Studio's controller restarts and is never saved.";
    case "drifted":
      return "The project's soul, agents, commands or skills changed since you trusted it, so the daemon started without the grant (checked at each start). Review the changes, then trust it again.";
    default:
      return trust.hasAuthority
        ? `This project ships instructions (soul, agents, commands, skills or allow rules) that Mecatl withholds until you trust it. ${residual}`
        : `This project ships no instructions a grant would admit. ${residual}`;
  }
}

/**
 * The daemon-wide operator posture, project trust and shell-less mode —
 * mecated spawn flags owned by Studio's controller (never a settings.yaml
 * key). Every save restarts the daemon. This is NOT the composer's
 * per-session Mode selector: that is the session permission mode; this is
 * the ceiling every session runs under.
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
  // compatibility document; the row renders only when it is present.
  const effective =
    typeof serverCapabilities.posture === "string"
      ? serverCapabilities.posture
      : null;

  const effectiveRow =
    effective !== null ? (
      <SettingsRow
        label="Effective posture"
        description="What the daemon reports it is running at right now."
      >
        <Badge variant={badgeVariantFor(effective)}>{effective}</Badge>
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
            The controller did not report its permissions. Restart Studio (task
            studio:dev) so the current controller is running.
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
        title: `Switch to the ${view.posture} posture?`,
        description: `Allow-all waives the built-in ask before every file change and shell command — daemon-wide, for every session. Only a Deny in any scope and a deliberately configured Ask still apply.${
          view.posture === "yolo"
            ? " Yolo also lets a subagent run $() and backtick substitutions unreviewed — the child prompt-injection defence is off. Use it on an isolated, disposable machine only."
            : ""
        } mecated refuses this posture as root outside a declared sandbox. The daemon restarts and in-flight runs end.`,
        confirmText: `Switch to ${view.posture}`,
        destructive: true,
      });
      if (!confirmed) return;
    }
    await runtime.savePermissions(view);
    setDraft(null);
  };

  // "Forget trust" is the ordinary document write with the switch off (the
  // controller clears the stored anchor). "Trust again" is the explicit
  // grant route (`runtime.trustProject`, POST /permissions/trust): it
  // re-stamps the LIVE anchor, which a plain save with the switch already on
  // deliberately does not (an unrelated save must never quietly re-accept
  // drifted instructions). Both restart the daemon; the hook re-reads the
  // document afterwards and lands a refusal in `runtime.error`.
  const forgetTrust = async () => {
    await runtime.savePermissions({
      posture: saved.posture,
      trustProject: false,
      noShell: saved.noShell,
    });
    setDraft(null);
  };
  const trustAgain = async () => {
    await runtime.trustProject();
    // The row reads the controller's decision off the status poll; ask it
    // now so the badge flips as soon as the restarted daemon answers.
    await runtimeStatus.refresh?.();
  };
  const trustBusy = runtime.busy === "trust";
  const trustBadgeVariant =
    trust?.decision === "trusted" || trust?.decision === "once"
      ? "info"
      : trust?.decision === "drifted"
        ? "warning"
        : "outline";

  return (
    <SettingsCard
      title="Permissions"
      description="The daemon-wide operator posture every session runs under. The Mode selector in the composer (Manual, Accept edits, Plan) is per session and separate."
    >
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Operator posture"
            description={selected.description}
          >
            <OptionField
              label="Operator posture"
              value={view.posture}
              options={POSTURE_OPTIONS.map(({ value, label }) => ({
                value,
                label,
              }))}
              onChange={(posture) => {
                if (POSTURES.includes(posture)) patch({ posture });
              }}
            />
          </SettingsRow>

          <SettingsRow
            label="Trust this project"
            htmlFor="permissions-trust-project"
            description={
              trustImplied
                ? `Implied by the ${view.posture} posture: mecated raises project trust for trusted and above.`
                : "Honour the project's checked-in allow rules, AGENTS.md, soul, agents, commands and skills. Only for a repository you trust — a checked-in allow rule can auto-approve tool calls."
            }
          >
            <Switch
              id="permissions-trust-project"
              checked={trustImplied || view.trustProject}
              disabled={trustImplied}
              onCheckedChange={(checked) => patch({ trustProject: checked })}
            />
          </SettingsRow>

          {trust && (
            <SettingsRow
              label="Project trust"
              description={trustRowDescription(trust, saved.posture)}
            >
              <Badge variant={trustBadgeVariant}>{trustRowLabel(trust)}</Badge>
              {trust.decision === "drifted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={trustBusy || busy}
                  onClick={() => void trustAgain()}
                >
                  {trustBusy ? "Trusting…" : "Trust again"}
                </Button>
              )}
              {saved.trustProject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={trustBusy || busy}
                  onClick={() => void forgetTrust()}
                >
                  Forget trust
                </Button>
              )}
            </SettingsRow>
          )}

          <SettingsRow
            label="Shell tool"
            htmlFor="permissions-shell"
            description="When off, the Shell tool is removed from the daemon's catalog; file tools stay available."
          >
            <Switch
              id="permissions-shell"
              checked={!view.noShell}
              onCheckedChange={(checked) => patch({ noShell: !checked })}
            />
          </SettingsRow>

          {effectiveRow}
        </div>

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
                ? "Yolo auto-runs every tool, including subagent shell substitutions, for every session on this daemon. Isolated, disposable machines only."
                : "Auto approves every tool call unless a rule says otherwise, for every session on this daemon."}
            </span>
          </p>
        )}

        {differenceNote && <Note>{differenceNote}</Note>}

        <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-[auto_1fr]">
          {POSTURE_OPTIONS.map((option) => (
            <div key={option.value} className="contents">
              <dt className="font-medium text-foreground">{option.label}</dt>
              <dd>{option.description}</dd>
            </div>
          ))}
        </dl>

        {runtime.permissions?.operatorSettings && (
          <Note>
            An imported operator settings file is active. Studio passes the
            posture as an explicit flag, so this setting overrides that
            file&rsquo;s <code className="font-mono">posture:</code> key in
            either direction.
          </Note>
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
