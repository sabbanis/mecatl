"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useConfirm } from "@/hooks/use-confirm";
import type {
  HarnessStoragePersistence,
  HarnessStorageSettings,
  HarnessStorageState,
} from "@/lib/harness/client";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/** The form's working copy: the mode plus the location AS TYPED (blank =
 *  "use the controller's default"). */
export interface StorageDraft {
  persistence: HarnessStoragePersistence;
  storeDir: string;
}

/**
 * What running without a store costs, in one sentence the in-form warning
 * and the confirm dialog share. Every clause is a real mecated consequence
 * of an empty --store-dir: no ScheduleStore (the scheduler never ticks), no
 * storage_health / storage_migration / storage_cleanup capability, no
 * awaiting-resume across a restart. Exported for its vitest.
 */
export const IN_MEMORY_CONSEQUENCES =
  "Chats vanish when the daemon stops or restarts, scheduled tasks never fire, storage health, retention and maintenance are unavailable, and a run interrupted by a restart cannot be resumed.";

const looksAbsolute = (path: string) =>
  path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);

/**
 * The resolved-path hint under the Location field. The controller reports
 * the resolved directory only for the SAVED document, so an edited value is
 * described by how it will resolve: as given when absolute, under the
 * workspace when relative, the default when blank. Exported for its vitest.
 */
export function describeLocation(
  draft: StorageDraft,
  saved: HarnessStorageState,
  workspace: string,
): string {
  const typed = draft.storeDir.trim();
  if (!typed) return `Default: ${saved.defaultDir}`;
  if (typed === saved.storeDir && saved.persistence === "durable" && saved.dir)
    return `Resolved: ${saved.dir}`;
  if (looksAbsolute(typed)) return `Resolved: ${typed}`;
  return `Resolves inside the workspace: ${workspace ? `${workspace}/` : ""}${typed}`;
}

/**
 * The confirm dialog's body for a saved→draft change: the restart every
 * save costs, then the one consequence that applies — going in-memory,
 * coming back to disk, or moving the store. Exported for its vitest.
 */
export function storageChangeSummary(
  saved: HarnessStorageState,
  draft: StorageDraft,
): string {
  const lines = ["Saving restarts the daemon: in-flight runs end."];
  const typed = draft.storeDir.trim();
  const nextLocation = typed || saved.defaultDir;
  if (draft.persistence === "memory") {
    lines.push(`Switching to in-memory: ${IN_MEMORY_CONSEQUENCES}`);
    if (saved.persistence === "durable" && saved.dir)
      lines.push(
        `Chats already stored at ${saved.dir} stay on disk and come back when you switch back to that location.`,
      );
  } else if (saved.persistence === "memory") {
    lines.push(
      `Switching to a durable store: the current in-memory chats are lost with the restart; from then on chats are written to ${nextLocation}.`,
    );
  } else if (typed !== saved.storeDir) {
    lines.push(
      `Changing the location: chats stored at ${saved.dir} stay on disk but disappear from the sidebar until you switch back to that location.`,
    );
  }
  return lines.join(" ");
}

/**
 * The exact document Save sends: the mode, plus the location only when one
 * was typed (blank means the controller's default, expressed by OMITTING the
 * key — an empty string would be refused there, because an empty --store-dir
 * IS the in-memory store). Exported for its vitest.
 */
export function storageSettingsFor(
  draft: StorageDraft,
): HarnessStorageSettings {
  const storeDir = draft.storeDir.trim();
  return storeDir
    ? { persistence: draft.persistence, storeDir }
    : { persistence: draft.persistence };
}

/**
 * The managed daemon's SESSION STORE: where chats are kept on disk, or that
 * they are not kept at all — the web analogue of mecated's `--store-dir`
 * (and of running without one). A spawn flag owned by Studio's controller,
 * never a settings.yaml key; every save restarts the daemon. Managed mode
 * only: an external deployment spawned its own daemon.
 */
export function SessionStorageSection({ runtime }: { runtime: Runtime }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [draft, setDraft] = useState<StorageDraft | null>(null);

  if (!runtime.live) {
    return (
      <SettingsCard title="Session store">
        <OfflineNote />
      </SettingsCard>
    );
  }

  if (runtime.mode === "external") {
    return (
      <SettingsCard title="Session store">
        <ExternalManagedNote />
      </SettingsCard>
    );
  }

  const saved = runtime.status?.storage ?? null;
  if (!saved) {
    return (
      <SettingsCard title="Session store">
        <Note>
          The controller did not report its session store. Restart Studio (task
          studio:dev) so the current controller is running.
        </Note>
      </SettingsCard>
    );
  }

  const view: StorageDraft = draft ?? {
    persistence: saved.persistence,
    storeDir: saved.storeDir,
  };
  const dirty =
    view.persistence !== saved.persistence ||
    view.storeDir.trim() !== saved.storeDir;
  const busy = runtime.busy === "storage";
  const patch = (next: Partial<StorageDraft>) => setDraft({ ...view, ...next });
  const durable = view.persistence === "durable";
  const workspace = runtime.status?.workspace ?? "";

  const save = async () => {
    const confirmed = await confirm({
      title: "Change the session store?",
      description: storageChangeSummary(saved, view),
      confirmText: durable ? "Save and restart" : "Switch to in-memory",
      destructive: !durable,
    });
    if (!confirmed) return;
    await runtime.saveStorage(storageSettingsFor(view));
    setDraft(null);
  };

  return (
    <SettingsCard
      title="Session store"
      description="Where the daemon keeps every chat, its transcript and its event log. The Memory page is separate: that is what the agent remembers, this is what you can reopen."
    >
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Durable store"
            htmlFor="session-store-durable"
            description={
              durable
                ? "Chats are written to the store directory and survive daemon restarts. Scheduled tasks, storage health, retention and resume all depend on it."
                : `In-memory: ${IN_MEMORY_CONSEQUENCES}`
            }
          >
            <Switch
              id="session-store-durable"
              checked={durable}
              onCheckedChange={(checked) =>
                patch({ persistence: checked ? "durable" : "memory" })
              }
            />
          </SettingsRow>

          <SettingsRow
            label="Location"
            htmlFor="session-store-dir"
            description="Relative paths resolve inside the workspace. Used when the store is durable; kept for later when it is not."
            className="[&>div:last-child]:w-full [&>div:last-child]:sm:max-w-md"
          >
            <div className="flex w-full flex-col gap-1.5">
              <Input
                id="session-store-dir"
                value={view.storeDir}
                onChange={(event) => patch({ storeDir: event.target.value })}
                placeholder={saved.defaultDir}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
              <p className="break-all font-mono text-xs text-muted-foreground">
                {describeLocation(view, saved, workspace)}
              </p>
            </div>
          </SettingsRow>
        </div>

        {!durable && (
          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>Running without a store. {IN_MEMORY_CONSEQUENCES}</span>
          </p>
        )}

        <Note>
          Studio starts from{" "}
          <code className="font-mono">MECATL_STUDIO_STORE_DIR</code> and{" "}
          <code className="font-mono">MECATL_STUDIO_NO_STORE=1</code> when they
          are set; a setting saved here overrides them.
        </Note>

        <Note>
          Saving restarts the daemon: in-flight runs end and session ids die
          with it.
        </Note>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Discard
            </Button>
          )}
          <Button
            variant="action"
            className="rounded-full"
            disabled={!dirty || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}
