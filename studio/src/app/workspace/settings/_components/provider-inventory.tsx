"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  HarnessProviderInfo,
  HarnessProviderStatus,
  KnownHarnessProvider,
} from "@/lib/harness/client";
import { cn } from "@/lib/utils";
import { Note } from "./settings-card";

/**
 * The richer provider inventory (`mecatl providers status` parity): the
 * controller's rows carry a CLASS (built-in / custom / external), an
 * authentication METHOD and STATE — including "the environment shadows
 * auth.yaml" — the saved default model and a next recovery step; the daemon
 * adds its own per-provider status hint (`ListModels.provider_status`).
 * Everything here renders names, booleans and fixed strings — no credential
 * value exists anywhere in these payloads (Studio rule 3).
 */

/** Splits the controller's rows into the three groups the section renders:
 *  configured providers (built-in with a block or env var, plus custom
 *  definitions), the ToolHive external row, and the unconfigured built-in
 *  kinds an operator could add. An older controller (no class fields) lands
 *  every row in `configured`. */
export function groupProviderRows(rows: HarnessProviderInfo[]): {
  configured: HarnessProviderInfo[];
  toolhive: HarnessProviderInfo | null;
  available: HarnessProviderInfo[];
} {
  const toolhive =
    rows.find((row) => row.name === "toolhive" || row.class === "external") ??
    null;
  const rest = rows.filter((row) => row !== toolhive);
  return {
    configured: rest.filter((row) => row.configured !== false),
    toolhive,
    available: rest.filter((row) => row.configured === false),
  };
}

/** The daemon's verdict on a provider as dot + label; null for "ok" (a
 *  healthy provider owes no extra line — the row's own state suffices). */
function daemonStatusPresentation(
  status: HarnessProviderStatus | null | undefined,
): { dot: string; label: string } | null {
  if (!status || status.state === "ok") return null;
  const label = status.hint ? `${status.state} — ${status.hint}` : status.state;
  switch (status.state) {
    case "unauthorized":
      return { dot: "bg-red-500", label };
    case "unreachable":
    case "empty":
      return { dot: "bg-amber-500", label };
    default:
      return { dot: "bg-amber-500", label };
  }
}

export const ENV_SHADOW_TITLE =
  "The environment variable wins over auth.yaml for mecated";

/**
 * The parity details under a configured row's name: class badge, the
 * authentication state (amber when the environment shadows auth.yaml), the
 * default model (with the daemon's "(auto-selected)" when it chose it), the
 * daemon's hint when its state is not ok, and the next step.
 */
export function ProviderRowDetails({
  row,
  daemonStatus,
}: {
  row: HarnessProviderInfo;
  daemonStatus: HarnessProviderStatus | null;
}) {
  const daemon = daemonStatusPresentation(daemonStatus);
  const hasParity = Boolean(row.class || row.authState || row.nextStep);
  if (!hasParity && !daemon) return null;
  return (
    <>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {row.class ? (
          <Badge variant="outline" data-testid="provider-class">
            {row.class}
          </Badge>
        ) : null}
        {row.authState ? (
          <span
            data-testid="provider-auth-state"
            className={cn(row.envShadowed && "text-warning")}
            title={row.envShadowed ? ENV_SHADOW_TITLE : undefined}
          >
            {row.authState}
          </span>
        ) : null}
        {row.defaultModel ? (
          <span className="font-mono">
            default: {row.defaultModel}
            {daemonStatus?.defaultModelAutoSelected ? " (auto-selected)" : ""}
          </span>
        ) : null}
        {daemonStatus?.availableNotDefault ? (
          <span>available, not default</span>
        ) : null}
        {daemon ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", daemon.dot)}
            />
            <span data-role="hint">daemon: {daemon.label}</span>
          </span>
        ) : null}
      </span>
      {row.nextStep ? (
        <span className="block truncate text-xs text-muted-foreground">
          Next: {row.nextStep}
        </span>
      ) : null}
    </>
  );
}

/**
 * The ToolHive LLM gateway as a provider row of class "external": its
 * lifecycle (login, proxy start) belongs to `thv llm`, so the actions are
 * "Set as active" when the loopback probe answers, "Start gateway" when the
 * `thv` CLI is on the controller's PATH but the proxy is down, and otherwise
 * the install-and-start note with a Re-check. The interactive `thv llm
 * login` stays in the operator's terminal — the row says so.
 */
