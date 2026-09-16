"use client";

import { ExternalLink, KeyRound, Link2, RefreshCw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthorizationRequest } from "@/features/agent";

/** The expiry line: a live countdown, or the nudge once it has passed. */
export function formatAuthorizationCountdown(
  expiresAt: number | undefined,
  now: number,
): string | null {
  if (expiresAt === undefined) return null;
  const remaining = Math.max(0, Math.round((expiresAt - now) / 1000));
  if (remaining === 0)
    return "The sign-in window has expired — re-check to confirm.";
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return minutes > 0
    ? `Expires in ${minutes}m ${seconds}s`
    : `Expires in ${seconds}s`;
}

type Action = "open" | "copy" | "recheck" | "cancel";

/**
 * The takeover card for a run parked on an MCP browser sign-in
 * (authorization.required): it replaces the composer until the sign-in is
 * confirmed or abandoned. Every action goes through the daemon's
 * AUTHORIZATION controls — the URL is fetched live when opened/copied, the
 * re-check streams the continuation, and cancel routes to the authorization
 * (never the parked run's own cancel).
 */
export function AuthorizationPanel({
  authorization,
  onOpen,
  onCopyLink,
  onRecheck,
  onCancel,
}: {
  authorization: AuthorizationRequest;
  onOpen: () => Promise<unknown>;
  onCopyLink: () => Promise<unknown>;
  onRecheck: () => Promise<unknown>;
  onCancel: () => Promise<unknown>;
}) {
  const headingId = useId();
  const [busy, setBusy] = useState<Action | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (authorization.expiresAt === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [authorization.expiresAt]);

  const run = (action: Action, handler: () => Promise<unknown>) => {
    return async () => {
      setBusy(action);
      try {
        await handler();
      } finally {
        setBusy(null);
      }
    };
  };

  const server = authorization.displayName.trim() || "An MCP server";
  const countdown = formatAuthorizationCountdown(authorization.expiresAt, now);

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy !== null}
      className="my-3 rounded-xl border border-info/30 bg-info/5 p-4"
    >
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="size-4 text-info" aria-hidden="true" />
        <h2 id={headingId} className="text-sm font-semibold text-info">
          Browser authorization required
        </h2>
      </div>
      <p className="mb-1 text-sm">
        {server} needs you to sign in in your browser to continue this tool
        call.
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        The run is paused until you finish the sign-in or cancel it.
        {countdown ? ` ${countdown}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={run("open", onOpen)}
          disabled={busy !== null}
          className="bg-info text-white hover:bg-info/90"
        >
          <ExternalLink aria-hidden="true" />
          Open sign-in page
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={run("copy", onCopyLink)}
          disabled={busy !== null}
          className="border-info/30 hover:bg-info/5"
        >
          <Link2 aria-hidden="true" />
          Copy link
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={run("recheck", onRecheck)}
          disabled={busy !== null}
          className="border-info/30 hover:bg-info/5"
        >
          <RefreshCw
            aria-hidden="true"
            className={busy === "recheck" ? "animate-spin" : undefined}
          />
          I've finished — re-check
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={run("cancel", onCancel)}
          disabled={busy !== null}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
      </div>
      {authorization.error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-destructive">
          {authorization.error}
        </p>
      ) : authorization.notice ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {authorization.notice}
        </p>
      ) : null}
    </section>
  );
}
