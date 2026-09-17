"use client";

import { Download, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
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
  applyPreferences,
  exportPreferences,
  PREFERENCE_ENTRIES,
  PREFERENCES_FILE_MAX_BYTES,
  PREFERENCES_FILE_NAME,
  type PreferencesImportPlan,
  parsePreferencesFile,
  planPreferencesImport,
  preferenceEntry,
  type RejectedPreference,
  serializePreferencesFile,
} from "@/lib/preferences-file";
import { SettingsCard, SettingsRow } from "./settings-card";

/**
 * Settings → Personalize → Preferences file: every browser-local Studio
 * preference as one strictly-validated JSON file — the web form of carrying
 * mecatui's client-owned settings.yaml to another machine. Export downloads
 * what this browser has set; Import previews exactly what would change
 * (set / cleared / refused-by-name) before anything is written, then reloads
 * so every preference hook re-hydrates from the new values.
 */

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage;
    return s && typeof s.getItem === "function" ? s : null;
  } catch {
    return null;
  }
}

function countSet(storage: Storage): number {
  let n = 0;
  for (const entry of PREFERENCE_ENTRIES) {
    try {
      if (storage.getItem(entry.key) !== null) n++;
    } catch {
      // unreadable → not counted
    }
  }
  return n;
}

/** `File.text()` where the browser has it, FileReader otherwise. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Hands `text` to the browser as a download. False when the page cannot
 * (no object URLs — an embedded or restricted context), so the caller can
 * say so instead of failing silently.
 */
function downloadTextFile(name: string, text: string): boolean {
  if (typeof URL.createObjectURL !== "function") return false;
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Let the click dispatch before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return true;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function labelFor(key: string): string {
  return preferenceEntry(key)?.label ?? key;
}

interface ImportPreview {
  fileName: string;
  exportedAt: string | null;
  accepted: Record<string, string>;
  rejected: RejectedPreference[];
  plan: PreferencesImportPlan;
}

function PreviewList({
  heading,
  ariaLabel,
  items,
}: {
  heading: string;
  ariaLabel: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading} ({items.length})
      </h3>
      <ul aria-label={ariaLabel} className="text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PreferencesFileSection({
  reload = () => window.location.reload(),
}: {
  /** Injected so tests can observe the post-import reload. */
  reload?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const errorId = useId();
  const [setCount, setSetCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // Hydrate the "N preferences set" line on mount (SSR has no storage).
  useEffect(() => {
    const storage = localStorageOrNull();
    setSetCount(storage ? countSet(storage) : 0);
  }, []);

  function onExport() {
    const storage = localStorageOrNull();
    if (!storage) {
      toast.error("This browser's storage is not available.");
      return;
    }
    const file = exportPreferences(storage);
    const n = Object.keys(file.preferences).length;
    if (
      !downloadTextFile(PREFERENCES_FILE_NAME, serializePreferencesFile(file))
    ) {
      toast.error("This browser cannot save files from a page.");
      return;
    }
    toast.success(
      `Exported ${count(n, "preference")} to ${PREFERENCES_FILE_NAME}`,
    );
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > PREFERENCES_FILE_MAX_BYTES) {
      setError(
        `${file.name} is larger than ${PREFERENCES_FILE_MAX_BYTES / (1024 * 1024)} MiB.`,
      );
    } else {
      const result = parsePreferencesFile(await readFileText(file));
      if (!result.ok) {
        setError(`${file.name}: ${result.error}.`);
      } else {
        const storage = localStorageOrNull();
        if (!storage) {
          setError("This browser's storage is not available.");
        } else {
          setPreview({
            fileName: file.name,
            exportedAt: result.exportedAt,
            accepted: result.accepted,
            rejected: result.rejected,
            plan: planPreferencesImport(result, storage),
          });
        }
      }
    }
    // Let the same file be picked again after a fix.
    input.value = "";
  }

  function onConfirm() {
    if (!preview) return;
    const storage = localStorageOrNull();
    if (!storage) {
      toast.error("This browser's storage is not available.");
      return;
    }
    try {
      applyPreferences(preview, storage);
    } catch {
      toast.error(
        "Could not write the preferences — this browser's storage is full or disabled.",
      );
      return;
    }
    setPreview(null);
    reload();
  }

  const nothingToChange =
    preview !== null &&
    preview.plan.write.length === 0 &&
    preview.plan.clear.length === 0;

  const exportedWhen =
    preview?.exportedAt !== null && preview?.exportedAt !== undefined
      ? new Date(preview.exportedAt).toLocaleString()
      : null;

  return (
    <SettingsCard
      title="Preferences file"
      description="Every Studio preference on this browser as one file — move them to another browser or device."
    >
      <div className="divide-y divide-border/60">
        <SettingsRow
          label="Export"
          description={
            setCount === null
              ? "Downloads the preferences set in this browser as JSON."
              : `Downloads the ${count(setCount, "preference")} set in this browser as JSON.`
          }
        >
          <Button
            type="button"
            variant="outline"
            className="w-44 rounded-full"
            onClick={onExport}
          >
            <Download className="size-4" />
            Export
          </Button>
        </SettingsRow>
        <SettingsRow
          label="Import"
          description="Replaces this browser's preferences with a file's. You see what changes before anything is written; unknown keys and invalid values are listed, never dropped quietly."
        >
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="outline"
              className="w-44 rounded-full"
              onClick={() => fileInput.current?.click()}
              aria-describedby={error ? errorId : undefined}
            >
              <Upload className="size-4" />
              Import…
            </Button>
            <Label htmlFor={fileId} className="sr-only">
              Import a preferences file
            </Label>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={onFile}
            />
          </div>
        </SettingsRow>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="pt-3 text-xs text-destructive"
          >
            Not imported — {error}
          </p>
        ) : null}
      </div>

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace this browser&rsquo;s preferences?</DialogTitle>
            <DialogDescription>
              From {preview?.fileName ?? "the file"}
              {exportedWhen ? `, exported ${exportedWhen}` : ""}. Preferences
              not in the file go back to their defaults here. Studio reloads
              afterwards.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-4">
              {nothingToChange ? (
                <p className="text-sm text-muted-foreground">
                  Nothing to change — this file matches this browser.
                </p>
              ) : null}
              <PreviewList
                heading="Will be set"
                ariaLabel="Preferences to set"
                items={preview.plan.write.map(labelFor)}
              />
              <PreviewList
                heading="Will be cleared"
                ariaLabel="Preferences to clear"
                items={preview.plan.clear.map(labelFor)}
              />
              <PreviewList
                heading="Not imported"
                ariaLabel="Preferences not imported"
                items={preview.rejected.map((r) => `${r.key} — ${r.reason}`)}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={nothingToChange}
            >
              Replace and reload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
