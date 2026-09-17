"use client";

import {
  AtSign,
  Brain,
  CalendarClock,
  CircleHelp,
  type LucideIcon,
  Plug,
  Slash,
} from "lucide-react";
import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";
import { useRuntimeStatus } from "@/features/agent/runtime-status";

/**
 * The draft chat's welcome splash extras — mecatui's zero-state welcome
 * card (`cmd/mecatui/ui/welcome/welcome.go` Info; `cmd/mecatui/ui/help.go`
 * zeroStateRows / zeroStateMemoryNote / zeroStateGatewayNote) as the two
 * pieces DraftView mounts around the greeting:
 *
 * - `WelcomeMascot` — the mascot artwork above the greeting. Decorative
 *   (empty alt) and hidden on narrow or short viewports so the composer
 *   keeps its place. `public/mecatito.png` is a 240px web copy; the
 *   repo-root `assets/mecatito.png` is CANONICAL (the TUI embeds its own
 *   copy under `cmd/mecatui/ui/welcome/assets/`) — regenerate the copy from
 *   it, never edit the copy.
 * - `WelcomeHints` — the capability-tailored affordance rows plus the
 *   identity line. Every row is gated on what the connected daemon reports
 *   (`serverCapabilities`, snake_case wire keys, `=== true` — absence reads
 *   as off) or on the controller's status, so the card advertises only
 *   what is ON, like the TUI's (the "[not enabled]" rows belong to the help
 *   reference). Nothing renders while the daemon is connecting or offline:
 *   the OfflineBanner owns that moment, and it keeps the rows off the SSR
 *   frame.
 *
 * NOT reproduced, by decision: the kitty-graphics / emoji environment
 * gating (terminal rendering mechanics), the cwd line (ADR 0291 — session
 * placement is path-free), the model line (the composer's picker already
 * names it) and the version (Settings → Help & about).
 */

/** The web copy of the mascot; see the module comment for the canonical file. */
export const WELCOME_MASCOT_SRC = "/mecatito.png";

/** The controller's display name for the ToolHive LLM gateway provider. */
const TOOLHIVE_LLM_PROVIDER = "ToolHive LLM gateway";

type WelcomeHintId =
  | "slash"
  | "agents"
  | "shortcuts"
  | "memory"
  | "gateway"
  | "toolhive"
  | "scheduling";

export interface WelcomeHint {
  readonly id: WelcomeHintId;
  /** The key that opens the affordance, rendered as a keycap; icon rows omit it. */
  readonly key?: string;
  readonly text: string;
  /** Where the row links — the text becomes the link. */
  readonly href?: string;
}

/** The runtime facts the rows read (a subset of `RuntimeStatus`). */
export interface WelcomeHintInput {
  readonly serverCapabilities: Record<string, unknown>;
  /** The controller's connected MCP gateway (managed mode), or null. */
  readonly gateway: { readonly name: string } | null;
  /** Whether the ToolHive LLM gateway is reachable right now. */
  readonly toolhiveAvailable: boolean;
  /** The active provider's display name ("" when unknown). */
  readonly provider: string;
}

/**
 * The affordance rows, in render order. At most six: the gateway slot is
 * ONE row — a connected MCP gateway wins over the ToolHive-LLM-detected
 * note (the TUI's N2 note, shown only while ToolHive is available but not
 * the active provider).
 */
