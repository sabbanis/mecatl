"use client";

import { Fullscreen, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApprovalChoice, ApprovalRequest } from "@/features/agent";
import { cn } from "@/lib/utils";
import { AskArgsView } from "./ask-args-view";

const DELETE_WORDS = /\b(delete|remove|drop|revoke|destroy|purge|rm)\b/i;

/**
 * The daemon's verdict is three-way (allow_once / allow_always / deny), so the
 * panel offers exactly those scopes — no "for session" button, which would
 * promise a grant scope the backend does not model.
 */
export function ApprovalPanel({
  approval,
  onRespond,
  queuePosition,
  onExpand,
}: {
  approval: ApprovalRequest;
  onRespond: (choice: ApprovalChoice) => void;
  /** This ask's place in the FIFO queue (1-based). The "1 of N" badge shows
   *  only while more than one ask is waiting. */
  queuePosition?: { index: number; total: number };
  /** Opens the ask's full-height view (the side panel); omitted = the card
   *  offers no Expand button (the thread panel keeps it inline). */
  onExpand?: (approval: ApprovalRequest) => void;
}) {
  // ONE ask = ONE tool call. The pill names the tool; the args belong in the
  // preview block below, never badge-ified (a Write ask's args are a whole
  // file). Destructiveness is judged on the tool name alone — scanning file
  // CONTENT for the word "delete" painted harmless writes red.
  const toolName =
    approval.toolName ||
    approval.description.replace(/ needs your approval\.?$/i, "").trim() ||
    "Tool";
  const destructive = DELETE_WORDS.test(toolName);
  // A child's ask names who is asking. It offers no "Always allow": a
  // persistent grant learned from a throwaway child would outlive it (the
  // TUI withholds AllowAlways for child asks for the same reason).
  const child = approval.child === true;
  const description = child
    ? `A subagent's ${toolName} needs your approval.`
    : approval.description;
  const queued =
    queuePosition && queuePosition.total > 1 ? queuePosition : null;

  return (
    <div
      className={cn(
        "my-3 rounded-xl border p-4",
        destructive
          ? "border-destructive/40 bg-destructive/5"
          : "border-warning/30 bg-warning/5",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert
          className={cn(
            "size-4",
            destructive ? "text-destructive" : "text-warning",
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            destructive ? "text-destructive" : "text-warning",
          )}
        >
          Permission required
        </span>
        {queued && (
          <Badge
            variant="outline"
            aria-label={`Request ${queued.index} of ${queued.total}`}
            className="tabular-nums text-xs"
          >
            {`${queued.index} of ${queued.total}`}
          </Badge>
        )}
        {onExpand && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-7 text-muted-foreground hover:text-foreground"
            aria-label="Expand permission details"
            title="Expand permission details"
            onClick={() => onExpand(approval)}
          >
            <Fullscreen className="size-4" />
          </Button>
        )}
      </div>
      <p className="mb-2 text-sm">{description}</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge
          variant="secondary"
          className={cn(
            "gap-1 border-transparent font-mono text-xs",
            destructive
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/15 text-warning",
          )}
        >
          {toolName}
        </Badge>
        {child && (
          <Badge variant="outline" className="text-xs">
            Subagent
          </Badge>
        )}
      </div>
      {destructive && (
        <p className="mb-3 text-xs font-medium text-destructive">
          This action modifies or deletes data.
        </p>
      )}
      <AskArgsView
        approval={approval}
        destructive={destructive}
        className="mb-4"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onRespond("once")}
          className={cn(
            "text-white",
            destructive
              ? "bg-destructive hover:bg-destructive-strong"
              : "bg-warning hover:bg-warning/90",
          )}
        >
          Allow once
        </Button>
        {!child && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRespond("always")}
            className={cn(
              destructive
                ? "border-destructive/30 hover:bg-destructive/5"
                : "border-warning/30 hover:bg-warning/5",
            )}
          >
            Always allow
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRespond("deny")}
          className="text-muted-foreground hover:text-foreground"
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
