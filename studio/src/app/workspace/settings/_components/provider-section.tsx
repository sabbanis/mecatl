"use client";

import { Badge } from "@/components/ui/badge";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/** Provider names the controller reports when no real provider is wired up. */
const UNCONFIGURED = new Set(["", "unknown", "none", "mock"]);

/**
 * Read-only by design: provider credentials never cross the browser/controller
 * boundary (ADR 0228). There is no add/remove-provider write path anywhere in
 * mecated or the controller — a key never travels through browser JS or the
 * Node supervisor process. What this card CAN honestly do: name every
 * provider block already present in auth.yaml (never their key values), show
 * which one is active, and say exactly which file and env var to change to
 * add one or switch.
 */
export function ProviderSection({ runtime }: { runtime: Runtime }) {
  const status = runtime.status;
  const unconfigured = UNCONFIGURED.has(
    (status?.provider ?? "").trim().toLowerCase(),
  );
  const configured = status?.configuredProviders ?? [];

  return (
    <SettingsCard title="Model provider">
      {!runtime.live ? (
        <OfflineNote />
      ) : status === null ? (
        <Note>Reading the controller&rsquo;s status…</Note>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium">
                {status.provider || "unknown"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {runtime.models.length} model
                {runtime.models.length === 1 ? "" : "s"} available to the agent
              </p>
            </div>
            <Badge variant={status.running ? "default" : "secondary"}>
              {status.running ? "running" : "stopped"}
            </Badge>
          </div>

          {runtime.mode !== "external" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Configured in{" "}
                <code className="font-mono">~/.config/mecatl/auth.yaml</code>
              </p>
              {configured.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No provider blocks found.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {configured.map((name) => (
                    <li key={name}>
                      <Badge
                        variant={
                          name === status.selectedProvider ? "info" : "outline"
                        }
                        className="font-mono"
                      >
                        {name}
                        {name === status.selectedProvider && " · active"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {runtime.mode === "external" ? (
            <ExternalManagedNote />
          ) : unconfigured ? (
            <Note>
              No provider is active. Add a block under{" "}
              <code className="font-mono">providers:</code> in{" "}
              <code className="font-mono">~/.config/mecatl/auth.yaml</code> on
              the machine running mecated, set{" "}
              <code className="font-mono">MECATL_STUDIO_PROVIDER</code> to its
              name, then restart Studio.
            </Note>
          ) : null}
        </div>
      )}
    </SettingsCard>
  );
}
