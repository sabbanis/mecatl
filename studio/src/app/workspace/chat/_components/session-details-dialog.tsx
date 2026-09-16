"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchHarnessSessionIdentity,
  type HarnessSessionIdentity,
} from "@/lib/harness/sessions";
import type { SessionPermissionMode } from "@/lib/protocol";

/**
 * The `/session` built-in: the active session's exact daemon id (with a Copy
 * button — the id is what `InspectSubagent`, `resume:` and support asks
 * need verbatim), its title, lifecycle state, permission mode, resolved
 * provider/model/context window, the server-owned placement's DISPLAY
 * metadata (label + branch, never a path — ADR 0291) and creation time.
 * Read fresh from the snapshot each time the dialog opens.
 */
export function SessionDetailsDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [identity, setIdentity] = useState<HarnessSessionIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setIdentity(null);
    setCopied(false);
    fetchHarnessSessionIdentity(sessionId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setIdentity(value);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, sessionId]);

  const id = identity?.id ?? sessionId ?? "";

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Session ID copied");
    } catch {
      toast.error("Could not copy — select the ID and copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session details</DialogTitle>
          <DialogDescription>
            The active chat as the daemon records it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs"
            title={id}
          >
            {id}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => void copyId()}
            aria-label="Copy session ID"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground" role="status">
            Loading session details…
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            Could not load the session: {error}
          </p>
        )}
        {identity && <IdentityRows identity={identity} />}
      </DialogContent>
    </Dialog>
  );
}

const MODE_LABEL: Record<SessionPermissionMode, string> = {
  default: "Default",
  plan: "Plan",
  acceptEdits: "Accept edits",
};

function IdentityRows({ identity }: { identity: HarnessSessionIdentity }) {
  const rows: [string, string][] = [
    ["Title", identity.title || "Untitled chat"],
    ["State", identity.state || "unavailable"],
    ["Permission mode", MODE_LABEL[identity.mode] ?? identity.mode],
    ["Provider", identity.resolvedModel?.providerId || "unavailable"],
    ["Model", identity.resolvedModel?.modelId || "unavailable"],
    [
      "Context window",
      identity.resolvedModel?.contextWindow
        ? `${identity.resolvedModel.contextWindow.toLocaleString()} tokens`
        : "unavailable",
    ],
  ];
  if (identity.placement) {
    rows.push([
      "Placement",
      identity.placement.label
        ? `${identity.placement.label}${identity.placement.kind ? ` (${identity.placement.kind})` : ""}`
        : identity.placement.kind,
    ]);
    if (identity.placement.branch) {
      rows.push(["Branch", identity.placement.branch]);
    }
  }
  rows.push([
    "Created",
    identity.createdAtUnix > 0
      ? new Date(identity.createdAtUnix * 1000).toLocaleString()
      : "unavailable",
  ]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
