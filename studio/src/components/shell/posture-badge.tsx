"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { knownPostureTier } from "@/lib/posture";
import { cn } from "@/lib/utils";

/**
 * The shell-level posture badge: the web analogue of mecatui's chrome
 * badge (`cmd/mecatui/ui/view.go` `postureBadgeRender`) and the reason the
 * daemon publishes `capabilities.posture` at all — the proto comment says
 * "CHROME ONLY — a client renders an honest ⚠ auto/⚠ yolo badge".
 *
 * It sits in the top navigation so it is visible on EVERY workspace page,
 * not only in a chat: a user who wanders into Settings or Skills under a
 * yolo daemon still sees it. The chat status strip's own badge
 * (`chat-status-strip.tsx`) stays; it carries the `/posture` sentence for
 * the session view, this one carries the plain "what does this mean and
 * where do I change it" sentence for the chrome.
 *
 * Tiers (the SDK's `ServerPosture`, mecated's `--posture` ladder):
 * - `strict` (the default) and an absent value render NOTHING — strict is
 *   the quiet floor and an older daemon omits the field (capability gate).
 * - `trusted` renders a quiet "Trusted project" chip. The proto comment
 *   shows no badge here, but Studio's own trust switch / trust-once is
 *   exactly what makes the daemon report `trusted`, so the chip is worded
 *   as PROJECT trust (the project's instructions are honoured) and points
 *   at the Permissions page's Project trust row.
 * - `auto` renders a warning "⚠ auto" (allow-all: mutating tools no longer
 *   ask unless a rule says ask).
 * - `yolo` renders a danger "⚠ yolo" (allow-all AND the child
 *   prompt-injection defense is off).
 * - Any other non-empty string renders a quiet chip with the raw value:
 *   an unknown tier stays observable rather than silently hidden.
 *
 * The chip links to Settings → Permissions, where the tier is explained
 * and (for a managed daemon) changed. Nothing here decides anything — it
 * only spells out the daemon's own resolved posture.
 */

export const PERMISSIONS_SETTINGS_HREF = "/workspace/settings/permissions";

type PostureBadgeTone = "neutral" | "warning" | "danger";

export interface PostureDescription {
  /** The tier token as the daemon reported it (trimmed). */
  tier: string;
  /** The short visible chip text. */
  label: string;
  tone: PostureBadgeTone;
  /** The full plain-language sentence: what the tier means and where to
   *  change it. Doubles as the chip's accessible name and its tooltip. */
  title: string;
}

/**
 * Describes a `serverCapabilities.posture` value for the chrome, or null
 * when the chrome should show nothing (absent, empty, non-string, or the
 * default `strict` tier).
 */
export function describePosture(value: unknown): PostureDescription | null {
  if (typeof value !== "string") return null;
  const tier = value.trim();
  if (tier === "") return null;
  switch (knownPostureTier(tier)) {
    case "strict":
      return null;
    case "trusted":
      return {
        tier,
        label: "Trusted project",
        tone: "neutral",
        title:
          "Project instructions are trusted — the project's allow rules, AGENTS.md, soul, agents, commands and skills apply. Review this under Settings → Permissions → Project trust.",
      };
    case "auto":
      return {
        tier,
        label: "⚠ auto",
        tone: "warning",
        title:
          "Operator posture: auto — tool calls are auto-approved unless a rule says ask. Change it in Settings → Permissions.",
      };
    case "yolo":
      return {
        tier,
        label: "⚠ yolo",
        tone: "danger",
        title:
          "Operator posture: yolo — tool calls are auto-approved and subagents run shell substitutions without asking. Change it in Settings → Permissions.",
      };
    default:
      return {
        tier,
        label: tier,
        tone: "neutral",
        title: `Operator posture: ${tier} — a tier this Studio does not know. See Settings → Permissions.`,
      };
  }
}

const TONE_CLASS: Record<PostureBadgeTone, string> = {
  neutral: "bg-white/10 text-(--nav-icon) hover:bg-white/15 hover:text-white",
  warning: "bg-white/10 text-amber-300 hover:bg-white/15 hover:text-amber-200",
  danger: "bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-red-200",
};

/**
 * The presentational chip: a link to the Permissions page, styled for the
 * dark shell band. Renders nothing when `describePosture` has nothing to
 * say, so callers can pass the raw capability value straight through.
 */
export function PostureChip({ posture }: { posture: unknown }) {
  const described = describePosture(posture);
  if (!described) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={PERMISSIONS_SETTINGS_HREF}
          aria-label={described.title}
          data-testid="posture-badge"
          data-tone={described.tone}
          data-posture={described.tier}
          className={cn(
            "flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            TONE_CLASS[described.tone],
          )}
        >
          {described.label}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-pretty">
        {described.title}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The context-reading badge for the top navigation. Null while the daemon
 * is not connected (a stale posture must not outlive the daemon that
 * reported it) and whenever the reported tier earns no chrome.
 */
export function PostureBadge() {
  const { connected, serverCapabilities } = useRuntimeStatus();
  if (!connected) return null;
  return <PostureChip posture={serverCapabilities.posture} />;
}
