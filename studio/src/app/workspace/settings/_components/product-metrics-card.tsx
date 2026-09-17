"use client";

import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDiagnosticsOptions } from "@/features/agent/hooks/use-diagnostics-options";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { useConfirm } from "@/hooks/use-confirm";
import { Note, OfflineNote, SettingsCard, SettingsRow } from "./settings-card";

const TITLE = "Product metrics";

/** The anchor the dry-run row points at: the Diagnostics page wraps its
 *  Daemon log card in an element with this id, because the dry run prints
 *  its observations to mecated's stderr, which that card shows. */
export const DAEMON_LOG_ANCHOR_ID = "daemon-log";

/** Quotes mecated's own `--product-metrics` flag help for what is (and is
 *  never) reported, so the card and the CLI say the same thing. */
const PRODUCT_METRICS_DESCRIPTION =
  "mecated reports anonymous product-adoption metrics to Stacklok: version, OS/arch, enabled features and coarse session/run/tool-call counts — never a prompt, file path, tool name, or model id. On by default; turning them off here starts the managed daemon with --product-metrics=false.";

export const PRODUCT_METRICS_RESTART_WARNING =
  "Product metrics are a mecated flag (--product-metrics), so the daemon restarts: in-flight runs end and session ids die with it.";

export const DRY_RUN_RESTART_WARNING =
  "The dry run is a mecated flag (--product-metrics-dry-run), so the daemon restarts: in-flight runs end and session ids die with it.";

/** Studio's saved switch is on and the controller's environment does not
 *  opt out — the strongest claim Studio can make, because the third
 *  opt-out (settings.yaml) is a file it never reads. */
export const NOT_DISABLED_NOTE =
  "Not disabled by Studio or by the controller's environment. mecated reports them unless ~/.config/mecatl/settings.yaml opts out (see below).";

export const STUDIO_DISABLED_NOTE =
  "Disabled by Studio: the managed daemon starts with --product-metrics=false.";

/** The controller's own process environment opts mecated out, and the
 *  controller deliberately never passes --product-metrics=true over it. */
export const ENVIRONMENT_OPT_OUT_NOTE =
  "Disabled by the controller's environment: DO_NOT_TRACK or MECATL_PRODUCT_METRICS=false is set where Studio runs, and mecated inherits it. This switch cannot turn metrics back on from here — unset the variable and restart Studio (task studio:dev).";

const DRY_RUN_DESCRIPTION =
  "Print every would-be observation to the daemon log instead of sending it — verify the no-PII claim yourself. mecated prints only while metrics are not disabled, so turn this on first, then the switch above.";

/** The third opt-out, named because Studio cannot read it. */
export const SETTINGS_YAML_NOTE =
  "mecated also honours telemetry.productMetrics.enabled: false in ~/.config/mecatl/settings.yaml (the operator-tier file). Studio does not read that file, so an opt-out there is not reflected in this card.";

/** The external-mode note: the deployment spawned its own mecated, so its
 *  product-metrics flag is the deployment's, and Studio cannot read it. */
export const EXTERNAL_PRODUCT_METRICS_NOTE =
  "Whether the deployment's mecated reports anonymous product metrics is the deployment's own setting; Studio cannot read it. Opt out on the deployment with --product-metrics=false, MECATL_PRODUCT_METRICS=false or DO_NOT_TRACK=1, or with telemetry.productMetrics.enabled: false in its settings.yaml.";

/**
 * Settings → Diagnostics → "Product metrics": the web analogue of the
 * `--product-metrics` / `--product-metrics-dry-run` flags and their
 * environment opt-outs. Managed mode shows the effective verdict the
 * controller derives (its saved switch AND no opt-out in its own
 * environment, which the spawned mecated inherits), lets the person turn
 * the metrics off or on (restart-confirmed: both are spawn flags) and arm
 * the dry run that prints observations to the daemon log instead of
 * sending them. An environment opt-out wins and is explained rather than
 * fought: the controller never passes `--product-metrics=true`, because
 * the explicit flag would out-rank the operator's DO_NOT_TRACK. The
 * settings.yaml opt-out is named as the one source Studio cannot see, so
 * the "on" state is labelled as what it is — not disabled here — rather
 * than a definitive On. External mode owns its daemon's flags.
 */
