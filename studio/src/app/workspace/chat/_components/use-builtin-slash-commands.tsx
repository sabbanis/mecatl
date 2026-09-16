"use client";

import { useRouter } from "next/navigation";
import {
  type ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type BuiltinGates,
  type BuiltinOutcome,
  gatedReason,
  type StudioBuiltinCommand,
} from "@/features/agent/composer-builtins";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  browserPlatform,
  buildDiagnosticsReport,
} from "@/lib/harness/diagnostics-report";
import { fetchHarnessServerInfo } from "@/lib/harness/server-info";
import { clearHarnessSession } from "@/lib/harness/sessions";
import { HELP_ROUTE } from "./help-menu-item";
import {
  SessionDetailsDialog,
  type SessionDetailsExtras,
} from "./session-details-dialog";

/** The chat-workspace state the built-ins act on. */
export interface BuiltinSlashDeps {
  /** The selected daemon session id; null for a draft or the mock chat. */
  sessionId: string | null;
  isStreaming: boolean;
  /** True while the chat hook holds a failure — live, or a `failed` session
   *  rehydrated after a reload. The only state `/retry` acts in: outside
   *  it there is no failed step for the daemon to re-drive, and Studio
   *  never re-sends a successful turn's prompt. */
  hasFailedStep: boolean;
  /** `serverCapabilities.manual_compaction === true` (ADR 0244). */
  compactSupported: boolean;
  onCompact: () => void;
  onRetry: () => void;
  onSend: (content: string) => void;
  onClearQueue: () => void;
  /** Adopts the ClearSession successor: refresh the list, select it. */
  onSessionCleared: (successorId: string) => void | Promise<void>;
  /** The session's resolved provider/model (GET-session echo), for the
   *  diagnostics report; null with no session or an older daemon. */
  resolvedModel: { providerId: string; modelId: string } | null;
  /** The composer's permission mode (Studio vocabulary). */
  permissionMode: string;
  /** Inventory-row facts the `/session` dialog shows beyond the snapshot:
   *  the `copy_id` capability and the row's last-write time. */
  sessionDetails?: SessionDetailsExtras;
}

export const CLEAR_WHILE_STREAMING =
  "Stop the run (Esc) before clearing the chat";
export const RETRY_WHILE_STREAMING =
  "/retry is unavailable while a run is active";
export const RETRY_NOTHING_FAILED =
  "Nothing to retry — the last step did not fail";
export const SESSION_NONE_YET = "No session yet — send a message to start one";
export const COMPACT_WHILE_STREAMING =
  "Wait for the run to finish before compacting";
export const COMPACT_NONE_YET = "No session yet — nothing to compact";
export const DIAGNOSTICS_WHILE_STREAMING =
  "Wait for the run to finish before sending diagnostics";
export const CLEARED_TOAST = "Started a fresh chat";

const ok: BuiltinOutcome = { ok: true };
const refuse = (warning: string): BuiltinOutcome => ({ ok: false, warning });

/**
 * Answers the composer's Studio built-ins (`/clear /help /session /retry
 * /diagnostics /compact`) for the chat workspace — the web analogue of the
 * TUI's builtins.go dispatch. A refusal keeps the typed text in the composer
 * with the returned warning; `ok` clears it. Every built-in runs even while
 * a run streams (it is never queued or steered); the ones that need an idle
 * session say so instead.
 *
 * `/diagnostics` is the ONE built-in that reaches the model: it sends the
 * sanitized report (diagnostics-report.ts) as an ordinary prompt.
 */
