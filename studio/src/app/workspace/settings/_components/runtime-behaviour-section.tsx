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
import { Switch } from "@/components/ui/switch";
import { useRuntimeSettings } from "@/features/agent/hooks/use-runtime-settings";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

/** The Mid-run steering row's description: what the switch does, plus the
 *  daemon's LIVE word on it (`capabilities.steer`) when it reports one. */
export function steerRowDescription(liveSteer: unknown): string {
  const base =
    "On, a message sent while the agent is replying can be steered into the run at its next step. Off respawns the daemon with --no-steer, so every client's mid-run messages queue for the next turn.";
  if (typeof liveSteer !== "boolean") return base;
  return `${base} The daemon currently reports steering ${liveSteer ? "on" : "off"}.`;
}

/**
 * Settings → Agent: the managed DAEMON's runtime behaviour — the operator
 * half of the TUI's steer opt-out (`mecated --no-steer` / `steer: false`).
 * Off, the controller respawns mecated with `--no-steer`, the daemon reports
 * `capabilities.steer: false`, and EVERY client's mid-run messages queue
 * instead of steering. Distinct from the browser-local "Queue only" Enter
 * preference on Settings → Personalize, which silences steering for this
 * browser alone.
 *
 * Managed mode only: external mode renders the managed note (the deployment
 * owns its flags — the controller answers 409); offline renders the offline
 * note. A `steer: false` in the operator's own settings.yaml already keeps
 * steering off whatever Studio passes (`--no-steer` can only tighten), so
 * the row then reads Off with no switch and says why. Every flip RESTARTS
 * the daemon — in-flight runs end — so the switch confirms first.
 */
export function RuntimeBehaviourSection() {
  const { live, manageable, doc, isLoading, busy, error, notice, save } =
    useRuntimeSettings();
  const { serverCapabilities } = useRuntimeStatus();
  // The flip awaiting confirmation (the value the switch would take).
  const [pending, setPending] = useState<boolean | null>(null);

  const inheritedOff = doc?.inherited.steer === false;
  const enabled = doc?.config.steer.enabled ?? true;

  let body: React.ReactNode;
  if (!live) {
    body = <OfflineNote />;
  } else if (!manageable) {
    body = <ExternalManagedNote />;
  } else if (!doc) {
    body = (
      <Note>
        {isLoading
          ? "Reading the daemon's runtime settings…"
          : (error ??
            "The daemon's runtime settings could not be read right now.")}
      </Note>
    );
  } else {
    body = (
      <>
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Mid-run steering"
            htmlFor={inheritedOff ? undefined : "daemon-steer"}
            description={steerRowDescription(serverCapabilities.steer)}
          >
            {inheritedOff ? (
              <span className="text-sm text-muted-foreground">Off</span>
            ) : (
              <Switch
                id="daemon-steer"
                checked={enabled}
                disabled={busy !== ""}
                onCheckedChange={(next) => setPending(next)}
                aria-label="Mid-run steering"
              />
            )}
          </SettingsRow>
        </div>
        {inheritedOff ? (
          <div className="mt-3">
            <Note>
              The operator&rsquo;s settings.yaml sets <code>steer: false</code>,
              which keeps steering off whatever Studio passes (
              <code>--no-steer</code> can only tighten). Change that file to
              hand control back to this switch.
            </Note>
          </div>
        ) : null}
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
        <AlertDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
        >
          {pending !== null && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending
                    ? "Turn mid-run steering on?"
                    : "Turn mid-run steering off?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The daemon restarts with the new setting: in-flight runs end
                  and their session ids die with them.{" "}
                  {pending
                    ? "Clients can steer a running agent again."
                    : "Every client's mid-run messages will queue for the next turn until steering is turned back on."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void save({ steer: { enabled: pending } });
                    setPending(null);
                  }}
                >
                  {pending ? "Restart and turn on" : "Restart and turn off"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      </>
    );
  }

  return (
    <SettingsCard
      title="Daemon behaviour"
      description="How the managed daemon runs, for every client. Changes restart it."
    >
      {body}
    </SettingsCard>
  );
}
