"use client";

/**
 * Remote sign-in card for OIDC-protected external deployments (requirement
 * H3), mounted by the provider settings page in external mode only. It is
 * also where the workspace's auth-recovery banner sends a signed-out or
 * expired session ("Open sign-in settings", `features/agent/auth-recovery-
 * banner.tsx`) — the web analogue of the TUI's `/connect` after a login
 * failure. Talks only to the server-tier auth routes (`/api/auth/oidc/*`);
 * no token ever reaches this component (rule 3) and no daemon address is
 * rendered.
 *
 * Beyond Sign in / Sign out it carries the `mecatui login` review step: an
 * RFC 9728-DISCOVERED profile (issuer, client id, audience, scopes) is listed
 * and stays default-deny until "Continue with browser login" confirms it
 * (the TUI's "Continue with browser login? [y/N]"); "Copy sign-in link" is
 * the `--no-browser` flow (the link opens in any browser that can reach this
 * Studio, whose callback completes the sign-in); and the deployment rows name
 * the credential ordering, the token store and the transport knobs the
 * deployment set (`--anonymous`, `--credential-store`, `--tls-ca`,
 * `--insecure`, `--private-issuer`, `--callback-timeout`). Sign in opens the
 * authorize redirect in a popup — the explicit user action H3.3 requires —
 * and the card refreshes on the callback page's `mecatl-oidc` message and on
 * window focus.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Note, SettingsCard, SettingsRow } from "./settings-card";

/** `/api/auth/oidc/status` — never token material, never an address. */
export type OidcStatus = {
  configured: boolean;
  state:
    | "not-configured"
    | "discovered"
    | "signed-out"
    | "signed-in"
    | "expired";
  problem?: string;
  source?: "env" | "discovery";
  issuer?: string;
  clientId?: string;
  audience?: string;
  scopes?: string[];
  profileHash?: string;
  subject?: string;
  email?: string;
  expiresAt?: string;
  authMode?: "oidc" | "static" | "anonymous";
  store?: { kind: "memory" | "file"; problem?: string };
  transport?: {
    tlsCa: boolean;
    insecure: boolean;
    privateIssuer: boolean;
    problem?: string;
  };
  callbackTimeoutSeconds?: number;
};

export const OIDC_START_URL = "/api/auth/oidc/start";
const POPUP_NAME = "mecatl-oidc-login";
const POPUP_FEATURES = "width=520,height=680";

type Notice = { tone: "info" | "error"; text: string };

