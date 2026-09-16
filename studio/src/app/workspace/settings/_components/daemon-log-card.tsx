"use client";

import { Copy, Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDiagnosticsOptions } from "@/features/agent/hooks/use-diagnostics-options";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { useConfirm } from "@/hooks/use-confirm";
import { formatBytes } from "@/lib/formatters";
import {
  DAEMON_LOG_DEFAULT_LINES,
  DAEMON_LOG_DOWNLOAD_URL,
  fetchHarnessDaemonLog,
  type HarnessDaemonLog,
} from "@/lib/harness/client";
import { OptionField } from "./option-field";
import { Note, OfflineNote, SettingsCard, SettingsRow } from "./settings-card";

const TITLE = "Daemon log";

/** How often the tail re-reads while Follow is on — the runtime status
 *  poll's cadence, so the two never fight for the controller. */
export const DAEMON_LOG_FOLLOW_INTERVAL_MS = 5_000;

/** mecated's `--log-level` vocabulary (internal/cliconfig/logging.go), in
 *  the order the flag's help lists it; the controller validates the same
 *  four so a typo can never fall through to mecated's fail-soft `info`. */
export const LOG_LEVEL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info (default)" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

export const LOG_LEVEL_RESTART_WARNING =
  "The log level is a mecated flag, so the daemon restarts: in-flight runs end and session ids die with it.";

/** The external-mode note: the deployment's daemon writes its diagnostics
 *  where the deployment configured them; Studio holds no stream to file. */
export const EXTERNAL_LOG_NOTE =
  "Daemon diagnostics are written where the deployment configured them; Studio has no access to a remote daemon's log.";

/**
 * Reads the controller's bounded tail once on mount and every
 * `DAEMON_LOG_FOLLOW_INTERVAL_MS` while `follow` is on. Deliberately NOT
 * gated on the daemon being reachable: the controller answers while its
 * child is down, and a crash-at-start is exactly when the tail matters.
 */
function useDaemonLogTail(enabled: boolean, follow: boolean) {
  const [log, setLog] = useState<HarnessDaemonLog | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchHarnessDaemonLog(
        DAEMON_LOG_DEFAULT_LINES,
        signal,
      );
      if (signal?.aborted) return;
      setLog(next);
      setError(null);
    } catch (caught) {
      if (signal?.aborted) return;
      setError(caught instanceof Error ? caught.message : String(caught));
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
    const timer = follow
      ? setInterval(() => {
          void load(controller.signal);
        }, DAEMON_LOG_FOLLOW_INTERVAL_MS)
      : null;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [enabled, follow, load]);

  const reload = useCallback(() => load(), [load]);
  return { log, loaded, error, reload };
}

/**
 * The managed daemon's diagnostics log — Studio's analogue of mecatui's
 * embedded-server log file and its `--quiet`: where the diagnostics land
 * (the controller-owned `studio/.scratch/mecated.log`, owner-only, one
 * rotated generation at 10 MiB), a plain-text tail viewer with Follow /
 * Refresh / Copy, a Download of the file, the daemon's `--log-level`
 * (restart-confirmed: it is a mecated flag) and the terminal-echo mute
 * (controller-side, immediate). A start mecated refused is reported above
 * the tail, so a crash-at-start is diagnosable from this page while the
 * daemon itself is unreachable. External mode has no log to show: the
 * deployment owns its daemon's diagnostics.
 */