export function ProductMetricsCard() {
  const { connected, mode } = useRuntimeStatus();
  const diagnostics = useDiagnosticsOptions();
  const { confirm, ConfirmDialog } = useConfirm();
  const enabledId = useId();
  const dryRunId = useId();

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
          <Note>Reading the diagnostics options…</Note>
        ) : !connected ? (
          <OfflineNote />
        ) : (
          <Note>
            {diagnostics.error ??
              "The controller did not report diagnostics options. Restart Studio (task studio:dev) so the current controller is running."}
          </Note>
        )}
      </SettingsCard>
    );
  }

  const saved = options.productMetrics;
  const source = diagnostics.productMetrics?.source ?? "studio";
  const environmentOptOut = source === "environment";
  // The effective verdict as the controller reports it; the saved switch
  // alone when an older controller sent no verdict.
  const effective = environmentOptOut
    ? false
    : (diagnostics.productMetrics?.effective ?? saved.enabled);

  const stateLabel = effective ? "Not disabled" : "Off";
  const stateDescription = environmentOptOut
    ? ENVIRONMENT_OPT_OUT_NOTE
    : effective
      ? NOT_DISABLED_NOTE
      : STUDIO_DISABLED_NOTE;

  const toggleEnabled = async (checked: boolean) => {
    if (environmentOptOut || checked === saved.enabled) return;
    const confirmed = await confirm({
      title: checked
        ? "Turn anonymous product metrics on?"
        : "Turn anonymous product metrics off?",
      description: PRODUCT_METRICS_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    await diagnostics.save({
      productMetrics: { ...saved, enabled: checked },
    });
  };

  const toggleDryRun = async (checked: boolean) => {
    if (environmentOptOut || checked === saved.dryRun) return;
    const confirmed = await confirm({
      title: checked
        ? "Print observations to the daemon log instead of sending them?"
        : "Stop the product-metrics dry run?",
      description: DRY_RUN_RESTART_WARNING,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    await diagnostics.save({
      productMetrics: { ...saved, dryRun: checked },
    });
  };

  return (
    <SettingsCard title={TITLE} description={PRODUCT_METRICS_DESCRIPTION}>
      <div className="flex flex-col gap-4">
        {diagnostics.error && (
          <p className="whitespace-pre-wrap text-sm text-destructive">
            {diagnostics.error}
          </p>
        )}
        {diagnostics.notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {diagnostics.notice}
          </p>
        )}

        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Anonymous product metrics"
            htmlFor={enabledId}
            description={stateDescription}
          >
            <Badge
              variant={effective ? "info" : "muted"}
              data-testid="product-metrics-state"
              data-source={source}
            >
              {stateLabel}
            </Badge>
            <Switch
              id={enabledId}
              checked={environmentOptOut ? false : saved.enabled}
              disabled={diagnostics.busy || environmentOptOut}
              onCheckedChange={(checked) => void toggleEnabled(checked)}
            />
          </SettingsRow>
          <SettingsRow
            label="Dry run"
            htmlFor={dryRunId}
            description={
              <>
                {DRY_RUN_DESCRIPTION} The observations land in the{" "}
                <a
                  href={`#${DAEMON_LOG_ANCHOR_ID}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  data-testid="product-metrics-log-link"
                >
                  Daemon log
                </a>{" "}
                below.
              </>
            }
          >
            <Switch
              id={dryRunId}
              checked={saved.dryRun}
              disabled={diagnostics.busy || environmentOptOut}
              onCheckedChange={(checked) => void toggleDryRun(checked)}
            />
          </SettingsRow>
        </div>

        <Note>{SETTINGS_YAML_NOTE}</Note>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}
