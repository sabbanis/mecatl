"use client";

import { Activity, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDiagnosticsOptions } from "@/features/agent/hooks/use-diagnostics-options";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { useConfirm } from "@/hooks/use-confirm";
import { formatBytes } from "@/lib/formatters";
import {
  fetchHarnessPerfMetrics,
  fetchHarnessPerfStatus,
  type HarnessPerfStatus,
} from "@/lib/harness/client";
import {
  type PerfSnapshot,
  parsePrometheusText,
  perfMcpConfig,
  perfSnapshot,
} from "@/lib/prometheus-text";
import { Note, OfflineNote, SettingsCard, SettingsRow } from "./settings-card";

const TITLE = "Performance";

/** The external-mode note: the deployment spawned its own mecated, so its
 *  admin listener (if any) is the deployment's flag, not Studio's. */
export const EXTERNAL_PERF_NOTE =
  "The deployment configures mecated's --metrics-addr / --perf-mcp itself; Studio has no admin listener to show for a remote daemon.";

export const ADMIN_RESTART_WARNING =
  "The admin listener is a mecated flag (--metrics-addr), so the daemon restarts: in-flight runs end and session ids die with it. Studio picks a free loopback port at each start.";

export const PERF_MCP_RESTART_WARNING =
  "The perf MCP mount is a mecated flag (--perf-mcp), so the daemon restarts: in-flight runs end and session ids die with it.";

export const GOROUTINE_RESTART_WARNING =
  "The goroutine-leak alarm is a mecated flag (--goroutine-warn-threshold), so the daemon restarts: in-flight runs end and session ids die with it.";

/** Why the path chips can look broken from another machine. */
export const LOOPBACK_LINK_NOTE =
  "These links point at the daemon's loopback address: they open only in a browser running on the machine that hosts mecated. Studio itself relays /metrics for the snapshot below.";

/** mecated's own ceiling advice, from the flag's help text. */
const GOROUTINE_THRESHOLD_HELP =
  "Log a warning whenever the goroutine count exceeds this number. 0 = off. A healthy mecated holds a few hundred goroutines; pick a high ceiling such as 10000 so it only fires on a real leak.";

/** The largest threshold the controller accepts (a typo guard, not a ceiling). */
const MAX_THRESHOLD = 1_000_000;

/** Total GC pause as seconds with millisecond precision ("0.042 s"). */
export function formatGcPause(seconds: number): string {
  return `${seconds.toFixed(3)} s`;
}

interface Snapshot {
  takenAt: Date;
  figures: PerfSnapshot;
  raw: string;
}

/**
 * The live admin-surface facts from the controller (`GET /perf`), read on
 * mount and again after every save (a restart may move the port).
 */
function usePerfStatus(enabled: boolean) {
  const [perf, setPerf] = useState<HarnessPerfStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchHarnessPerfStatus(signal);
      if (signal?.aborted) return;
      setPerf(next);
    } catch {
      if (signal?.aborted) return;
      setPerf(null);
    } finally {
      if (!signal?.aborted) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  const reload = useCallback(() => load(), [load]);
  return { perf, loaded, reload };
}

/**
 * Settings → Diagnostics → "Performance": Studio's analogue of mecatui's
 * embedded-server `--perf` family. Managed mode edits three spawn flags of
 * the controller's diagnostics document, each restart-confirmed: the
 * loopback admin listener (`--metrics-addr`, port chosen by the controller
 * per start — OFF by default, so a managed daemon opens no admin port until
 * asked), the read-only perf MCP mount on it (`--perf-mcp`, with the
 * paste-ready `.mcp.json` mecated itself prints) and the goroutine-leak
 * alarm (`--goroutine-warn-threshold`). While the listener is up the card
 * shows its live origin, the mounted paths as loopback links (they resolve
 * only on the daemon's host — the copy says so) and a runtime snapshot the
 * controller relays from `/metrics` (goroutines, heap, RSS, GC pause), with
 * the raw exposition collapsed underneath as plain text. External mode owns
 * its own daemon's flags, so it gets a note, not a form.
 */
