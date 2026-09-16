"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalChoice, ApprovalRequest } from "@/features/agent";
import { cn } from "@/lib/utils";
import { askToolName } from "./ask-args";
import { AskArgsView } from "./ask-args-view";
import { SidePanel } from "./side-panel";

const DELETE_WORDS = /\b(delete|remove|drop|revoke|destroy|purge|rm)\b/i;

/**
 * The full-height view of one permission ask in the right-hand side panel
 * (the TUI's ctrl+t args view): the reason and the decoded args fill and
 * scroll the panel, with the Raw/Pretty toggle, and the verdict buttons stay
 * pinned in a bottom bar. A verdict answers the ask and closes the panel.
 */
export function ApprovalDetailPanel({
  approval,
  onRespond,
  onClose,
  maximized,
  onToggleMaximize,
  windowControls,
}: {
  approval: ApprovalRequest;
  onRespond: (choice: ApprovalChoice) => void;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  windowControls?: boolean;
}) {
  const toolName = askToolName(approval);
  const destructive = DELETE_WORDS.test(toolName);
  const child = approval.child === true;
  const respond = (choice: ApprovalChoice) => {
    onRespond(choice);
    onClose();
  };
  return (
    <SidePanel
      icon={ShieldAlert}
      title={`${toolName} — permission ask`}
      closeLabel="Close permission details"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      windowControls={windowControls}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <p className="mb-2 text-sm text-muted-foreground">
            {child
              ? `A subagent's ${toolName} needs your approval.`
              : approval.description}
          </p>
          <AskArgsView
            approval={approval}
            layout="full"
            destructive={destructive}
            className="min-h-0 flex-1"
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <Button
            size="sm"
            onClick={() => respond("once")}
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
              onClick={() => respond("always")}
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
            onClick={() => respond("deny")}
            className="text-muted-foreground hover:text-foreground"
          >
            Deny
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}
