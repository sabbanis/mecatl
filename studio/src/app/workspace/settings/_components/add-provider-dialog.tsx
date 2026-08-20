"use client";

import { Check, Copy, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  HarnessProviderInfo,
  KnownHarnessProvider,
} from "@/lib/harness/client";

/**
 * Guided provider add, with deliberately NO key input anywhere (Studio rule
 * 3: credentials never cross the browser/controller boundary): pick a kind,
 * copy the exact auth.yaml snippet — `<YOUR_KEY>` placeholder and all — into
 * the file on the daemon's machine, then Re-check reads the inventory back
 * through the controller and offers the restart that makes mecated see it.
 */
export function AddProviderDialog({
  known,
  configured,
  authFile,
  reload,
  restartDaemon,
  restarting,
}: {
  known: KnownHarnessProvider[];
  configured: string[];
  /** The auth.yaml path on the controller's machine (from /status). */
  authFile: string;
  /** Re-reads the inventory; resolves to the fresh rows. */
  reload: () => Promise<HarnessProviderInfo[]>;
  /** Restarts the daemon so the new block takes effect. */
  restartDaemon: () => Promise<void>;
  restarting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<"appeared" | "missing" | null>(null);

  const selected = known.find((provider) => provider.name === kind) ?? null;
  const alreadyConfigured = new Set(configured);
  const path = authFile || "~/.config/mecatl/auth.yaml";

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setKind("");
      setCopied(false);
      setChecked(null);
    }
  }

  async function copySnippet() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard unavailable — the block is selectable text either way.
    }
  }

  async function recheck() {
    if (!selected) return;
    setChecking(true);
    try {
      const rows = await reload();
      setChecked(
        rows.some((row) => row.name === selected.name) ? "appeared" : "missing",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => handleOpenChange(true)}
      >
        <Plus className="size-4" />
        Add provider
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a provider</DialogTitle>
            <DialogDescription>
              The key goes straight into{" "}
              <code className="font-mono text-xs">{path}</code> on the machine
              running mecated — Studio never sees or stores it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-provider-kind">Provider</Label>
              <Select value={kind || undefined} onValueChange={setKind}>
                <SelectTrigger id="add-provider-kind" className="w-full">
                  <SelectValue placeholder="Choose a provider kind…" />
                </SelectTrigger>
                <SelectContent>
                  {known.map((provider) => (
                    <SelectItem
                      key={provider.name}
                      value={provider.name}
                      disabled={alreadyConfigured.has(provider.name)}
                    >
                      {provider.label}
                      {alreadyConfigured.has(provider.name) &&
                        " (already configured)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Merge under the{" "}
                      <code className="font-mono">providers:</code> key in{" "}
                      <code className="font-mono">{path}</code>
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => void copySnippet()}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {selected.snippet}
                  </pre>
                  {selected.note && (
                    <p className="text-xs text-muted-foreground">
                      {selected.note}
                    </p>
                  )}
                </div>

                {checked === "appeared" ? (
                  <p className="text-sm">
                    <span className="font-medium">{selected.label}</span> is now
                    in auth.yaml. Restart the daemon to apply — in-flight runs
                    and session ids die with it.
                  </p>
                ) : checked === "missing" ? (
                  <p className="text-sm text-muted-foreground">
                    Not there yet — save the file on the daemon&rsquo;s machine,
                    then re-check.
                  </p>
                ) : null}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            {selected && checked !== "appeared" && (
              <Button
                variant="action"
                disabled={checking}
                onClick={() => void recheck()}
              >
                {checking ? "Checking…" : "Re-check"}
              </Button>
            )}
            {selected && checked === "appeared" && (
              <Button
                variant="action"
                disabled={restarting}
                onClick={async () => {
                  await restartDaemon();
                  setOpen(false);
                }}
              >
                {restarting ? "Restarting…" : "Restart daemon to apply"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