export function PerformanceCard() {
  const { connected, mode } = useRuntimeStatus();
  const diagnostics = useDiagnosticsOptions();
  const { confirm, ConfirmDialog } = useConfirm();
  const managed = mode !== "external";
  const { perf, loaded, reload } = usePerfStatus(managed && connected);
  const adminId = useId();
  const perfMcpId = useId();
  const thresholdId = useId();
  const thresholdHelpId = useId();

  const admin = diagnostics.options?.admin ?? null;
  const [thresholdText, setThresholdText] = useState("");
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const savedThreshold = admin?.goroutineWarnThreshold ?? 0;
  // Mirror the saved value into the field whenever the document changes
  // (initial load, a save, a rollback) — the field is otherwise local.
  useEffect(() => {
    setThresholdText(String(savedThreshold));
    setThresholdError(null);
  }, [savedThreshold]);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  // A listener that went away (switched off, daemon restarted on another
  // port) leaves a stale snapshot behind: drop it with the listener.
  const adminUrl = perf?.enabled ? perf.adminUrl : "";
  useEffect(() => {
    if (adminUrl === "") {
      setSnapshot(null);
      setSnapshotError(null);
    }
  }, [adminUrl]);

  const saveAdmin = useCallback(
    async (patch: Partial<NonNullable<typeof admin>>) => {
      if (!admin) return false;
      const ok = await diagnostics.save({ admin: { ...admin, ...patch } });
      await reload();
      return ok;
    },
    [admin, diagnostics.save, reload],
  );

  const toggleAdmin = async (checked: boolean) => {
    const confirmed = await confirm({
      title: checked
        ? "Open the runtime admin surface?"
        : "Close the runtime admin surface?",
      description: ADMIN_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    // The perf MCP rides the listener: closing it takes the mount along
    // (the controller refuses perfMcp without enabled).
    await saveAdmin(
      checked ? { enabled: true } : { enabled: false, perfMcp: false },
    );
  };

  const togglePerfMcp = async (checked: boolean) => {
    const confirmed = await confirm({
      title: checked
        ? "Mount the perf MCP server?"
        : "Unmount the perf MCP server?",
      description: PERF_MCP_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    await saveAdmin({ perfMcp: checked });
  };

  const commitThreshold = async () => {
    const trimmed = thresholdText.trim();
    const next = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isInteger(next) || next < 0 || next > MAX_THRESHOLD) {
      setThresholdError(
        `Enter a whole number from 0 (off) to ${MAX_THRESHOLD.toLocaleString()}.`,
      );
      return;
    }
    setThresholdError(null);
    if (next === savedThreshold) {
      setThresholdText(String(savedThreshold));
      return;
    }
    const confirmed = await confirm({
      title:
        next === 0
          ? "Turn the goroutine-leak alarm off?"
          : `Warn above ${next.toLocaleString()} goroutines?`,
      description: GOROUTINE_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) {
      setThresholdText(String(savedThreshold));
      return;
    }
    await saveAdmin({ goroutineWarnThreshold: next });
  };

  const takeSnapshot = async () => {
    setSnapshotBusy(true);
    setSnapshotError(null);
    try {
      const raw = await fetchHarnessPerfMetrics();
      setSnapshot({
        takenAt: new Date(),
        figures: perfSnapshot(parsePrometheusText(raw)),
        raw,
      });
    } catch (caught) {
      setSnapshotError(
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSnapshotBusy(false);
    }
  };

  const copyMcpConfig = (origin: string) => {
    void navigator.clipboard
      .writeText(perfMcpConfig(origin))
      .then(() => toast.success(".mcp.json snippet copied"))
      .catch(() => toast.error("Couldn't copy — clipboard blocked"));
  };

  if (!managed) {
    return (
      <SettingsCard title={TITLE}>
        <Note>{EXTERNAL_PERF_NOTE}</Note>
      </SettingsCard>
    );
  }
  if (!admin) {
    return (
      <SettingsCard title={TITLE}>
        {diagnostics.isLoading || !loaded ? (
          <Note>Reading the diagnostics options…</Note>
        ) : !connected ? (
          <OfflineNote />
        ) : (
          <Note>
            {diagnostics.error ??
              "The controller did not report diagnostics options. Restart Studio (task studio:dev) so the current controller is running."}
          </Note>
        )}
      </SettingsCard>
    );
  }

  const listening = perf?.enabled === true && adminUrl !== "";
  const busy = diagnostics.busy;
  const mcpConfig = listening && perf?.perfMcp ? perfMcpConfig(adminUrl) : null;

  return (
    <SettingsCard
      title={TITLE}
      description="mecated's runtime admin surface — loopback-only /metrics, /debug/pprof, /debug/vars and /debug/flightrecorder, the read-only perf MCP server and the goroutine-leak alarm. Off by default: a managed daemon opens no admin port until you turn it on here. Its output can embed prompt text and file paths and never leaves this machine."
    >
      <div className="flex flex-col gap-4">
        {diagnostics.error && (
          <p className="whitespace-pre-wrap text-sm text-destructive">
            {diagnostics.error}
          </p>
        )}
        {diagnostics.notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {diagnostics.notice}
          </p>
        )}
        {admin.enabled && loaded && !listening && (
          <p className="text-sm text-muted-foreground" role="status">
            The admin listener is saved on but the running daemon was not
            started with it — a start failed, or the controller predates this
            setting. Check the daemon log above.
          </p>
        )}

        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Runtime admin surface"
            htmlFor={adminId}
            description="Loopback-only /metrics, /debug/pprof, /debug/vars and /debug/flightrecorder on a port Studio picks at each start (--metrics-addr). Output can embed prompt text and file paths — never exposed beyond this machine. Changing it restarts the daemon."
          >
            <Switch
              id={adminId}
              checked={admin.enabled}
              disabled={busy}
              onCheckedChange={(checked) => void toggleAdmin(checked)}
            />
          </SettingsRow>
          <SettingsRow
            label="Perf MCP server"
            htmlFor={perfMcpId}
            description="Mounts mecated's read-only perf MCP server at /mcp on the admin listener (--perf-mcp): slow turns, runtime, heap and CPU profiles, flight-recorder snapshots. Unauthenticated, loopback only. Needs the admin surface on; restarts the daemon."
          >
            <Switch
              id={perfMcpId}
              checked={admin.perfMcp}
              disabled={busy || !admin.enabled}
              onCheckedChange={(checked) => void togglePerfMcp(checked)}
            />
          </SettingsRow>
          <SettingsRow
            label="Goroutine-leak alarm"
            htmlFor={thresholdId}
            description={
              <>
                {GOROUTINE_THRESHOLD_HELP}
                {perf && perf.goroutineWarnIntervalSeconds > 0
                  ? ` Sampled every ${perf.goroutineWarnIntervalSeconds} s.`
                  : ""}{" "}
                Restarts the daemon.
              </>
            }
          >
            <div className="flex flex-col items-end gap-1">
              <Input
                id={thresholdId}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_THRESHOLD}
                step={1}
                className="w-32 text-right"
                value={thresholdText}
                disabled={busy}
                aria-invalid={thresholdError ? true : undefined}
                aria-describedby={thresholdError ? thresholdHelpId : undefined}
                onChange={(event) => {
                  setThresholdText(event.target.value);
                  setThresholdError(null);
                }}
                onBlur={() => void commitThreshold()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
              {thresholdError ? (
                <p id={thresholdHelpId} className="text-xs text-destructive">
                  {thresholdError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {savedThreshold === 0
                    ? "Off"
                    : `Warns above ${savedThreshold.toLocaleString()}`}
                </p>
              )}
            </div>
          </SettingsRow>
        </div>

        {listening && perf ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Admin listener</p>
              <p
                className="break-all font-mono text-xs text-muted-foreground"
                data-testid="perf-admin-url"
              >
                {adminUrl}
              </p>
              <ul
                className="flex flex-wrap gap-2 pt-1"
                aria-label="Admin listener paths"
              >
                {perf.paths.map((path) => (
                  <li key={path}>
                    <a
                      href={`${adminUrl}${path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {path}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {LOOPBACK_LINK_NOTE}
              </p>
            </div>

            {mcpConfig ? (
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Perf MCP client config (.mcp.json)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => copyMcpConfig(adminUrl)}
                  >
                    <Copy className="size-4" />
                    Copy .mcp.json
                  </Button>
                </div>
                <pre
                  className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs"
                  data-testid="perf-mcp-config"
                >
                  {mcpConfig}
                </pre>
                <p className="text-xs text-muted-foreground">
                  The same snippet <code>mecated perf-mcp print-config</code>{" "}
                  prints. Point an agent at it to introspect this daemon's
                  runtime, latency and profiles over MCP.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Runtime snapshot</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={snapshotBusy}
                  onClick={() => void takeSnapshot()}
                >
                  {snapshot ? (
                    <RefreshCw className="size-4" />
                  ) : (
                    <Activity className="size-4" />
                  )}
                  {snapshot ? "Refresh" : "Take snapshot"}
                </Button>
              </div>
              {snapshotError ? (
                <p role="alert" className="text-sm text-destructive">
                  {snapshotError}
                </p>
              ) : null}
              {snapshot ? (
                <>
                  <dl
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    data-testid="perf-snapshot"
                  >
                    <SnapshotTile
                      label="Goroutines"
                      value={
                        snapshot.figures.goroutines === undefined
                          ? null
                          : snapshot.figures.goroutines.toLocaleString()
                      }
                    />
                    <SnapshotTile
                      label="Heap in use"
                      value={
                        snapshot.figures.heapBytes === undefined
                          ? null
                          : formatBytes(snapshot.figures.heapBytes)
                      }
                    />
                    <SnapshotTile
                      label="Resident memory"
                      value={
                        snapshot.figures.rssBytes === undefined
                          ? null
                          : formatBytes(snapshot.figures.rssBytes)
                      }
                    />
                    <SnapshotTile
                      label="GC pause total"
                      value={
                        snapshot.figures.gcPauseTotalSeconds === undefined
                          ? null
                          : formatGcPause(snapshot.figures.gcPauseTotalSeconds)
                      }
                    />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Taken {snapshot.takenAt.toLocaleTimeString()} from{" "}
                    <span className="font-mono">/metrics</span>
                    {savedThreshold > 0 &&
                    snapshot.figures.goroutines !== undefined &&
                    snapshot.figures.goroutines > savedThreshold
                      ? " — above the goroutine-leak alarm threshold."
                      : "."}
                  </p>
                  {/* Plain text only: the exposition is model-influenced. */}
                  <details className="rounded-md border">
                    <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
                      Raw /metrics text
                    </summary>
                    <pre
                      className="max-h-72 overflow-auto border-t p-3 font-mono text-xs whitespace-pre-wrap break-all text-muted-foreground"
                      data-testid="perf-metrics-raw"
                    >
                      {snapshot.raw}
                    </pre>
                  </details>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}

function SnapshotTile({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">
        {value ?? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">not reported</span>
          </>
        )}
      </dd>
    </div>
  );
}
