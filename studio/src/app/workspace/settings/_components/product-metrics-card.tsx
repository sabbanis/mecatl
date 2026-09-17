"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { useDiagnosticsOptions } from "@/features/agent/hooks/use-diagnostics-options";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  ApplyingNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

const TITLE = "Usage statistics";

/** What is shared, in plain words: counts, never content. */
export const SHARED_NOTE =
  "Only counts of which features are used — never your chats, files or names.";

/** The computer the agent runs on opts out, so the switch cannot turn the
 *  statistics back on from here. */
export const ENVIRONMENT_OPT_OUT_NOTE =
  "Turned off on this computer, so it can't be changed here.";

/** Shown when the agent runs elsewhere: its setting lives there. */
export const EXTERNAL_PRODUCT_METRICS_NOTE =
  "Usage statistics are set where the agent runs and can't be changed here.";

/** Shown when the controller answered but had no setting to report. */
export const OPTIONS_UNAVAILABLE_NOTE =
  "This setting is not available right now. Restart Studio and try again.";

/**
 * The anonymous usage-statistics switch. Managed mode shows the effective
 * verdict the controller derives (its saved switch AND no opt-out in the
 * environment the agent inherits) and lets the person turn the statistics
 * off or on. A flip saves AT ONCE and the agent restarts in the background:
 * the switch is disabled behind an "Applying…" line until the re-read shows
 * the new state, and a refusal shows inline. An environment opt-out wins
 * and is explained rather than fought. When the agent runs elsewhere the
 * setting lives there.
 */
export function ProductMetricsCard() {
  const { connected, mode } = useRuntimeStatus();
  const diagnostics = useDiagnosticsOptions();
  const enabledId = useId();

  if (mode === "external") {
    return (
      <SettingsCard title={TITLE}>
        <Note>{EXTERNAL_PRODUCT_METRICS_NOTE}</Note>
      </SettingsCard>
    );
  }

  const options = diagnostics.options;
  if (!options) {
    return (
      <SettingsCard title={TITLE}>
        {diagnostics.isLoading ? (
          <Note>Loading…</Note>
        ) : !connected ? (
          <OfflineNote />
        ) : (
          <Note>{diagnostics.error ?? OPTIONS_UNAVAILABLE_NOTE}</Note>
        )}
      </SettingsCard>
    );
  }

  const saved = options.productMetrics;
  const environmentOptOut =
    diagnostics.productMetrics?.source === "environment";
  const checked = environmentOptOut ? false : saved.enabled;

  const toggleEnabled = (next: boolean) => {
    if (environmentOptOut || next === saved.enabled) return;
    void diagnostics.save({
      productMetrics: { ...saved, enabled: next },
    });
  };

  return (
    <SettingsCard title={TITLE}>
      <div className="flex flex-col gap-3">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Share anonymous usage statistics"
            htmlFor={enabledId}
            description={
              environmentOptOut ? ENVIRONMENT_OPT_OUT_NOTE : SHARED_NOTE
            }
          >
            <Switch
              id={enabledId}
              checked={checked}
              disabled={diagnostics.busy || environmentOptOut}
              onCheckedChange={toggleEnabled}
            />
          </SettingsRow>
        </div>
        {diagnostics.busy && <ApplyingNote />}
        {diagnostics.error && (
          <p
            role="alert"
            className="whitespace-pre-wrap text-sm text-destructive"
          >
            {diagnostics.error}
          </p>
        )}
      </div>
    </SettingsCard>
  );
}