export function deriveWelcomeHints(
  input: WelcomeHintInput,
): readonly WelcomeHint[] {
  const caps = input.serverCapabilities;
  const on = (key: string) => caps[key] === true;
  const hints: WelcomeHint[] = [];
  // Built-in slash commands always exist (/help, /clear, /diagnostics…);
  // skills ride the same key only where the deployment enables them.
  hints.push({
    id: "slash",
    key: "/",
    text: on("skills") ? "Slash commands and skills" : "Slash commands",
  });
  if (on("agents")) {
    hints.push({ id: "agents", key: "@", text: "Mention an agent" });
  }
  hints.push({
    id: "shortcuts",
    key: "?",
    text: "Keyboard shortcuts and features",
    href: "/workspace/shortcuts",
  });
  if (on("memory")) {
    hints.push({
      id: "memory",
      text: "Cross-session memory is on — context carries across runs",
    });
  }
  if (input.gateway) {
    hints.push({
      id: "gateway",
      text: `MCP gateway ${input.gateway.name} connected`,
    });
  } else if (
    input.toolhiveAvailable &&
    input.provider !== TOOLHIVE_LLM_PROVIDER
  ) {
    hints.push({
      id: "toolhive",
      text: "ToolHive LLM gateway detected — no API key needed",
      href: "/workspace/settings/provider",
    });
  }
  if (on("scheduling")) {
    hints.push({
      id: "scheduling",
      text: "Scheduled runs are available",
      href: "/workspace/schedules",
    });
  }
  return hints;
}

/** The runtime facts the identity line reads (a subset of `RuntimeStatus`). */
export interface WelcomeIdentityInput {
  readonly provider: string;
  readonly mode: "managed" | "external";
  readonly serverCapabilities: Record<string, unknown>;
  /** Operator-set deployment label ("" when unset). */
  readonly deployment: string;
}

/**
 * The TUI's identity strip, minus the model (the composer names it):
 * `Connected · <provider> · posture <tier> · <deployment>`. The provider
 * falls back to managed/external daemon when the controller reports none
 * (in external mode the proxy already names it "external daemon"); the
 * posture segment is capability-gated — an older daemon that reports no
 * tier gets no segment, never a guessed one. Never a URL or host (the
 * same-origin proxy hides the daemon address by design).
 */
export function deriveWelcomeIdentity(input: WelcomeIdentityInput): string {
  const parts = [
    "Connected",
    input.provider ||
      (input.mode === "external" ? "external daemon" : "managed daemon"),
  ];
  const posture = input.serverCapabilities.posture;
  if (typeof posture === "string" && posture.trim() !== "") {
    parts.push(`posture ${posture.trim()}`);
  }
  if (input.deployment) parts.push(input.deployment);
  return parts.join(" · ");
}

const HINT_ICONS: Record<WelcomeHintId, LucideIcon> = {
  slash: Slash,
  agents: AtSign,
  shortcuts: CircleHelp,
  memory: Brain,
  gateway: Plug,
  toolhive: Plug,
  scheduling: CalendarClock,
};

/** The mascot above the greeting — decorative, and out of the way on small screens. */
export function WelcomeMascot() {
  return (
    // biome-ignore lint/performance/noImgElement: a static public asset; the next/image optimizer is not applicable here
    <img
      src={WELCOME_MASCOT_SRC}
      alt=""
      width={94}
      height={120}
      decoding="async"
      data-testid="welcome-mascot"
      className="mx-auto block h-[120px] w-auto select-none max-[499px]:hidden [@media(max-height:640px)]:hidden"
    />
  );
}

/** The capability-tailored hint rows and the identity line (connected only). */
export function WelcomeHints() {
  const runtime = useRuntimeStatus();
  if (!runtime.connected) return null;
  const hints = deriveWelcomeHints(runtime);
  const identity = deriveWelcomeIdentity(runtime);
  return (
    <section
      aria-label="What you can do here"
      data-testid="welcome-hints"
      className="space-y-3 pt-2 text-muted-foreground"
    >
      <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {hints.map((hint) => {
          const Icon = HINT_ICONS[hint.id];
          return (
            <li
              key={hint.id}
              data-hint={hint.id}
              className="flex items-center gap-2.5"
            >
              <span className="flex w-8 shrink-0 justify-center">
                {hint.key ? (
                  <Kbd>{hint.key}</Kbd>
                ) : (
                  <Icon className="size-4" aria-hidden="true" />
                )}
              </span>
              {hint.href ? (
                <Link
                  href={hint.href}
                  className="rounded underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {hint.text}
                </Link>
              ) : (
                <span>{hint.text}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs" data-testid="welcome-identity">
        {identity}
      </p>
    </section>
  );
}
