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
 * boundary. mecated reads them from its own auth file on the host, so the only
 * thing this card can honestly offer is status plus that remediation path.
 */
export function ProviderSection({ runtime }: { runtime: Runtime }) {
  const status = runtime.status;
  const unconfigured = UNCONFIGURED.has(
    (status?.provider ?? "").trim().toLowerCase(),
  );

  return (
    <SettingsCard
      title="Model provider"
      description="The AI provider serving the agent's models."
    >
      {!runtime.live ? (
        <OfflineNote />
      ) : status === null ? (
        <Note>Reading the controller&rsquo;s status…</Note>
      ) : (
        <div className="flex flex-col gap-3">
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

          {runtime.mode === "external" ? (
            <ExternalManagedNote />
          ) : unconfigured ? (
            <Note>
              No provider is configured. Credentials never pass through this UI
              — add them to{" "}
              <code className="font-mono">~/.config/mecatl/auth.yaml</code> on
              the machine running mecated, then restart it.
            </Note>
          ) : (
            <p className="text-xs text-muted-foreground">
              Credentials are read by mecated from{" "}
              <code className="font-mono">~/.config/mecatl/auth.yaml</code> and
              are never entered or shown here.
            </p>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
