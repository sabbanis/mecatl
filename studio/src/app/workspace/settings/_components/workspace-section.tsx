"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useOptionalRuntimeStatus } from "@/features/agent/runtime-status";
import { useConfirm } from "@/hooks/use-confirm";
import { usePrompt } from "@/hooks/use-prompt";
import { saveHarnessWorkspace } from "@/lib/harness/client";
import { knownPostureTier } from "@/lib/posture";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/** What the card says once the controller has restarted the daemon. */
export const WORKSPACE_CHANGED_NOTICE =
  "Workspace root changed. The daemon restarted against the new root.";

/** The card's one-sentence purpose, shared by every state. */
const CARD_DESCRIPTION =
  "The directory the daemon edits and every chat runs in — the --workspace the managed daemon is started with.";

/**
 * The confirm dialog's body: names the directory, the posture in force
 * (its tool approvals apply to the new root), the restart cost, what
 * happens to the chat list, to project trust, and which directory the
 * controller creates inside the new root. Exported for its vitest.
 */
export function workspaceChangeSummary({
  next,
  posture,
}: {
  next: string;
  posture: string;
}): string {
  const tier = knownPostureTier(posture);
  const postureClause = tier
    ? `It runs there with the ${tier} posture, so the same tool approvals apply to that directory.`
    : "It runs there with its current posture, so the same tool approvals apply to that directory.";
  return [
    `The daemon restarts against ${next}. Restarting ends in-flight runs and their session ids.`,
    postureClause,
    "Chats belong to their workspace: the current list is stored per root and reappears when you switch back.",
    "Project trust granted for the current root is withdrawn; the new root asks again if it carries project configuration.",
    "The controller creates .mecatl/skills inside the new root; sessions and memory stay in Studio's own state directory.",
  ].join(" ");
}

/**
 * Settings → Workspace: the managed daemon's workspace root — the web
 * analogue of the TUI's `--workspace` deployment choice. Both modes show
 * the root the controller / deployment reports (a display label, never a
 * placement input — Studio rule 2); managed mode can change it, which
 * restarts the daemon, and reset it to the controller's default.
 *
 * The write goes straight to the controller (`saveHarnessWorkspace`) with
 * the card's own busy/error/notice state, then re-reads the runtime so the
 * row shows the root the NEW spawn got.
 */
export function WorkspaceSection({ runtime }: { runtime: Runtime }) {
  const status = useOptionalRuntimeStatus();
  const posture = status?.posture ?? "";
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!runtime.live) {
    return (
      <SettingsCard title="Workspace" description={CARD_DESCRIPTION}>
        <OfflineNote />
      </SettingsCard>
    );
  }

  const workspace = runtime.status?.workspace ?? "";
  const defaultWorkspace = runtime.status?.defaultWorkspace ?? "";
  const external = runtime.mode === "external";
  const canReset = Boolean(defaultWorkspace) && workspace !== defaultWorkspace;

  const change = async (target?: string) => {
    let next = target ?? null;
    if (next === null) {
      next = await prompt({
        title: "Workspace root",
        description:
          "An absolute path to a directory on the machine running Studio's controller. The daemon restarts there.",
        placeholder: "/absolute/path/to/repo",
        defaultValue: workspace,
        confirmText: "Continue",
      });
      if (next === null) return;
    }
    if (next === workspace) {
      setError(null);
      setNotice("That is already the workspace root.");
      return;
    }
    const tier = knownPostureTier(posture);
    const confirmed = await confirm({
      title: "Change the workspace root?",
      description: workspaceChangeSummary({ next, posture }),
      confirmText: "Change and restart",
      destructive: tier === "auto" || tier === "yolo",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveHarnessWorkspace(next);
      await runtime.refresh();
      setNotice(WORKSPACE_CHANGED_NOTICE);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Workspace" description={CARD_DESCRIPTION}>
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Workspace root"
            description={
              external
                ? "Reported by the external deployment (MECATL_WORKSPACE). Chats run in the placement the daemon binds them to."
                : "Every chat runs here. Chats belong to their workspace: the list is stored per root and reappears when you switch back."
            }
            className="[&>div:last-child]:w-full [&>div:last-child]:sm:w-auto"
          >
            <div className="flex w-full flex-col items-start gap-2 sm:items-end">
              <span
                className="break-all font-mono text-sm text-muted-foreground"
                data-testid="workspace-root"
              >
                {workspace || "not reported"}
              </span>
              {!external && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => void change()}
                  >
                    {busy ? "Restarting…" : "Change…"}
                  </Button>
                  {canReset && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      disabled={busy}
                      onClick={() => void change(defaultWorkspace)}
                    >
                      Reset to default
                    </Button>
                  )}
                </div>
              )}
            </div>
          </SettingsRow>
        </div>

        {external ? (
          <ExternalManagedNote />
        ) : (
          <>
            {!workspace && (
              <Note>
                The controller did not report its workspace root. Restart Studio
                (task studio:dev) so the current controller is running.
              </Note>
            )}
            {canReset && (
              <Note>
                Default:{" "}
                <code className="break-all font-mono">{defaultWorkspace}</code>
              </Note>
            )}
            <Note>
              Changing the root restarts the daemon: in-flight runs end. The new
              root gets its own chat list and memory; the controller creates{" "}
              <code className="font-mono">.mecatl/skills</code> inside it and
              nothing else.
            </Note>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
      {PromptDialog}
      {ConfirmDialog}
    </SettingsCard>
  );
}
