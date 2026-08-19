"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/** A suggestion only — the field is fully editable. */
const SUGGESTED_GATEWAY_URL = "https://connector-gateway.stacklok.dev/gw/mcp";

/**
 * Connects an MCP gateway by name and URL. The URL is validated by the
 * controller (HTTPS only, no credentials in the URL), and its errors are
 * surfaced verbatim through the shared runtime error. Both connect paths
 * restart the daemon; a failed handshake rolls the previous gateway back.
 */
export function GatewaySection({ runtime }: { runtime: Runtime }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState(SUGGESTED_GATEWAY_URL);
  const [token, setToken] = useState("");

  const gateway = runtime.status?.gateway ?? null;
  const busy = runtime.busy === "gateway";
  const ready = Boolean(name.trim() && url.trim());

  const startOAuth = () => {
    if (!ready || busy) return;
    // Opened synchronously: a popup created after an await is blocked.
    const popup = window.open(
      "about:blank",
      "mecatl-gateway-oauth",
      "width=520,height=680",
    );
    if (!popup) return;
    void runtime.connectGatewayOAuth(name.trim(), url.trim(), {
      setUrl: (target) => {
        popup.location.href = target;
      },
      isClosed: () => popup.closed,
    });
  };

  return (
    <SettingsCard title="MCP gateway">
      {!runtime.live ? (
        <OfflineNote />
      ) : (
        <div className="flex flex-col gap-3">
          {gateway ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Connected as{" "}
                <span className="font-medium text-foreground">
                  {gateway.name}
                </span>
              </p>
              <code className="mt-0.5 block break-all font-mono text-xs">
                {gateway.url}
              </code>
            </div>
          ) : (
            <Note>Not connected — the agent has only its built-in tools.</Note>
          )}

          {runtime.mode === "external" ? (
            <ExternalManagedNote />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gw-name">Gateway name</Label>
                  <Input
                    id="gw-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="connector-gateway"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gw-url">Gateway URL</Label>
                  <Input
                    id="gw-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder={SUGGESTED_GATEWAY_URL}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={!ready || busy}
                  onClick={startOAuth}
                >
                  {busy ? "Waiting for sign-in…" : "Sign in to gateway"}
                </Button>
              </div>

              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Or paste a bearer token
                </summary>
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!ready) return;
                    void runtime.connectGateway(
                      name.trim(),
                      url.trim(),
                      token.trim() || undefined,
                    );
                    setToken("");
                  }}
                >
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="gw-token">Bearer token</Label>
                    <Input
                      id="gw-token"
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="for a token you already hold"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!ready || busy}
                  >
                    Connect
                  </Button>
                </form>
              </details>

              {/* The one explainer kept: writes restart the daemon (a rule —
                  surfaces warn before writes that restart). */}
              <p className="text-xs text-muted-foreground">
                Connecting restarts the daemon and invalidates in-flight
                sessions.
              </p>
            </>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
