"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type BindingError,
  bindingCaution,
  comboFromKeyboardEvent,
} from "@/lib/shortcuts/keymap";
import { keycaps } from "@/lib/shortcuts/registry";
import { cn } from "@/lib/utils";

/** The toast a refused recording shows — one plain sentence per reason. */
export function bindingErrorMessage(error: BindingError): string {
  switch (error.reason) {
    case "invalid":
      return "Not a valid shortcut";
    case "reserved":
      return "Reserved by the browser — Studio may never receive it";
    case "collision":
      return `Already used by “${error.withDescription}”`;
  }
}

/** Keycaps for a combo in the Settings idiom (small, monospace). */
export function Keycaps({
  combo,
  className,
}: {
  combo: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keycaps(combo).map((cap, i) => (
        <kbd
          // biome-ignore lint/suspicious/noArrayIndexKey: positional keycaps
          key={i}
          className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground"
        >
          {cap}
        </kbd>
      ))}
    </span>
  );
}

/**
 * One shortcut's key control on Settings → Keyboard: the current keycaps as
 * a button; click it and the NEXT key press becomes the new binding. While
 * recording, a capture-phase window listener owns every key: Esc cancels, a
 * lone modifier keeps listening, anything else is offered to `onRecord`,
 * whose verdict lands as a toast (updated / not valid / reserved / already
 * used by …). Recording ends either way, so a refused key never leaves the
 * row armed. The press is fully consumed (default + propagation) so the
 * global dispatcher and the focused button never act on it, and the matching
 * key-up is swallowed too, or Space's key-up "click" would re-arm the row.
 */
export function RecordKeyButton({
  combo,
  custom,
  label,
  onRecord,
  onReset,
}: {
  /** The combo currently in effect (canonical registry grammar). */
  combo: string;
  /** True when a user override is in effect — shows the reset control. */
  custom: boolean;
  /** The shortcut's description, for the accessible name. */
  label?: string;
  /** Offer a recorded combo; null = accepted, else why it was refused. */
  onRecord: (combo: string) => BindingError | null;
  onReset?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const onRecordRef = useRef(onRecord);
  onRecordRef.current = onRecord;
  const swallowKeyUp = useRef(false);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      swallowKeyUp.current = true;
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const next = comboFromKeyboardEvent(e);
      if (!next) return;
      const error = onRecordRef.current(next);
      if (error) {
        toast.error(bindingErrorMessage(error));
      } else {
        // Accepted — but a chord without ⌘ won't fire while typing, and a
        // user moving a shortcut off a ⌘ chord should hear that now, not
        // discover it in the composer.
        const caution = bindingCaution(next);
        if (caution)
          toast.success("Shortcut updated", { description: caution });
        else toast.success("Shortcut updated");
      }
      setRecording(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording]);

  // Lives for the row's whole life: by the time the recorded key comes back
  // up, the recording effect above has already been torn down.
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (!swallowKeyUp.current) return;
      swallowKeyUp.current = false;
      e.preventDefault();
    };
    window.addEventListener("keyup", onKeyUp, true);
    return () => window.removeEventListener("keyup", onKeyUp, true);
  }, []);

  const caps = keycaps(combo);
  const name = recording
    ? "Recording — press the new shortcut, or Esc to cancel"
    : `Change shortcut${label ? ` for ${label}` : ""} (currently ${caps.join(" ")})`;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={name}
        aria-pressed={recording}
        className={cn(
          "h-8 min-w-[5.5rem] px-2",
          recording && "ring-2 ring-ring",
        )}
        onClick={() => setRecording((r) => !r)}
        onBlur={() => setRecording(false)}
      >
        {recording ? (
          <span className="text-xs text-muted-foreground">
            Press keys… (Esc cancels)
          </span>
        ) : (
          <Keycaps combo={combo} />
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {recording
          ? "Recording. Press the new shortcut, or Esc to cancel."
          : ""}
      </span>
      {custom && onReset ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Reset to default"
          title="Reset to default"
          onClick={onReset}
        >
          <RotateCcw className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