export function OidcLoginCard() {
  const [status, setStatus] = useState<OidcStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/oidc/status", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setStatus((await response.json()) as OidcStatus);
      setFailed(false);
    } catch {
      setStatus(null);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (
        event.origin === window.location.origin &&
        data?.type === "mecatl-oidc"
      ) {
        void refresh();
      }
    };
    const onFocus = () => void refresh();
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const signIn = () => {
    // The route 302s straight to the issuer's authorize URL; the callback
    // page notifies this card and closes itself.
    window.open(OIDC_START_URL, POPUP_NAME, POPUP_FEATURES);
  };

  /** The review step's "yes": confirm the discovered profile the card shows,
   * then sign in. The popup opens SYNCHRONOUSLY on the click (popup-blocker
   * safe, the rule-20 idiom) but is pointed at the authorize redirect only
   * once the server accepted the confirmation — nothing reaches the issuer
   * for an unconfirmed profile. */
  const continueWithBrowserLogin = async () => {
    if (!status?.profileHash) return;
    const popup = window.open("about:blank", POPUP_NAME, POPUP_FEATURES);
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/oidc/confirm-discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileHash: status.profileHash }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        popup?.close();
        setNotice({
          tone: "error",
          text: body.error || "The discovered profile could not be confirmed.",
        });
        return;
      }
      if (popup) popup.location.href = OIDC_START_URL;
      else window.open(OIDC_START_URL, POPUP_NAME, POPUP_FEATURES);
    } catch {
      popup?.close();
      setNotice({
        tone: "error",
        text: "The discovered profile could not be confirmed right now.",
      });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  /** The `--no-browser` flow: mint one sign-in attempt and copy its URL. */
  const copySignInLink = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${OIDC_START_URL}?mode=link`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        authorizationUrl?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!response.ok || !body.authorizationUrl) {
        setNotice({
          tone: "error",
          text: body.error || "Could not create a sign-in link.",
        });
        return;
      }
      await navigator.clipboard.writeText(body.authorizationUrl);
      const until = body.expiresAt
        ? new Date(body.expiresAt).toLocaleTimeString()
        : "";
      setNotice({
        tone: "info",
        text: `Sign-in link copied. Open it in any browser that can reach this Studio${until ? ` before ${until}` : ""}; the sign-in completes here.`,
      });
    } catch {
      setNotice({
        tone: "error",
        text: "The sign-in link could not be copied to the clipboard.",
      });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/oidc/logout", { method: "POST" });
    } catch {
      // Local sign-out state is authoritative server-side; refresh shows it.
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <SettingsCard
      title="Remote sign-in"
      description="OIDC login to the external mecated deployment. Tokens stay in the Studio server and never reach this browser."
    >
      {failed ? (
        <Note>The sign-in status could not be read right now.</Note>
      ) : !status ? (
        <Note>Checking sign-in status…</Note>
      ) : status.state === "not-configured" ? (
        <div className="divide-y divide-border/60">
          <div className="pb-4">
            <Note>
              {status.problem ||
                "Not configured. Set MECATL_OIDC_ISSUER and MECATL_OIDC_CLIENT_ID (and optionally MECATL_OIDC_AUDIENCE) in Studio's environment — or MECATL_OIDC_DISCOVERY=1 to discover them from the deployment — to sign in to an OIDC-protected deployment."}
            </Note>
          </div>
          <DeploymentRows status={status} />
        </div>
      ) : status.state === "discovered" ? (
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Review the discovered sign-in profile"
            description="The deployment advertises this identity provider (RFC 9728). Nothing is sent to it until you continue."
          >
            <Button
              type="button"
              variant="action"
              className="rounded-full"
              disabled={busy}
              onClick={() => void continueWithBrowserLogin()}
            >
              {busy ? "Confirming…" : "Continue with browser login"}
            </Button>
          </SettingsRow>
          <ProfileRows status={status} />
          <DeploymentRows status={status} />
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {status.state === "signed-in" ? (
            <SettingsRow
              label="Signed in"
              description={
                status.email ||
                status.subject ||
                "Authenticated to the deployment."
              }
            >
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() => void signOut()}
              >
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </SettingsRow>
          ) : (
            <SettingsRow
              label={
                status.state === "expired" ? "Session expired" : "Not signed in"
              }
              description={
                status.state === "expired"
                  ? "The identity provider ended this session — sign in again."
                  : "Sign in opens the identity provider in a popup. Without a browser here, copy the sign-in link and open it anywhere that can reach this Studio."
              }
            >
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() => void copySignInLink()}
              >
                Copy sign-in link
              </Button>
              <Button
                type="button"
                variant="action"
                className="rounded-full"
                onClick={signIn}
              >
                {status.state === "expired" ? "Sign in again" : "Sign in"}
              </Button>
            </SettingsRow>
          )}
          <ProfileRows status={status} />
          <DeploymentRows status={status} />
        </div>
      )}
      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "error"
              ? "mt-3 text-xs text-destructive"
              : "mt-3 text-xs text-muted-foreground"
          }
        >
          {notice.text}
        </p>
      ) : null}
    </SettingsCard>
  );
}

function Value({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <span
      data-testid={testId}
      className="max-w-[28rem] break-all text-right font-mono text-xs"
    >
      {children}
    </span>
  );
}

/** The identity a sign-in binds to — the TUI's review lines (issuer,
 * audience, client ID, scopes), minus the address (rule 3). */
function ProfileRows({ status }: { status: OidcStatus }) {
  return (
    <>
      <SettingsRow
        label="Identity provider"
        description={
          status.source === "discovery"
            ? "Discovered from the deployment's protected-resource metadata."
            : "From MECATL_OIDC_ISSUER in Studio's environment."
        }
      >
        <Value testId="oidc-issuer">{status.issuer || "—"}</Value>
      </SettingsRow>
      <SettingsRow label="Client ID">
        <Value testId="oidc-client-id">{status.clientId || "—"}</Value>
      </SettingsRow>
      {status.audience ? (
        <SettingsRow label="Audience">
          <Value testId="oidc-audience">{status.audience}</Value>
        </SettingsRow>
      ) : null}
      <SettingsRow label="Scopes">
        <Value testId="oidc-scopes">
          {status.scopes?.length ? status.scopes.join(" ") : "—"}
        </Value>
      </SettingsRow>
    </>
  );
}

const AUTH_MODE_COPY: Record<NonNullable<OidcStatus["authMode"]>, string> = {
  oidc: "OIDC sign-in token (this card).",
  static: "Static bearer from MECATL_AUTH_TOKEN.",
  anonymous: "No credential — requests reach the deployment anonymously.",
};

function formatWindow(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${seconds} seconds`;
}

