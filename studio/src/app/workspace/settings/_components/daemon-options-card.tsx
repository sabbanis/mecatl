"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  type DaemonOptionsPatch,
  mergeDaemonOptions,
  useDaemonOptions,
} from "@/features/agent/hooks/use-daemon-options";
import type {
  HarnessDaemonOptions,
  HarnessDaemonOptionsDoc,
} from "@/lib/harness/daemon-options";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
} from "./settings-card";

/**
 * One editing scaffold for every daemon-options card (Tools, MCP
 * discovery, Memory stores): the offline / external / loading states, the
 * unsaved draft over the saved document, the "Restart required" pending
 * line, one "Save and restart" behind an AlertDialog confirm (every save
 * restarts the daemon and ends in-flight runs), Discard, and the hook's
 * error/notice. Each card supplies only its rows through `children` and
 * its daemon-reported status rows through `status`.
 *
 * `status` renders in BOTH modes whenever the runtime is live: it is the
 * daemon's own capability truth (what the running daemon registered),
 * which an external deployment reports just as well — only the controls
 * are managed-mode. The save always sends the WHOLE merged document; the
 * browser never composes a mecated flag (studio/CLAUDE.md rule 24).
 */

export interface DaemonOptionsView {
  /** The values the controls show: the unsaved draft, else the saved document. */
  options: HarnessDaemonOptions;
  doc: HarnessDaemonOptionsDoc;
  busy: boolean;
  /** Merges a partial change into the draft. */
  update: (patch: DaemonOptionsPatch) => void;
}

const sameOptions = (a: HarnessDaemonOptions, b: HarnessDaemonOptions) =>
  JSON.stringify(a) === JSON.stringify(b);

export function DaemonOptionsCard({
  title,
  description,
  testId,
  confirmTitle,
  externalNote,
  status,
  children,
}: {
  title: string;
  description: string;
  /** `data-testid` on the card body, for the pages' tests. */
  testId: string;
  /** The confirm dialog's question. */
  confirmTitle: string;
  /** One extra line under the external-mode note (the TUI's remote wording). */
  externalNote?: React.ReactNode;
  /** Daemon-reported status rows, shown in both modes while live. */
  status?: React.ReactNode;
  children: (view: DaemonOptionsView) => React.ReactNode;
}) {
  const { live, manageable, doc, isLoading, busy, error, notice, save } =
    useDaemonOptions();
  const [draft, setDraft] = useState<HarnessDaemonOptions | null>(null);
  const [confirming, setConfirming] = useState(false);

  let body: React.ReactNode;
  if (!live) {
    body = <OfflineNote />;
  } else if (!manageable) {
    body = (
      <div className="space-y-2">
        <ExternalManagedNote />
        {externalNote ? <Note>{externalNote}</Note> : null}
      </div>
    );
  } else if (!doc) {
    body = (
      <Note>
        {isLoading
          ? "Reading the daemon's options…"
          : (error ?? "The daemon's options could not be read right now.")}
      </Note>
    );
  } else {
    const shown = draft ?? doc.options;
    const dirty = !sameOptions(shown, doc.options);
    const update = (patch: DaemonOptionsPatch) =>
      setDraft(mergeDaemonOptions(shown, patch));
    const submit = async () => {
      setConfirming(false);
      const ok = await save(shown);
      if (ok) setDraft(null);
    };
    body = (
      <>
        {children({ options: shown, doc, busy, update })}
        {dirty ? (
          <p
            className="mt-3 text-xs text-muted-foreground"
            data-testid={`${testId}-pending`}
          >
            Restart required — saving restarts the daemon. In-flight runs end.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!dirty || busy}
            onClick={() => setConfirming(true)}
          >
            Save and restart
          </Button>
          {dirty ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Discard
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          {confirming && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  The daemon restarts with the new options: in-flight runs end
                  and their session ids die with them. Directories you named are
                  trusted like AGENTS.md — their contents steer the model.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void submit()}>
                  Save and restart
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      </>
    );
  }

  return (
    <SettingsCard title={title} description={description}>
      <div data-testid={testId}>
        {live && status ? (
          <div className="mb-4 divide-y divide-border/60 rounded-lg border px-4">
            {status}
          </div>
        ) : null}
        {body}
      </div>
    </SettingsCard>
  );
}

/** A daemon-reported capability as a plain status word. `null` = the
 *  daemon did not report it (an older daemon, or not probed yet). */
export function capabilityWord(
  value: unknown,
  { on, off }: { on: string; off: string },
): string {
  if (value === true) return on;
  if (value === false) return off;
  return "not reported";
}

/** One read-only status row: label left, the daemon's word right. */
export function StatusRow({
  label,
  value,
  testId,
  description,
}: {
  label: string;
  value: string;
  testId: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <span className="text-sm text-muted-foreground" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
