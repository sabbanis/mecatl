"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import {
  isRebindable,
  type ShortcutBinding,
  useShortcutBindings,
} from "@/lib/shortcuts/keymap";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts/registry";
import { Keycaps, RecordKeyButton } from "../_components/record-key-button";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

/** Why a read-only row cannot be rebound — the TUI keymap's "fixed" keys. */
function notRebindableNote(binding: ShortcutBinding): string {
  return binding.locked
    ? "Not rebindable — Esc stays the fallback beneath dialogs and menus."
    : "Not rebindable — handled by the composer or the conversation itself.";
}

/**
 * Settings → Keyboard: the TUI's `keymap` setting for the browser. Every
 * shortcut from the registry, grouped as the help reference groups them;
 * rebindable rows carry a recorder, fixed/locked rows are listed read-only
 * so the page is the COMPLETE keymap. Overrides are stored in this browser
 * only (`useShortcutBindings`), and the dispatcher, the reference page and
 * the ⌘K hint all read the same effective bindings.
 */
export default function KeyboardSettingsPage() {
  const { bindings, setBinding, resetBinding, resetAll, hasOverrides } =
    useShortcutBindings();
  const { confirm, ConfirmDialog } = useConfirm();

  async function onResetAll() {
    const ok = await confirm({
      title: "Reset all shortcuts?",
      description:
        "Every shortcut goes back to its default. Only this browser is affected.",
      confirmText: "Reset all",
    });
    if (!ok) return;
    resetAll();
    toast.success("Shortcuts reset to defaults");
  }

  return (
    <>
      <SettingsCard
        title="Keyboard shortcuts"
        description="Stored in this browser. ⌘ means Ctrl on Windows and Linux. Click a key to record a new one."
      >
        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`keymap-group-${group}`}>
              <h3
                id={`keymap-group-${group}`}
                className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {group}
              </h3>
              <div className="divide-y divide-border/60">
                {bindings
                  .filter((b) => b.group === group)
                  .map((b) =>
                    isRebindable(b) ? (
                      <SettingsRow key={b.id} label={b.description}>
                        <RecordKeyButton
                          combo={b.effectiveCombo}
                          custom={b.custom}
                          label={b.description}
                          onRecord={(combo) => setBinding(b.id, combo)}
                          onReset={() => resetBinding(b.id)}
                        />
                      </SettingsRow>
                    ) : (
                      <SettingsRow
                        key={b.id}
                        label={b.description}
                        description={notRebindableNote(b)}
                      >
                        <Keycaps combo={b.effectiveCombo} />
                      </SettingsRow>
                    ),
                  )}
              </div>
            </section>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <Link
              href="/workspace/shortcuts"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View the shortcuts reference →
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasOverrides}
              onClick={() => void onResetAll()}
            >
              Reset all
            </Button>
          </div>
        </div>
      </SettingsCard>
      {ConfirmDialog}
    </>
  );
}
