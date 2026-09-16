"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { fetchHarnessMcpServerNames } from "@/lib/harness/mcp-sources";

/**
 * The ADR-0254 consent disclosure, word for word: invoking the debugger sends
 * the target's STORED transcript and event evidence — secrets included — to
 * the model, even though the target itself is never modified.
 */
export const DEBUG_SESSION_CONSENT =
  "This creates a separate diagnostic chat bound to this session. " +
  "The session's stored transcript and event evidence — including " +
  "anything sensitive it contains — will be sent to the model as " +
  "debugging evidence. The session itself is read-only to the " +
  "debugger and is never modified.";

/** Why attaching a server never turns the debugger into an auto-publisher. */
export const DEBUG_MCP_APPROVAL_HINT =
  "Every debugger MCP call asks for your approval, even under auto or yolo posture. Allow once approves one call; Always allow is not learned for these calls.";

/** Shown when the daemon lists no configured MCP server. */
export const NO_MCP_SERVER_NOTE =
  "No MCP server is configured on this daemon — connect one in Settings → MCP gateway.";

/** Shown when the daemon could not list its servers (an older daemon). */
export const MCP_LIST_UNAVAILABLE_NOTE =
  "Studio could not list this daemon's MCP servers. Enter the configured names; the daemon refuses a name it does not know.";

/**
 * Splits a typed server list on commas and whitespace, trims, drops empties
 * and duplicates (the daemon rejects a duplicate name with 400).
 */
export function parseServerNames(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\s]+/)) {
    const name = raw.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** What the dialog knows about the daemon's configured MCP servers. */
export type McpServerListing =
  | { status: "loading" }
  | { status: "ready"; names: string[] }
  | { status: "unavailable" };

export interface DebugSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the daemon accepts `debug_mcp_servers` (`capabilities.debug_mcp`).
   *  False hides the whole attach section — a plain debug session. */
  mcpSupported: boolean;
  /** The daemon's configured MCP servers (GET /v1/mcp/sources): offered as
   *  checkboxes when listed; a text input when the daemon could not list. */
  servers: McpServerListing;
  /** Confirms the consent with the chosen server names ([] = none). */
  onConfirm: (mcpServers: string[]) => void;
}

/**
 * The "Debug with AI" consent dialog (ADR 0254): the mandated disclosure,
 * and — only when the daemon's `debug_mcp` capability is on — the choice of
 * already-configured server-global MCP servers the debugger may borrow, so
 * it can (after fresh approval of every call) act on what it finds, e.g.
 * publish the issue it drafted. The TUI's `--debug-mcp NAME` flag, as a
 * picker.
 */
export function DebugSessionDialog({
  open,
  onOpenChange,
  mcpSupported,
  servers,
  onConfirm,
}: DebugSessionDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const baseId = useId();

  // A fresh choice per opening: a selection made for one target must not
  // silently ride into the next debug session.
  useEffect(() => {
    if (open) {
      setSelected([]);
      setTyped("");
    }
  }, [open]);

  const toggle = (name: string, checked: boolean) =>
    setSelected((prev) =>
      checked
        ? prev.includes(name)
          ? prev
          : [...prev, name]
        : prev.filter((n) => n !== name),
    );

  const chosen = !mcpSupported
    ? []
    : servers.status === "unavailable"
      ? parseServerNames(typed)
      : selected;

  const attachSection = mcpSupported ? (
    <fieldset className="space-y-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">
        Attach debugger MCP servers
      </legend>
      {servers.status === "loading" && (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Listing configured MCP servers…
        </p>
      )}
      {servers.status === "ready" && servers.names.length === 0 && (
        <p className="text-xs text-muted-foreground">{NO_MCP_SERVER_NOTE}</p>
      )}
      {servers.status === "ready" && servers.names.length > 0 && (
        <ul className="space-y-1.5">
          {servers.names.map((name, index) => {
            const id = `${baseId}-server-${index}`;
            return (
              <li key={name} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={selected.includes(name)}
                  onCheckedChange={(value) => toggle(name, value === true)}
                />
                <Label htmlFor={id} className="font-mono text-xs font-normal">
                  {name}
                </Label>
              </li>
            );
          })}
        </ul>
      )}
      {servers.status === "unavailable" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-names`} className="text-xs">
            Server names (comma-separated)
          </Label>
          <Input
            id={`${baseId}-names`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="github, slack"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {MCP_LIST_UNAVAILABLE_NOTE}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground" role="note">
        {DEBUG_MCP_APPROVAL_HINT}
      </p>
    </fieldset>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Debug with AI</DialogTitle>
          <DialogDescription>{DEBUG_SESSION_CONSENT}</DialogDescription>
        </DialogHeader>
        {attachSection}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(chosen)}>
            Send evidence &amp; debug
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owns the dialog for the workspace (the `useConfirm` shape): `request(id)`
 * opens it for one target; a confirm closes it and hands the caller the
 * target with the chosen servers. Reads the daemon's `debug_mcp` capability
 * off the runtime status and lists its configured MCP servers on open — a
 * daemon that cannot list them falls back to typed names.
 */
export function useDebugSessionDialog({
  onCreate,
}: {
  onCreate: (targetSessionId: string, mcpServers: string[]) => void;
}) {
  const { serverCapabilities } = useRuntimeStatus();
  const mcpSupported = serverCapabilities.debug_mcp === true;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [servers, setServers] = useState<McpServerListing>({
    status: "loading",
  });

  const open = targetId !== null;
  useEffect(() => {
    if (!open || !mcpSupported) return;
    const controller = new AbortController();
    setServers({ status: "loading" });
    fetchHarnessMcpServerNames(controller.signal)
      .then((names) => {
        if (!controller.signal.aborted) setServers({ status: "ready", names });
      })
      .catch(() => {
        if (!controller.signal.aborted) setServers({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [open, mcpSupported]);

  const requestDebugSession = useCallback((id: string) => setTargetId(id), []);
  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setTargetId(null);
  }, []);
  const handleConfirm = useCallback(
    (mcpServers: string[]) => {
      if (targetId === null) return;
      setTargetId(null);
      onCreate(targetId, mcpServers);
    },
    [targetId, onCreate],
  );

  const debugSessionDialog = (
    <DebugSessionDialog
      open={open}
      onOpenChange={handleOpenChange}
      mcpSupported={mcpSupported}
      servers={servers}
      onConfirm={handleConfirm}
    />
  );
  return { requestDebugSession, debugSessionDialog };
}
