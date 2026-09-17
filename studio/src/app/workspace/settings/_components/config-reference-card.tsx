"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ABOUT_STUDIO_URL,
  STUDIO_ENV_REFERENCE,
  STUDIO_ENV_TIER_LABEL,
  type StudioAbout,
  type StudioEnvEntry,
} from "@/lib/studio-config-reference";
import { SettingsCard } from "./settings-card";

/** What the card knows about this deployment's environment. */
type Configured =
  | { state: "loading" }
  | { state: "ready"; names: Record<string, boolean> }
  | { state: "error"; message: string };

/** What the fetch failure reads as, in plain words. */
export const CONFIGURED_UNAVAILABLE =
  "Which variables are set could not be read from the server; the table still lists them.";

/** The status cell for one row: the words and the badge tint. */
function statusFor(
  entry: StudioEnvEntry,
  configured: Configured,
): { text: string; variant: "muted" | "success" | "outline" } {
  if (configured.state === "loading")
    return { text: "checking…", variant: "outline" };
  if (configured.state === "error")
    return { text: "unknown", variant: "outline" };
  if (!configured.names[entry.name]) return { text: "Unset", variant: "muted" };
  return {
    text: entry.secret ? "Set (hidden)" : "Set",
    variant: "success",
  };
}

/**
 * The in-app reference of Studio's configuration surface — the web analogue
 * of mecatui's `--help-flags`. The rows come from `STUDIO_ENV_REFERENCE`
 * (data, so the table renders complete before any request); the Status
 * column fills from `GET /api/studio/about`, which answers names and
 * booleans only. A value is never shown, a secret least of all: its row
 * says "Set (hidden)" and nothing more.
 */
export function ConfigReferenceCard() {
  const [configured, setConfigured] = useState<Configured>({
    state: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(ABOUT_STUDIO_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as Partial<StudioAbout>;
        const names: Record<string, boolean> = {};
        for (const [name, set] of Object.entries(body.configured ?? {})) {
          names[name] = set === true;
        }
        if (!controller.signal.aborted)
          setConfigured({ state: "ready", names });
      } catch (error) {
        if (controller.signal.aborted) return;
        setConfigured({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <SettingsCard
      title="Configuration reference"
      description="Every environment variable Studio reads, and whether this deployment sets it. Values are never shown."
    >
      <div className="flex flex-col gap-3">
        <Table
          aria-label="Studio configuration reference"
          containerClassName="rounded-lg border bg-background"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Variable</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Read by</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STUDIO_ENV_REFERENCE.map((entry) => {
              const status = statusFor(entry, configured);
              return (
                <TableRow key={entry.name} data-env-name={entry.name}>
                  <TableCell className="align-top font-mono text-xs">
                    {entry.name}
                  </TableCell>
                  <TableCell className="min-w-[16rem] max-w-prose align-top whitespace-normal text-xs text-muted-foreground">
                    {entry.purpose}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline">
                      {STUDIO_ENV_TIER_LABEL[entry.tier]}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant={status.variant}
                      data-testid={`config-status-${entry.name}`}
                      data-configured={
                        configured.state === "ready"
                          ? String(Boolean(configured.names[entry.name]))
                          : undefined
                      }
                    >
                      {status.text}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {configured.state === "error" ? (
          <p className="text-xs text-warning" role="status">
            {CONFIGURED_UNAVAILABLE} ({configured.message})
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          The server tier reads its variables when <code>next start</code>{" "}
          begins and the local controller reads its own when it starts, so a
          change takes effect after a restart; build variables are read once at{" "}
          <code>next build</code>. The Studio guide in the repository (
          <code>studio/CLAUDE.md</code>) describes each in full.
        </p>
      </div>
    </SettingsCard>
  );
}
