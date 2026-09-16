"use client";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";

/**
 * The explicit `--mock` control: restarts the managed daemon on the offline
 * mock provider (canned turns, no network, no key) — the smoke-run target
 * mecated's own `--mock` flag selects. Until now the daemon landed on the
 * mock only implicitly (no selection and no ToolHive gateway, or the last
 * provider removed); this button makes the choice deliberate, confirms the
 * restart first, and is hidden while the mock is already active. The
 * switch is durable: the controller persists it like any provider choice.
 */
export function SwitchToMockButton({
  busy,
  onSwitch,
}: {
  /** True while the controller is already switching providers. */
  busy: boolean;
  /** `management.setActiveProvider("mock")` plus a status refresh. */
  onSwitch: () => Promise<void> | void;
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const run = async () => {
    const confirmed = await confirm({
      title: "Switch to the offline mock?",
      description:
        "The daemon restarts on the built-in mock provider: canned turns, no model calls, no key. In-flight runs and session ids die with the restart. Set a provider as active to come back.",
      confirmText: "Switch to mock",
    });
    if (!confirmed) return;
    await onSwitch();
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Switching…" : "Switch to offline mock"}
      </Button>
      {ConfirmDialog}
    </>
  );
}
