"use client";

import Link from "next/link";
import { useId } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OfflineCause } from "@/features/agent/offline-cause";
import {
  type RuntimeStatus,
  useRuntimeStatus,
} from "@/features/agent/runtime-status";
import { cn } from "@/lib/utils";

/**
 * The shell-level connection indicator: the web analogue of mecatui's
 * "connected" status line (`cmd/mecatui/ui/view.go`). Studio otherwise
 * renders only the FAILURE states — the offline banner, the auth-recovery
 * banner, the API-skew alert — so the healthy state was inferred from the
 * absence of a banner. This pill states it: a dot plus "Connected" /
 * "Connecting…" / "Offline" / "Sign in required" / "Credential rejected",
 * visible on every workspace page because it sits in the top navigation.
 *
 * It adds NO probe of its own — everything comes from the 5-second
 * `RuntimeStatusProvider` poll, so it can never disagree with the banners.
 * The tooltip carries the daemon facts that poll already holds: managed
 * `mecated` vs an external daemon, the provider (managed mode only — the
 * external-mode control status is a stub — with the offline mock flagged),
 * the operator's deployment label, and `Posture: <tier>` when the
 * compatibility document carries one. Empty values are simply omitted, so
 * an older daemon or an external deployment gets a shorter tooltip, never a
 * blank line.
 *
 * Accessibility: the pill is wrapped in a `role="status"` live region named
 * by its label, so a screen reader hears the flip (connected → offline →
 * connected) without the user hunting for it; the trigger is a link to
 * Settings → Diagnostics, so it is keyboard reachable and focusing it opens
 * the tooltip. Colours are fixed shell-band values like the rest of
 * `top-nav.tsx` (the nav sits on the green gradient in both themes).
 */

export const DIAGNOSTICS_SETTINGS_HREF = "/workspace/settings/diagnostics";

/** The three visual tones — one dot colour each. */
type ConnectionTone = "connected" | "connecting" | "offline";

export interface ConnectionDescription {
  /** The runtime connection state as the provider reported it. */
  state: RuntimeStatus["state"];
  tone: ConnectionTone;
  /** The short visible pill text; doubles as the live region's name. */
  label: string;
  /** The tooltip, one fact per line, in render order. Never empty. */
  lines: string[];
  /** The named offline cause (`OfflineCause.kind`); "" unless offline. */
  cause: OfflineCause["kind"] | "";
}

/** The subset of the runtime status the description reads. */
export type ConnectionFacts = Pick<
  RuntimeStatus,
  "state" | "mode" | "provider" | "isMock" | "deployment" | "offlineCause"
> & {
  /** The raw capability record — `posture` is narrowed here so the
   *  description tolerates an older daemon that omits it. */
  serverCapabilities: Record<string, unknown>;
};

/** Tooltip lines stay one glance long: the server's own detail is clamped. */
const MAX_DETAIL_CHARS = 160;

function clampDetail(detail: string): string {
  const trimmed = detail.trim();
  if (trimmed.length <= MAX_DETAIL_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_DETAIL_CHARS - 1).trimEnd()}…`;
}

function offlineLabel(cause: OfflineCause | null): string {
  switch (cause?.kind) {
    case "login-required":
    case "session-expired":
      return "Sign in required";
    case "credential-rejected":
      return "Credential rejected";
    default:
      // Plain connectivity, and an unreachable identity provider (the
      // tooltip names it); the banner carries the remedy either way.
      return "Offline";
  }
}

/**
 * Describes the runtime status for the chrome. Pure, so the copy table is
 * pinned directly and the component only renders it.
 */
export function describeConnection(
  facts: ConnectionFacts,
): ConnectionDescription {
  if (facts.state === "connecting") {
    return {
      state: "connecting",
      tone: "connecting",
      label: "Connecting…",
      lines: ["Connecting to Mecatl…"],
      cause: "",
    };
  }
  if (facts.state === "offline") {
    const cause = facts.offlineCause;
    const lines = [cause?.title ?? "Mecatl is unreachable."];
    const detail = cause?.detail ? clampDetail(cause.detail) : "";
    if (detail && detail !== lines[0]) lines.push(detail);
    return {
      state: "offline",
      tone: "offline",
      label: offlineLabel(cause),
      lines,
      cause: cause?.kind ?? "connectivity",
    };
  }
  const lines = [
    facts.mode === "external"
      ? "Connected to an external daemon"
      : "Connected to mecated",
  ];
  // The provider is a managed-mode fact: the external-mode control status
  // is a stub whose provider is the literal "external daemon".
  const provider = facts.mode === "managed" ? facts.provider.trim() : "";
  if (provider) {
    lines.push(
      facts.isMock
        ? `Provider: ${provider} (offline mock)`
        : `Provider: ${provider}`,
    );
  }
  const deployment = facts.deployment.trim();
  if (deployment) lines.push(`Deployment: ${deployment}`);
  const posture =
    typeof facts.serverCapabilities.posture === "string"
      ? facts.serverCapabilities.posture.trim()
      : "";
  if (posture) lines.push(`Posture: ${posture}`);
  return {
    state: "connected",
    tone: "connected",
    label: "Connected",
    lines,
    cause: "",
  };
}

const DOT_CLASS: Record<ConnectionTone, string> = {
  connected: "bg-emerald-400",
  connecting: "bg-amber-400 animate-pulse motion-reduce:animate-none",
  offline: "bg-red-400",
};

/**
 * The presentational pill: a `role="status"` live region around a link to
 * the Diagnostics page, styled for the dark shell band. Below 500px the
 * text collapses to screen-reader-only and the dot alone carries the state.
 */
export function ConnectionPill({
  described,
}: {
  described: ConnectionDescription;
}) {
  const labelId = useId();
  return (
    <span
      role="status"
      aria-live="polite"
      aria-labelledby={labelId}
      className="shrink-0"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={DIAGNOSTICS_SETTINGS_HREF}
            data-testid="connection-indicator"
            data-connection={described.state}
            data-cause={described.cause || undefined}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-2.5 text-[12px] font-semibold text-(--nav-icon) transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            <span
              aria-hidden="true"
              data-testid="connection-indicator-dot"
              className={cn(
                "size-2 shrink-0 rounded-full",
                DOT_CLASS[described.tone],
              )}
            />
            <span id={labelId} className="max-[499px]:sr-only">
              {described.label}
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-pretty">
          {described.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

/**
 * The context-reading indicator for the top navigation. Always renders —
 * unlike the posture badge there is no quiet state: the whole point is
 * that the healthy state is stated, not inferred.
 */
export function ConnectionIndicator() {
  const status = useRuntimeStatus();
  return <ConnectionPill described={describeConnection(status)} />;
}