export function useBuiltinSlashCommands(deps: BuiltinSlashDeps): {
  builtinGates: BuiltinGates;
  handleSlashBuiltin: (name: StudioBuiltinCommand) => BuiltinOutcome;
  /** Render inside the workspace so `/session` has somewhere to open. */
  sessionDetailsDialog: ReactElement;
  /** Opens the same dialog from a menu item or the ⌘I shortcut; on a draft
   *  (no daemon session yet) it says so in a toast instead. */
  openSessionDetails: () => void;
} {
  const router = useRouter();
  const { mode: serverMode, deployment } = useRuntimeStatus();
  // Read through a ref so the dispatcher stays stable across chat state
  // churn (the composer re-subscribes its keydown listener on every change).
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const runtimeRef = useRef({ serverMode, deployment });
  runtimeRef.current = { serverMode, deployment };

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsSessionId, setDetailsSessionId] = useState<string | null>(null);

  const builtinGates = useMemo<BuiltinGates>(
    () => ({ manualCompaction: deps.compactSupported }),
    [deps.compactSupported],
  );

  const handleSlashBuiltin = useCallback(
    (name: StudioBuiltinCommand): BuiltinOutcome => {
      const d = depsRef.current;
      switch (name) {
        case "help":
          router.push(HELP_ROUTE);
          return ok;
        case "clear": {
          if (d.isStreaming) return refuse(CLEAR_WHILE_STREAMING);
          if (!d.sessionId) {
            // A draft has no daemon session: dropping the composer text
            // (the caller's `ok`) and the held queue IS the clear.
            d.onClearQueue();
            return ok;
          }
          const sourceId = d.sessionId;
          void (async () => {
            try {
              const successorId = await clearHarnessSession(sourceId);
              d.onClearQueue();
              await d.onSessionCleared(successorId);
              toast.success(CLEARED_TOAST);
            } catch (caught) {
              toast.error(
                caught instanceof Error ? caught.message : String(caught),
              );
            }
          })();
          return ok;
        }
        case "session":
          if (!d.sessionId) return refuse(SESSION_NONE_YET);
          setDetailsSessionId(d.sessionId);
          setDetailsOpen(true);
          return ok;
        case "retry":
          if (d.isStreaming) return refuse(RETRY_WHILE_STREAMING);
          if (!d.hasFailedStep) return refuse(RETRY_NOTHING_FAILED);
          d.onRetry();
          return ok;
        case "compact":
          if (!d.compactSupported) return refuse(gatedReason("compact"));
          if (d.isStreaming) return refuse(COMPACT_WHILE_STREAMING);
          if (!d.sessionId) return refuse(COMPACT_NONE_YET);
          d.onCompact();
          return ok;
        case "diagnostics": {
          if (d.isStreaming) return refuse(DIAGNOSTICS_WHILE_STREAMING);
          const { serverMode: mode, deployment: label } = runtimeRef.current;
          const resolvedModel = d.resolvedModel;
          const permissionMode = d.permissionMode;
          const send = d.onSend;
          void (async () => {
            // The safe identity probe (ADR 0245); an older daemon or a
            // transient fault reads "unavailable", never blocks the report.
            const serverInfo = await fetchHarnessServerInfo(
              resolvedModel?.providerId || undefined,
            ).catch(() => null);
            send(
              buildDiagnosticsReport({
                platform: browserPlatform(),
                clientBuild: process.env.NEXT_PUBLIC_STUDIO_BUILD ?? "",
                mode,
                serverInfo,
                deployment: label,
                resolvedModel,
                permissionMode,
              }),
            );
          })();
          return ok;
        }
        default:
          return ok;
      }
    },
    [router],
  );

  // The menu item and ⌘I share `/session`'s dialog; unlike the built-in they
  // have no composer to leave a warning in, so a draft gets a toast.
  const openSessionDetails = useCallback(() => {
    const d = depsRef.current;
    if (!d.sessionId) {
      toast.info(SESSION_NONE_YET);
      return;
    }
    setDetailsSessionId(d.sessionId);
    setDetailsOpen(true);
  }, []);

  const sessionDetailsDialog = (
    <SessionDetailsDialog
      sessionId={detailsSessionId}
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      extras={deps.sessionDetails}
    />
  );

  return {
    builtinGates,
    handleSlashBuiltin,
    sessionDetailsDialog,
    openSessionDetails,
  };
}