/** The deployment knobs behind this card, so what the proxy actually sends
 * — and how — is never a guess. */
function DeploymentRows({ status }: { status: OidcStatus }) {
  const transport = status.transport;
  const transportLines: string[] = [];
  if (transport?.tlsCa)
    transportLines.push("Private CA bundle from MECATL_TLS_CA.");
  if (transport?.privateIssuer)
    transportLines.push(
      "Plain-HTTP loopback / private issuer allowed (MECATL_OIDC_PRIVATE_ISSUER=1).",
    );
  if (transportLines.length === 0 && !transport?.insecure)
    transportLines.push("System trust store; HTTPS as MECATL_BASE_URL says.");
  return (
    <>
      {status.authMode ? (
        <SettingsRow
          label="Authentication"
          description={
            status.authMode === "anonymous" && status.configured
              ? "MECATL_AUTH_ANONYMOUS=1 — the sign-in above is not used for requests."
              : status.authMode === "static" && status.configured
                ? "MECATL_AUTH_PREFER_STATIC=1 — the static token outranks the sign-in above."
                : undefined
          }
        >
          <Value testId="oidc-auth-mode">
            {AUTH_MODE_COPY[status.authMode]}
          </Value>
        </SettingsRow>
      ) : null}
      {status.store ? (
        <SettingsRow
          label="Token store"
          description={
            status.store.problem ||
            (status.store.kind === "file"
              ? "Encrypted file (MECATL_OIDC_TOKEN_STORE=file) — the sign-in survives a Studio restart."
              : "Studio server memory — a Studio restart requires a fresh sign-in.")
          }
        >
          <Value testId="oidc-store-kind">{status.store.kind}</Value>
        </SettingsRow>
      ) : null}
      {transport ? (
        <SettingsRow
          label="Transport"
          description={
            <span className="space-y-1">
              {transportLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {transport.insecure ? (
                <span
                  role="note"
                  data-testid="oidc-transport-insecure"
                  className="block text-amber-700 dark:text-amber-400"
                >
                  TLS certificate verification is disabled
                  (MECATL_TLS_INSECURE=1). Use only on a trusted network.
                </span>
              ) : null}
              {transport.problem ? (
                <span
                  role="note"
                  data-testid="oidc-transport-problem"
                  className="block text-amber-700 dark:text-amber-400"
                >
                  {transport.problem}
                </span>
              ) : null}
            </span>
          }
        >
          <Value testId="oidc-transport">
            {transport.insecure
              ? "insecure"
              : transport.tlsCa
                ? "private CA"
                : "default"}
          </Value>
        </SettingsRow>
      ) : null}
      {status.callbackTimeoutSeconds ? (
        <SettingsRow
          label="Sign-in window"
          description="How long a started sign-in (or a copied link) stays valid (MECATL_OIDC_CALLBACK_TIMEOUT)."
        >
          <Value testId="oidc-callback-timeout">
            {formatWindow(status.callbackTimeoutSeconds)}
          </Value>
        </SettingsRow>
      ) : null}
    </>
  );
}