export function DaemonLogCard() {
  const { connected, mode } = useRuntimeStatus();
  const diagnostics = useDiagnosticsOptions();
  const { confirm, ConfirmDialog } = useConfirm();
  const [follow, setFollow] = useState(false);
  const managed = mode !== "external";
  const { log, loaded, error, reload } = useDaemonLogTail(managed, follow);
  const tailRef = useRef<HTMLElement>(null);
  const muteId = useId();
  const followId = useId();

  // Following means reading the newest lines: keep the viewer pinned to
  // the bottom as the tail changes.
  useEffect(() => {
    if (!follow || !log || !tailRef.current) return;
    tailRef.current.scrollTop = tailRef.current.scrollHeight;
  }, [follow, log]);

  if (!managed) {
    return (
      <SettingsCard title={TITLE}>
        <Note>{EXTERNAL_LOG_NOTE}</Note>
      </SettingsCard>
    );
  }
  if (!log) {
    return (
      <SettingsCard title={TITLE}>
        {!loaded ? (
          <Note>Reading the daemon log…</Note>
        ) : !connected ? (
          <OfflineNote />
        ) : (
          <Note>
            {error ??
              "The controller did not report a daemon log. Restart Studio (task studio:dev) so the current controller is running."}
          </Note>
        )}
      </SettingsCard>
    );
  }

  const level = diagnostics.options?.logLevel ?? log.level;
  const quiet = diagnostics.options?.quiet ?? log.quiet;
  const tailText = log.lines.join("\n");

  const changeLevel = async (next: string) => {
    if (next === level) return;
    const confirmed = await confirm({
      title: `Set the log level to ${next}?`,
      description: LOG_LEVEL_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    if (await diagnostics.save({ logLevel: next })) await reload();
  };

  const toggleMute = async (checked: boolean) => {
    if (await diagnostics.save({ quiet: checked })) await reload();
  };

  const copyTail = () => {
    void navigator.clipboard
      .writeText(tailText)
      .then(() => toast.success("Log tail copied"))
      .catch(() => toast.error("Couldn't copy — clipboard blocked"));
  };

  return (
    <SettingsCard
      title={TITLE}
      description="mecated's diagnostics (its stderr), kept by Studio's controller as an owner-only file with one rotated generation at 10 MiB. The tail below is plain text; the file holds everything since the controller started."
    >
      <div className="flex flex-col gap-4">
        {log.startupError !== "" && (
          <div
            role="alert"
            data-testid="daemon-log-startup-error"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="font-medium">mecated could not start: </span>
            <span className="whitespace-pre-wrap break-words">
              {log.startupError}
            </span>
          </div>
        )}
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

        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Log file"
            description={
              <>
                <span
                  className="break-all font-mono"
                  data-testid="daemon-log-path"
                >
                  {log.path}
                </span>
                {" · "}
                {log.sizeBytes > 0
                  ? formatBytes(log.sizeBytes)
                  : "nothing written yet"}
                {log.maxBytes > 0
                  ? ` · rotates at ${formatBytes(log.maxBytes)}`
                  : ""}
              </>
            }
          >
            {log.sizeBytes > 0 ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={DAEMON_LOG_DOWNLOAD_URL}
                  download="mecated.log"
                  data-testid="daemon-log-download"
                >
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <Download className="size-4" />
                Download
              </Button>
            )}
          </SettingsRow>
          <SettingsRow
            label="Log level"
            description="mecated's --log-level: the least severe line it writes. Changing it restarts the daemon."
          >
            <OptionField
              label="Log level"
              value={level}
              options={LOG_LEVEL_OPTIONS}
              onChange={(next) => void changeLevel(next)}
            />
          </SettingsRow>
          <SettingsRow
            label="Mute terminal echo"
            htmlFor={muteId}
            description="Stop mirroring mecated's stderr onto the controller's terminal. The file and this viewer keep receiving it; applies immediately, no restart."
          >
            <Switch
              id={muteId}
              checked={quiet}
              disabled={diagnostics.busy}
              onCheckedChange={(checked) => void toggleMute(checked)}
            />
          </SettingsRow>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {log.lines.length === 0
                ? "No output yet."
                : `Last ${log.lines.length} line${log.lines.length === 1 ? "" : "s"}${
                    log.truncated ? " — older output is in the file." : "."
                  }`}
              {!log.running ? " The daemon is not running." : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={followId} className="text-xs font-normal">
                  Follow
                </Label>
                <Switch
                  id={followId}
                  checked={follow}
                  onCheckedChange={setFollow}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void reload()}
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={copyTail}
                disabled={log.lines.length === 0}
              >
                <Copy className="size-4" />
                Copy tail
              </Button>
            </div>
          </div>
          {/* A labelled, keyboard-reachable scroll region; the text inside
              is rendered as-is (React escapes it) — never as markup. */}
          <section
            ref={tailRef}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region must be keyboard-reachable
            tabIndex={0}
            aria-label="Daemon log tail"
            data-testid="daemon-log-tail"
            className="max-h-72 overflow-auto rounded-lg border bg-background p-3 text-muted-foreground"
          >
            <pre className="font-mono text-xs whitespace-pre-wrap break-all">
              {tailText === "" ? "No output yet." : tailText}
            </pre>
          </section>
        </div>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}