export function ToolhiveGatewayRow({
  row,
  running,
  busy,
  daemonStatus,
  onActivate,
  onStart,
  onRecheck,
}: {
  row: HarnessProviderInfo;
  running: boolean;
  busy: string;
  daemonStatus: HarnessProviderStatus | null;
  onActivate: () => void;
  onStart: () => void;
  onRecheck: () => void;
}) {
  const reachable = row.reachable === true;
  const active = row.active === true;
  const activating = busy === "activate:toolhive";
  const starting = busy === "toolhive:start";
  const daemon = daemonStatusPresentation(daemonStatus);
  return (
    <li
      className="flex flex-col gap-2 px-4 py-3"
      data-testid="toolhive-gateway-row"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            reachable ? "bg-emerald-500" : "bg-muted-foreground/50",
          )}
        />
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="truncate font-mono text-sm font-medium">
              toolhive
            </span>
            <Badge variant="outline">{row.class || "external"}</Badge>
            {active && <Badge variant="info">active</Badge>}
            {active && (
              <Badge variant={running ? "default" : "secondary"}>
                {running ? "running" : "stopped"}
              </Badge>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span data-testid="provider-auth-state">
              {row.authState ||
                (reachable ? "gateway reachable" : "gateway not reachable")}
            </span>
            {row.baseURL ? (
              <span className="font-mono">{row.baseURL}</span>
            ) : null}
            <span>{row.source}</span>
            {daemon ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full", daemon.dot)}
                />
                <span data-role="hint">daemon: {daemon.label}</span>
              </span>
            ) : null}
          </span>
          {row.nextStep ? (
            <span className="block truncate text-xs text-muted-foreground">
              Next: {row.nextStep}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reachable && !active ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={activating}
              onClick={onActivate}
            >
              {activating ? "Switching…" : "Set as active"}
            </Button>
          ) : null}
          {!reachable && row.thvOnPath ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={starting}
              onClick={onStart}
              title="Runs `thv llm proxy start` on the daemon's machine and re-probes the gateway for up to 8 seconds"
            >
              {starting ? "Starting gateway…" : "Start gateway"}
            </Button>
          ) : null}
          {!reachable ? (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              disabled={starting}
              onClick={onRecheck}
            >
              Re-check
            </Button>
          ) : null}
        </div>
      </div>
      {!reachable ? (
        <Note>
          {row.thvOnPath
            ? "Start gateway runs thv llm proxy start for you. If ToolHive has no cached login, run thv llm login in a terminal first — the browser sign-in cannot be driven from here."
            : "Install ToolHive and run thv llm proxy start in a terminal (thv llm login first when you have not signed in), then Re-check."}
        </Note>
      ) : null}
    </li>
  );
}

/**
 * The built-in kinds with NO auth.yaml block and no env var — what
 * `providers status PROVIDER` would describe as not configured. Collapsed by
 * default; each row's action opens the Add dialog preselected on its kind.
 */
export function AvailableProviderKinds({
  rows,
  known,
  onAdd,
}: {
  rows: HarnessProviderInfo[];
  known: KnownHarnessProvider[];
  onAdd: (kind: string) => void;
}) {
  if (rows.length === 0) return null;
  const labelFor = (name: string) =>
    known.find((entry) => entry.name === name)?.label ?? name;
  return (
    <details className="rounded-lg border" data-testid="available-kinds">
      <summary className="cursor-pointer px-4 py-2 text-sm text-muted-foreground select-none focus-visible:outline-2 focus-visible:outline-ring">
        Available kinds ({rows.length}) — not configured yet
      </summary>
      <ul className="divide-y border-t">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex flex-wrap items-center gap-3 px-4 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-sm">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {labelFor(row.name)}
                </span>
                {row.class ? (
                  <Badge variant="outline">{row.class}</Badge>
                ) : null}
              </span>
              <span className="block text-xs text-muted-foreground">
                {row.authState || "not configured"}
                {row.nextStep ? ` · Next: ${row.nextStep}` : ""}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => onAdd(row.name)}
              aria-label={`Add ${labelFor(row.name)}`}
            >
              Add…
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The daemon's per-provider status rows on their own — the read-only
 * external-mode rendering (the controller inventory is unavailable there,
 * the daemon's hints are not). A row carries a hint line ONLY when its state
 * is not ok.
 */
export function DaemonProviderStatusList({
  rows,
}: {
  rows: HarnessProviderStatus[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Daemon provider status
      </p>
      <ul className="divide-y overflow-hidden rounded-lg border">
        {rows.map((status) => {
          const daemon = daemonStatusPresentation(status);
          return (
            <li
              key={status.providerId}
              className="flex items-center gap-3 px-4 py-2"
              data-provider-status={status.providerId}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  daemon ? daemon.dot : "bg-emerald-500",
                )}
              />
              <div className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-mono text-sm font-medium">
                    {status.providerId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {status.state}
                    {" · "}
                    {status.modelCount} model
                    {status.modelCount === 1 ? "" : "s"}
                    {status.availableNotDefault
                      ? " · available, not default"
                      : ""}
                    {status.defaultModelAutoSelected
                      ? " · default model auto-selected"
                      : ""}
                  </span>
                </span>
                {daemon && status.hint ? (
                  <span
                    className="block text-xs text-muted-foreground"
                    data-role="hint"
                  >
                    {status.hint}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The zero-configured-providers guidance (the TUI prints a setup path
 *  list; Studio names the two ways forward on this page). */
export function NoProvidersNote({ toolhive }: { toolhive: boolean }) {
  return (
    <Note>
      No providers are configured — mecated is running on the offline mock. Add
      a provider below
      {toolhive ? ", or start a ToolHive gateway." : "."}
    </Note>
  );
}
