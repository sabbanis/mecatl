import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAEMON_LOG_ANCHOR_ID,
  DRY_RUN_RESTART_WARNING,
  ENVIRONMENT_OPT_OUT_NOTE,
  EXTERNAL_PRODUCT_METRICS_NOTE,
  NOT_DISABLED_NOTE,
  PRODUCT_METRICS_RESTART_WARNING,
  ProductMetricsCard,
  SETTINGS_YAML_NOTE,
  STUDIO_DISABLED_NOTE,
} from "./product-metrics-card";

/**
 * Settings → Diagnostics → "Product metrics": the web analogue of
 * `--product-metrics` / `--product-metrics-dry-run` and their opt-outs.
 * Pins that (1) the status badge reads the controller's EFFECTIVE verdict
 * — "Not disabled" (never a definitive On: settings.yaml is a third
 * opt-out Studio cannot read, and the card says so) or "Off" — with the
 * source spelled out, (2) an environment opt-out (DO_NOT_TRACK /
 * MECATL_PRODUCT_METRICS) disables both switches and explains why rather
 * than offering a switch the controller would never honour, (3) each
 * switch saves ONLY after the restart confirm and never on cancel, as a
 * partial `productMetrics` patch that keeps the other field, (4) the dry
 * run points at the Daemon log anchor, and (5) external, offline and
 * loading states render notes, not a form.
 */

