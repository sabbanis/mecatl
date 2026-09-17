"use client";

/**
 * The auth-failure recovery banner — Studio's analogue of the TUI's
 * `/connect` overlay, rendered at the point of failure by the runtime-status
 * provider whenever the liveness probe fails for a NAMED credential cause
 * (`offline-cause.ts`: sign-in required, session expired, credential
 * rejected, identity provider unreachable) instead of the generic "Mecatl is
 * unreachable." strip.
 *
 * It names the cause class and the remedy, and offers the actions that fit:
 *  - **Sign in / Sign in again** — only when `/api/auth/oidc/status` reports
 *    `configured: true` (read once when the banner mounts). Opens the
 *    server-tier PKCE flow in a popup SYNCHRONOUSLY on the click (popup-blocker
 *    safe); no token ever reaches this component (rule 3).
 *  - **Open sign-in settings** — the Settings → Provider page that hosts the
 *    remote sign-in card (issuer, signed-in identity, sign out).
 *  - **Retry** — the provider's immediate re-probe.
 *
 * Reconnect + resume: the banner listens for the callback page's
 * `mecatl-oidc` postMessage and for window focus and calls `onRetry` at once,
 * so the connection flips back without waiting for the 5-second poll. The
 * connected flip is the safe resume of the open chat: the provider re-runs
 * `fetchHarnessCompatibility`, and `use-agent-chat`'s `[sessionId, connected]`
 * effect rehydrates the authoritative transcript and re-attaches the durable
 * watch (a run driven elsewhere is picked up mid-flight; nothing is re-sent).
 *
 * Studio talks to exactly one deployment (MECATL_BASE_URL, server-owned), so
 * there is no saved-target list here: the ONE configured target is named by
 * its issuer, which is the only target identity the status route exposes
 * (the daemon URL itself is never rendered — rule 3).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OfflineCause } from "./offline-cause";

export const OIDC_STATUS_URL = "/api/auth/oidc/status";
export const OIDC_START_URL = "/api/auth/oidc/start";
export const OIDC_POPUP_NAME = "mecatl-oidc-login";
export const OIDC_POPUP_FEATURES = "width=520,height=680";
/** The callback page's postMessage type (`src/app/api/auth/oidc/[action]`). */
export const OIDC_CALLBACK_MESSAGE = "mecatl-oidc";
export const SIGN_IN_SETTINGS_HREF = "/workspace/settings/provider";

/** The subset of `/api/auth/oidc/status` the banner reads; never a token. */
export interface OidcSignInStatus {
  configured: boolean;
  state: "not-configured" | "signed-out" | "signed-in" | "expired";
  issuer?: string;
  problem?: string;
}

/** Reads the sign-in status once; null when the route cannot be read. */
export async function fetchOidcSignInStatus(
  signal?: AbortSignal,
): Promise<OidcSignInStatus | null> {
  try {
    const response = await fetch(OIDC_STATUS_URL, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<OidcSignInStatus>;
    if (typeof body.configured !== "boolean") return null;
    return {
      configured: body.configured,
      state: body.state ?? "not-configured",
      ...(typeof body.issuer === "string" ? { issuer: body.issuer } : {}),
      ...(typeof body.problem === "string" ? { problem: body.problem } : {}),
    };
  } catch {
    return null;
  }
}

/** Opens the server-tier authorize redirect in the sign-in popup. */
export function openOidcSignIn(): void {
  window.open(OIDC_START_URL, OIDC_POPUP_NAME, OIDC_POPUP_FEATURES);
}

const actionClass =
  "rounded border border-amber-600/40 px-2 py-0.5 font-medium hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600";

export function AuthRecoveryBanner({
  cause,
  onRetry,
}: {
  cause: OfflineCause;
  onRetry: () => void | Promise<void>;
}) {
  const [oidc, setOidc] = useState<OidcSignInStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOidcSignInStatus(controller.signal).then((status) => {
      if (!controller.signal.aborted) setOidc(status);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (
        event.origin === window.location.origin &&
        data?.type === OIDC_CALLBACK_MESSAGE
      ) {
        void onRetry();
      }
    };
    const onFocus = () => void onRetry();
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
    };
  }, [onRetry]);

  const signInLabel =
    cause.signIn === "sign-in-again"
      ? "Sign in again"
      : cause.signIn === "sign-in"
        ? "Sign in"
        : null;
  const showSignIn = signInLabel !== null && oidc?.configured === true;

  return (
    <div
      role="alert"
      data-offline-cause={cause.kind}
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300"
    >
      <span className="font-medium" title={cause.detail || undefined}>
        {cause.title}
      </span>
      <span className="hidden sm:inline">{cause.remedy}</span>
      {oidc?.issuer ? (
        <span className="hidden truncate md:inline">
          Target: <span className="font-mono">{oidc.issuer}</span>
        </span>
      ) : null}
      {showSignIn ? (
        <button type="button" onClick={openOidcSignIn} className={actionClass}>
          {signInLabel}
        </button>
      ) : null}
      <Link href={SIGN_IN_SETTINGS_HREF} className={actionClass}>
        Open sign-in settings
      </Link>
      <button
        type="button"
        onClick={() => void onRetry()}
        className={actionClass}
      >
        Retry
      </button>
    </div>
  );
}
