"use client";

import { Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useOptionalRuntimeStatus } from "@/features/agent/runtime-status";
import {
  type SessionToolProfile,
  SHELL_DISABLED_NOTE,
  shellDisabledOnDaemon,
  TOOL_PROFILE_OPTIONS,
  toolProfileLabel,
} from "@/lib/tool-profile";
import { cn } from "@/lib/utils";

/**
 * The composer's TOOLS choice — the daemon's per-session `profile` (ADR
 * 0291): "All tools" or "No filesystem" (the file-less catalog: no Shell,
 * Read, Edit, Write…; web tools remain). It lives INSIDE the Mode menu
 * rather than as its own pill: both are the chat's posture, both are picked
 * on the draft, and a fourth pill would crowd the ~400px side-panel
 * composer.
 *
 * Two shapes, one prop contract:
 * - `onProfileChange` present = a DRAFT: the rows pick the profile the first
 *   send mints with.
 * - absent = a LIVE chat: the profile is fixed at create and the daemon
 *   never reports it back, so a KNOWN `profile` (Studio minted the chat)
 *   renders as a muted read-only line and an unknown one (undefined — the
 *   chat came from the TUI or a schedule) renders nothing at all.
 *
 * When the daemon reports its Shell tool OFF (`capabilities.bash === false`,
 * the operator's `--no-shell`) a muted note says so under the rows: "All
 * tools" then honestly means "all but Shell". Rendered outside the runtime
 * provider (a unit test, a display-only composer) the note simply stays
 * hidden.
 */

/** Read-only wording for a live chat's remembered profile. */
export function toolProfileReadOnlyLine(profile: SessionToolProfile): string {
  return `Tools: ${toolProfileLabel(profile)} — set when this chat was created`;
}

function useShellDisabledNote(): string | null {
  const runtime = useOptionalRuntimeStatus();
  return shellDisabledOnDaemon(runtime?.serverCapabilities)
    ? SHELL_DISABLED_NOTE
    : null;
}

/** The desktop Mode dropdown's Tools section (menu rows). */
export function ToolProfileMenuSection({
  profile,
  onProfileChange,
}: {
  profile?: SessionToolProfile;
  onProfileChange?: (profile: SessionToolProfile) => void;
}) {
  const shellNote = useShellDisabledNote();
  if (!onProfileChange && profile === undefined) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Tools
      </DropdownMenuLabel>
      {onProfileChange ? (
        TOOL_PROFILE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id || "all"}
            className="items-start gap-2"
            onClick={() => onProfileChange(option.id)}
          >
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                (profile ?? "") === option.id
                  ? "text-foreground"
                  : "text-transparent",
              )}
            />
            <span className="flex min-w-0 flex-col">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </DropdownMenuItem>
        ))
      ) : (
        <p
          role="note"
          className="px-2 py-1.5 text-xs text-muted-foreground"
          data-testid="tool-profile-readonly"
        >
          {toolProfileReadOnlyLine(profile ?? "")}
        </p>
      )}
      {shellNote && (
        <p role="note" className="px-2 py-1.5 text-xs text-muted-foreground">
          {shellNote}
        </p>
      )}
    </>
  );
}

/** The mobile mode sheet's Tools rows (the SheetOptionRow idiom). */
export function ToolProfileSheetRows({
  profile,
  onProfileChange,
}: {
  profile?: SessionToolProfile;
  onProfileChange?: (profile: SessionToolProfile) => void;
}) {
  const shellNote = useShellDisabledNote();
  if (!onProfileChange && profile === undefined) return null;
  return (
    <div className="border-t">
      <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
        Tools
      </p>
      {onProfileChange ? (
        TOOL_PROFILE_OPTIONS.map((option) => (
          <button
            key={option.id || "all"}
            type="button"
            onClick={() => onProfileChange(option.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
            <Check
              className={cn(
                "size-4 shrink-0",
                (profile ?? "") === option.id
                  ? "text-foreground"
                  : "text-transparent",
              )}
            />
          </button>
        ))
      ) : (
        <p role="note" className="px-4 py-2 text-xs text-muted-foreground">
          {toolProfileReadOnlyLine(profile ?? "")}
        </p>
      )}
      {shellNote && (
        <p role="note" className="px-4 pt-1 pb-3 text-xs text-muted-foreground">
          {shellNote}
        </p>
      )}
    </div>
  );
}