const { runtime, diagnostics } = vi.hoisted(() => ({
  runtime: {
    connected: true,
    mode: "managed" as "managed" | "external",
  },
  diagnostics: {
    live: true,
    manageable: true,
    options: null as {
      logLevel: string;
      quiet: boolean;
      admin: {
        enabled: boolean;
        perfMcp: boolean;
        goroutineWarnThreshold: number;
      };
      productMetrics: { enabled: boolean; dryRun: boolean };
    } | null,
    productMetrics: null as {
      effective: boolean;
      source: "studio" | "environment";
    } | null,
    isLoading: false,
    busy: false,
    error: null as string | null,
    notice: null as string | null,
    reload: vi.fn(async () => null),
    save: vi.fn(async (_patch: unknown) => true),
  },
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

vi.mock("@/features/agent/hooks/use-diagnostics-options", () => ({
  useDiagnosticsOptions: () => diagnostics,
}));

function setProductMetrics(
  saved: { enabled: boolean; dryRun: boolean },
  verdict: { effective: boolean; source: "studio" | "environment" },
) {
  diagnostics.options = {
    logLevel: "info",
    quiet: false,
    admin: { enabled: false, perfMcp: false, goroutineWarnThreshold: 0 },
    productMetrics: saved,
  };
  diagnostics.productMetrics = verdict;
}

const metricsSwitch = () =>
  screen.getByRole("switch", { name: "Anonymous product metrics" });
const dryRunSwitch = () => screen.getByRole("switch", { name: "Dry run" });
const state = () => screen.getByTestId("product-metrics-state");

beforeEach(() => {
  runtime.connected = true;
  runtime.mode = "managed";
  setProductMetrics(
    { enabled: true, dryRun: false },
    { effective: true, source: "studio" },
  );
  diagnostics.isLoading = false;
  diagnostics.busy = false;
  diagnostics.error = null;
  diagnostics.notice = null;
  diagnostics.save.mockReset();
  diagnostics.save.mockResolvedValue(true);
});

describe("ProductMetricsCard", () => {
  it("labels the default state 'Not disabled' (never On), names the settings.yaml opt-out and quotes the no-PII claim", () => {
    render(<ProductMetricsCard />);
    expect(state()).toHaveTextContent("Not disabled");
    expect(state()).toHaveAttribute("data-source", "studio");
    expect(screen.queryByText("On")).toBeNull();
    expect(metricsSwitch()).toBeChecked();
    expect(metricsSwitch()).toBeEnabled();
    expect(dryRunSwitch()).not.toBeChecked();
    expect(dryRunSwitch()).toBeEnabled();
    expect(screen.getByText(NOT_DISABLED_NOTE)).toBeInTheDocument();
    expect(screen.getByText(SETTINGS_YAML_NOTE)).toBeInTheDocument();
    expect(
      screen.getByText(/never a prompt, file path, tool name, or model id/),
    ).toBeInTheDocument();
  });

  it("turns the metrics off only after the restart confirm, as a partial patch that keeps the dry-run field", async () => {
    const user = userEvent.setup();
    render(<ProductMetricsCard />);

    fireEvent.click(metricsSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Turn anonymous product metrics off?");
    expect(dialog).toHaveTextContent(PRODUCT_METRICS_RESTART_WARNING);
    expect(diagnostics.save).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        productMetrics: { enabled: false, dryRun: false },
      }),
    );
  });

  it("saves nothing when the restart confirm is cancelled", async () => {
    const user = userEvent.setup();
    render(<ProductMetricsCard />);

    fireEvent.click(metricsSwitch());
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(diagnostics.save).not.toHaveBeenCalled();
  });

  it("reads Off when Studio saved the opt-out, with the switch still usable to turn them back on", async () => {
    const user = userEvent.setup();
    setProductMetrics(
      { enabled: false, dryRun: false },
      { effective: false, source: "studio" },
    );
    render(<ProductMetricsCard />);

    expect(state()).toHaveTextContent("Off");
    expect(state()).toHaveAttribute("data-source", "studio");
    expect(screen.getByText(STUDIO_DISABLED_NOTE)).toBeInTheDocument();
    expect(metricsSwitch()).not.toBeChecked();
    expect(metricsSwitch()).toBeEnabled();

    fireEvent.click(metricsSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Turn anonymous product metrics on?");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        productMetrics: { enabled: true, dryRun: false },
      }),
    );
  });

  it("explains an environment opt-out and disables both switches, whatever Studio saved", () => {
    setProductMetrics(
      { enabled: true, dryRun: true },
      { effective: false, source: "environment" },
    );
    render(<ProductMetricsCard />);

    expect(state()).toHaveTextContent("Off");
    expect(state()).toHaveAttribute("data-source", "environment");
    expect(screen.getByText(ENVIRONMENT_OPT_OUT_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/DO_NOT_TRACK/)).toBeInTheDocument();
    // The saved switch is on, but the card shows what mecated actually
    // does: nothing Studio passes can out-rank the operator's variable.
    expect(metricsSwitch()).not.toBeChecked();
    expect(metricsSwitch()).toBeDisabled();
    expect(dryRunSwitch()).toBeDisabled();
    fireEvent.click(metricsSwitch());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(diagnostics.save).not.toHaveBeenCalled();
  });

  it("arms the dry run after its own confirm, keeping the enabled field, and links to the Daemon log anchor", async () => {
    const user = userEvent.setup();
    render(<ProductMetricsCard />);

    expect(screen.getByTestId("product-metrics-log-link")).toHaveAttribute(
      "href",
      `#${DAEMON_LOG_ANCHOR_ID}`,
    );
    expect(
      screen.getByText(/verify the no-PII claim yourself/),
    ).toBeInTheDocument();

    fireEvent.click(dryRunSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Print observations to the daemon log instead of sending them?",
    );
    expect(dialog).toHaveTextContent(DRY_RUN_RESTART_WARNING);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        productMetrics: { enabled: true, dryRun: true },
      }),
    );
  });

  it("disables the switches while a save is in flight and shows the hook's error and notice", () => {
    diagnostics.busy = true;
    diagnostics.error = "mecated refused to start: bad flag";
    diagnostics.notice =
      "Diagnostics options saved. The daemon restarted with them.";
    render(<ProductMetricsCard />);
    expect(metricsSwitch()).toBeDisabled();
    expect(dryRunSwitch()).toBeDisabled();
    expect(
      screen.getByText("mecated refused to start: bad flag"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The daemon restarted with them.",
    );
  });

  it("renders the deployment note in external mode, with the opt-out flags and no switches", () => {
    runtime.mode = "external";
    render(<ProductMetricsCard />);
    expect(screen.getByText(EXTERNAL_PRODUCT_METRICS_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/--product-metrics=false/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByTestId("product-metrics-state")).toBeNull();
  });

  it("renders the loading, offline and missing-controller notes instead of a form", () => {
    diagnostics.options = null;
    diagnostics.productMetrics = null;

    diagnostics.isLoading = true;
    const { unmount } = render(<ProductMetricsCard />);
    expect(
      screen.getByText("Reading the diagnostics options…"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    unmount();

    diagnostics.isLoading = false;
    runtime.connected = false;
    const offline = render(<ProductMetricsCard />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    offline.unmount();

    runtime.connected = true;
    render(<ProductMetricsCard />);
    expect(
      screen.getByText(/did not report diagnostics options/),
    ).toBeInTheDocument();
  });
});
