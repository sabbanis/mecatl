"use client";

import { Switch } from "@/components/ui/switch";
import { useRuntimeSettings } from "@/features/agent/hooks/use-runtime-settings";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  ApplyingNote,
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

/** The row's visible label; the switch's aria-label repeats it. */
const STEER_LABEL = "Take messages while working";

/**
 * The row's description in plain words, plus ONE line when the daemon's
 * LIVE word on it (`capabilities.steer`) differs from the saved switch —
 * a restart still in flight, or an operator `steer: false` keeping it off.
 * Silent when the daemon reports nothing or agrees.
 */
export function steerRowDescription(
  liveSteer: unknown,
  enabled: boolean,
): string {
  const base = "Let the agent take your messages while it is still working.";
  if (typeof liveSteer !== "boolean" || liveSteer === enabled) return base;
  return `${base} Right now this is ${liveSteer ? "on" : "off"}.`;
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
 * the row then reads Off with no switch and says why. A flip saves AT ONCE
 * and restarts the daemon in the background — in-flight runs end — with the
 * switch disabled behind an "Applying…" line until the re-read lands and a
 * refusal shown inline. The copy is written for people who are not
 * developers: "the agent", never the daemon or its flags.
 */
export function RuntimeBehaviourSection() {
  const { live, manageable, doc, isLoading, busy, error, save } =
    useRuntimeSettings();
  const { serverCapabilities } = useRuntimeStatus();

  const inheritedOff = doc?.inherited.steer === false;
  const enabled = doc?.config.steer.enabled ?? true;
  const saving = busy !== "";

  let body: React.ReactNode;
  if (!live) {
    body = <OfflineNote />;
  } else if (!manageable) {
    body = <ExternalManagedNote />;
  } else if (!doc) {
    body = (
      <Note>
        {isLoading
          ? "Reading the agent’s settings…"
          : (error ?? "These settings could not be read right now.")}
      </Note>
    );
  } else {
    body = (
      <>
        <div className="divide-y divide-border/60">
          <SettingsRow
            label={STEER_LABEL}
            htmlFor={inheritedOff ? undefined : "daemon-steer"}
            description={steerRowDescription(serverCapabilities.steer, enabled)}
          >
            {inheritedOff ? (
              <span className="text-sm text-muted-foreground">Off</span>
            ) : (
              <Switch
                id="daemon-steer"
                checked={enabled}
                disabled={saving}
                onCheckedChange={(next) =>
                  void save({ steer: { enabled: next } })
                }
                aria-label={STEER_LABEL}
              />
            )}
          </SettingsRow>
        </div>
        {inheritedOff ? (
          <div className="mt-3">
            <Note>
              This was turned off where the agent runs, so it can&rsquo;t be
              changed here.
            </Note>
          </div>
        ) : null}
        {saving ? <ApplyingNote className="mt-3" /> : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return <SettingsCard title="Agent behaviour">{body}</SettingsCard>;
}
