"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/typography";

/** One-click prompts on the draft state, to seed the first message. */
export const STARTER_PROMPTS = [
  "Summarise what changed in the repo this week",
  "Draft a plan for a new feature",
  "Review my open pull requests",
  "Find and explain a bug in the codebase",
] as const;

/** Where a first visit most often wants to go next. */
const WELCOME_LINKS = [
  { href: "/workspace/shortcuts", label: "Keyboard shortcuts & features" },
  { href: "/workspace/settings", label: "Settings" },
  { href: "/workspace/skills", label: "Skills" },
] as const;

const chipClass =
  "rounded-full border border-border bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The draft chat's greeting: an optional first-run welcome card, the
 * "What can I help you with?" heading (always), and the starter-prompt chips
 * (hideable — the web analogue of the TUI's `--no-banner`).
 *
 * The caller owns both preferences (see `useWelcomeDismissed` /
 * `useShowStarterPrompts`) and the connected gate: the card is never
 * rendered while the daemon is connecting or offline — the OfflineBanner
 * owns that moment — which also keeps it off the SSR frame.
 */
export function DraftGreeting({
  showWelcome,
  onDismissWelcome,
  showStarterPrompts,
  onPickSeed,
}: {
  showWelcome: boolean;
  onDismissWelcome: () => void;
  showStarterPrompts: boolean;
  onPickSeed: (text: string) => void;
}) {
  return (
    <>
      {showWelcome && <WelcomeCard onDismiss={onDismissWelcome} />}
      <h1 className={pageTitleClass("pb-0 text-center text-3xl leading-tight")}>
        What can I help you with?
      </h1>
      {showStarterPrompts && (
        <div className="flex flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPickSeed(p)}
              className={chipClass}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The first-run introduction. Dismissing it is a one-time, persisted
 * decision; Settings → Personalize → "Welcome card" brings it back. Carries
 * the operator-brandable logo so a branded deployment's splash is its own.
 */
function WelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="draft-welcome-heading"
      data-testid="welcome-card"
      className="rounded-xl border border-border bg-card p-5 text-center"
    >
      <BrandLogo
        size="lg"
        className="mx-auto shrink-0 brightness-0 dark:brightness-100"
      />
      <h2 id="draft-welcome-heading" className="mt-4 text-lg font-semibold">
        Welcome to Mecatl Studio
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Chat with the Mecatl agent, schedule runs, and manage skills and memory
        — everything here comes from the connected daemon.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {WELCOME_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={chipClass}>
            {link.label}
          </Link>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground"
          aria-label="Dismiss welcome"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </section>
  );
}
