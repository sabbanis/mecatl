"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  type PostureDefenses,
  type PostureTone,
  postureDefenses,
  postureSummary,
  postureTone,
} from "@/lib/posture";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

const TITLE = "Operator posture";

const toneVariant: Record<PostureTone, "muted" | "warning" | "destructive"> = {
  muted: "muted",
  warning: "warning",
  danger: "destructive",
};

/**
 * The four defenses a tier switches on or off, in the TUI's order, each
 * with the plain consequence of "on". Exported for the vitest.
 */
export const POSTURE_DEFENSE_ROWS: readonly {
  key: keyof PostureDefenses;
  label: string;
  description: string;
  /** How "on" reads: the three permissive switches widen what runs without
   *  an ask (warning); project trust is a scope decision (info). */
  onVariant: "warning" | "info";
}[] = [
  {
    key: "allowAll",
    label: "Allow-all tools",
    description:
      "The built-in ask before every file change and shell command is waived for every session.",
    onVariant: "warning",
  },
  {
    key: "mainSubstitution",
    label: "Main-session $()/heredoc auto-run",
    description:
      "Shell commands with command substitution, backticks or heredocs run in the main session without an ask.",
    onVariant: "warning",
  },
  {
    key: "childSubstitution",
    label: "Child $()/heredoc auto-run (injection defense off)",
    description:
      "Subagents run those substitutions unreviewed — the child prompt-injection defense is off. Yolo only.",
    onVariant: "warning",
  },
  {
    key: "projectTrust",
    label: "Project trust",
    description:
      "The project's checked-in allow rules, AGENTS.md, soul, agents, commands and skills are honoured.",
    onVariant: "info",
  },
];

/**
 * The daemon-wide operator posture AS THE DAEMON REPORTS IT
 * (`capabilities.posture` off GET /v1/compatibility) and the four defenses
 * that tier switches on — the TUI's `/posture` one-liner as a card. Read
 * only: the tier is changed on the Permissions page (managed mode) or by
 * the deployment (external mode); this card exists so a person can see,
 * in one place, what the ceiling every session runs under actually is.
 * The composer's Mode pill is the per-session axis, a different thing.
 */
export function PostureCard() {
  const { connected, mode, serverCapabilities, permissions } =
    useRuntimeStatus();

  if (!connected) {
    return (
      <SettingsCard title={TITLE}>
        <OfflineNote />
      </SettingsCard>
    );
  }

  // CAPABILITY GATE: an older daemon omits the posture from its
  // compatibility document; say so rather than guessing a tier.
  const reported =
    typeof serverCapabilities.posture === "string"
      ? serverCapabilities.posture
      : "";

  const footer =
    mode === "external" ? (
      <ExternalManagedNote />
    ) : (
      <Note>
        {permissions ? (
          <>
            Configured on the Permissions page as{" "}
            <span className="font-mono">{permissions.posture}</span>
            {reported !== "" && reported !== permissions.posture ? (
              <>
                {" "}
                (the daemon reports{" "}
                <span className="font-mono">{reported}</span>)
              </>
            ) : null}
            .{" "}
          </>
        ) : null}
        <Link
          href="/workspace/settings/permissions"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Change posture
        </Link>
      </Note>
    );

  if (reported === "") {
    return (
      <SettingsCard
        title={TITLE}
        description="The daemon-wide ceiling every session runs under, as the daemon reports it."
      >
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-border/60">
            <SettingsRow
              label="Tier"
              description="This daemon does not include its posture in its compatibility document; update mecated to see the tier and its defenses here."
            >
              <span className="text-sm text-muted-foreground">
                Not reported by this daemon
              </span>
            </SettingsRow>
          </div>
          {footer}
        </div>
      </SettingsCard>
    );
  }

  const defenses = postureDefenses(reported);
  const summary = postureSummary(reported);

  return (
    <SettingsCard
      title={TITLE}
      description="The daemon-wide ceiling every session runs under, as the daemon reports it. The Mode selector in the composer is per session and separate."
    >
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Tier"
            description="What the daemon reports it is running at right now."
          >
            <Badge
              variant={toneVariant[postureTone(reported)]}
              data-testid="posture-tier"
            >
              {reported}
            </Badge>
          </SettingsRow>
          {POSTURE_DEFENSE_ROWS.map((row) => {
            const on = defenses[row.key];
            return (
              <SettingsRow
                key={row.key}
                label={row.label}
                description={row.description}
              >
                <Badge
                  variant={on ? row.onVariant : "muted"}
                  data-testid={`posture-defense-${row.key}`}
                  data-on={on ? "true" : "false"}
                >
                  {on ? "on" : "off"}
                </Badge>
              </SettingsRow>
            );
          })}
        </div>

        <Note>
          Deny rules and configured Ask rules always apply, at every tier.
        </Note>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
          <code
            className="min-w-0 flex-1 break-words font-mono text-xs text-muted-foreground"
            data-testid="posture-summary"
          >
            {summary}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard
                .writeText(summary)
                .then(() => toast.success("Posture summary copied"))
                .catch(() => toast.error("Couldn't copy — clipboard blocked"));
            }}
          >
            <Copy className="size-4" />
            Copy
          </Button>
        </div>

        {footer}
      </div>
    </SettingsCard>
  );
}
