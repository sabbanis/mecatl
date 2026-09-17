"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOptionalRuntimeStatus } from "@/features/agent/runtime-status";
import { cn } from "@/lib/utils";

/**
 * The composer's memory indicator — READ-ONLY, derived from the daemon.
 *
 * Memory is a daemon setting (mecated's `--memory-dir` / `--no-user-model`),
 * never a per-chat switch: the daemon registers Remember/Recall and wires the
 * user-model store at spawn, and no session API turns either off. The pill
 * therefore REPORTS what the daemon advertises in its compatibility document
 * (`serverCapabilities.memory` — Remember/Recall registered, the TUI's
 * "memory is on" welcome note — and `serverCapabilities.user_model`) and
 * points at Settings → Memory, where the stores live. It replaced a local
 * On/Off toggle that never reached the daemon and so implied a switch that
 * did not exist.
 */

/** The settings page that owns the memory stores. */
export const MEMORY_SETTINGS_HREF = "/workspace/settings/memory";

/** The two daemon-reported memory stores, as advertised on the capability
 *  document; `null` when the daemon reported nothing (an older daemon with no
 *  compatibility endpoint, or capabilities not loaded yet). */
export interface MemoryStores {
  /** `capabilities.memory`: the Remember/Recall tools are registered — the
   *  per-project cross-session store. */
  project: boolean | null;
  /** `capabilities.user_model`: the cross-project user-model store is
   *  wired (the facts Settings → Memory lists). */
  userModel: boolean | null;
}

export type MemoryState = "on" | "off" | "unknown";

/** Reads the two store flags off the wire-keyed (snake_case) capabilities. */
export function readMemoryStores(
  capabilities: Record<string, unknown>,
): MemoryStores {
  return {
    project: flag(capabilities.memory),
    userModel: flag(capabilities.user_model),
  };
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** "on" when EITHER store is on (the agent has some long-term memory), "off"
 *  only when the daemon reported both off, "unknown" when it reported
 *  neither. */
export function memoryState(stores: MemoryStores): MemoryState {
  if (stores.project === true || stores.userModel === true) return "on";
  if (stores.project === false || stores.userModel === false) return "off";
  return "unknown";
}

const STATE_LABEL: Record<MemoryState, string> = {
  on: "On",
  off: "Off",
  unknown: "Unknown",
};

function memoryStateLabel(state: MemoryState): string {
  return STATE_LABEL[state];
}

export interface MemoryStatus {
  stores: MemoryStores;
  state: MemoryState;
  /** "managed" (Studio spawned the daemon) or "external" (MECATL_BASE_URL). */
  mode: "managed" | "external";
  connected: boolean;
}

/**
 * The indicator's one input, read straight off the runtime status — no prop
 * plumbing. Null OUTSIDE the RuntimeStatusProvider (a display-only composer,
 * a unit test), so the pill hides rather than throwing. Disconnected, the
 * state is "unknown": the last-seen capabilities may describe a daemon that
 * has since been restarted with other flags.
 */
function useMemoryStatus(): MemoryStatus | null {
  const runtime = useOptionalRuntimeStatus();
  if (!runtime) return null;
  const stores = runtime.connected
    ? readMemoryStores(runtime.serverCapabilities)
    : { project: null, userModel: null };
  return {
    stores,
    state: memoryState(stores),
    mode: runtime.mode,
    connected: runtime.connected,
  };
}

/**
 * The desktop toolbar pill: "Memory On/Off/Unknown", opening a small
 * read-only popover — the two stores plus where the setting lives. Not a
 * menu: there is nothing to choose here.
 */
export function MemoryIndicator({ className }: { className?: string }) {
  const status = useMemoryStatus();
  if (!status) return null;
  const label = memoryStateLabel(status.state);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className={cn("gap-1", className)}
          title={`Memory ${label}`}
          aria-label={`Memory ${label}`}
        >
          Memory
          <span className="text-muted-foreground @max-md:hidden">{label}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-3 p-3 text-sm"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <MemoryStoreRows status={status} />
        <MemorySettingsNote status={status} />
      </PopoverContent>
    </Popover>
  );
}

/** The mobile options sheet's Memory row value — the same derived label. */
export function MemoryStateLabel() {
  const status = useMemoryStatus();
  if (!status) return null;
  return <>{memoryStateLabel(status.state)}</>;
}

/**
 * The body of the mobile Memory sub-sheet: the same read-only rows and
 * note as the desktop popover (the old sheet offered an On/Off pick that
 * changed nothing).
 */
export function MemorySheetSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const status = useMemoryStatus();
  return (
    <div className="space-y-3 px-4 py-3 text-sm">
      {status ? (
        <>
          <MemoryStoreRows status={status} />
          <MemorySettingsNote status={status} onNavigate={onNavigate} />
        </>
      ) : (
        <p className="text-muted-foreground">
          Memory status is not available here.
        </p>
      )}
    </div>
  );
}

const STORE_ROWS: {
  key: keyof MemoryStores;
  name: string;
  detail: string;
}[] = [
  {
    key: "project",
    name: "Project memory (Remember/Recall)",
    detail: "Notes the agent keeps for this workspace across sessions.",
  },
  {
    key: "userModel",
    name: "User model (facts about you)",
    detail: "Durable facts about you, shared across projects.",
  },
];

function MemoryStoreRows({ status }: { status: MemoryStatus }) {
  return (
    <dl className="space-y-2">
      {STORE_ROWS.map((row) => {
        const value = status.stores[row.key];
        const label =
          value === null
            ? "Not reported"
            : value
              ? STATE_LABEL.on
              : STATE_LABEL.off;
        return (
          <div
            key={row.key}
            className="flex items-start justify-between gap-3"
            data-testid={`memory-store-${row.key}`}
          >
            <dt className="min-w-0">
              <span className="block font-medium">{row.name}</span>
              <span className="block text-xs text-muted-foreground">
                {row.detail}
              </span>
            </dt>
            <dd
              className={cn(
                "shrink-0 tabular-nums",
                value === true ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function MemorySettingsNote({
  status,
  onNavigate,
}: {
  status: MemoryStatus;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
      <p>{memorySettingsCopy(status)}</p>
      <Link
        href={MEMORY_SETTINGS_HREF}
        onClick={onNavigate}
        className="inline-block font-medium text-foreground underline-offset-4 hover:underline"
      >
        Settings → Memory
      </Link>
    </div>
  );
}

/** Where the setting lives, said honestly per deployment: a managed daemon's
 *  memory is Studio's spawn flags; an external daemon's is the operator's,
 *  and Settings → Memory can only show it there. */
export function memorySettingsCopy(status: MemoryStatus): string {
  const base = "Memory is a daemon setting, not a per-chat switch.";
  if (!status.connected) {
    return `${base} Mecatl is unreachable, so its memory setting cannot be read right now.`;
  }
  if (status.state === "unknown") {
    return `${base} This daemon does not report whether memory is on.`;
  }
  if (status.mode === "external") {
    return `${base} This daemon is managed outside Studio: its own flags (--memory-dir, --no-user-model) decide, and Settings → Memory shows the stores but cannot change them.`;
  }
  return `${base} Studio starts the daemon with project memory on for this workspace; the stores are managed in Settings → Memory.`;
}
