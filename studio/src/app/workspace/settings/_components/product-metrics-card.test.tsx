import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENVIRONMENT_OPT_OUT_NOTE,
  EXTERNAL_PRODUCT_METRICS_NOTE,
  OPTIONS_UNAVAILABLE_NOTE,
  ProductMetricsCard,
  SHARED_NOTE,
} from "./product-metrics-card";

/**
 * Settings → Diagnostics → "Usage statistics": the anonymous-metrics
 * opt-out switch. Pins that (1) the switch mirrors the saved setting and
 * the row says in plain words what is shared, (2) an environment opt-out
 * disables the switch and explains why rather than offering a switch the
 * controller would never honour, (3) a flip saves AT ONCE — no confirm —
 * as a partial `productMetrics` patch that keeps the other field, (4) while
 * the save is in flight the switch is disabled behind an "Applying…" line
 * and a refusal shows inline, and (5) external, offline and loading states
 * render notes, not a form.
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
  screen.getByRole("switch", { name: "Share anonymous usage statistics" });

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
  it("shows the switch on by default, says what is shared, and offers no dry run", () => {
    render(<ProductMetricsCard />);
    expect(metricsSwitch()).toBeChecked();
    expect(metricsSwitch()).toBeEnabled();
    expect(screen.getByText(SHARED_NOTE)).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.queryByText(/Dry run/)).toBeNull();
    expect(screen.queryByText(/daemon|mecated|--product-metrics/i)).toBeNull();
    // A flip applies on its own: no Save or confirm anywhere.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("turns the statistics off at once, as a partial patch that keeps the other field", () => {
    render(<ProductMetricsCard />);
    fireEvent.click(metricsSwitch());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(diagnostics.save).toHaveBeenCalledTimes(1);
    expect(diagnostics.save).toHaveBeenCalledWith({
      productMetrics: { enabled: false, dryRun: false },
    });
  });

  it("shows the switch off when Studio saved the opt-out, and turns it back on at once", () => {
    setProductMetrics(
      { enabled: false, dryRun: true },
      { effective: false, source: "studio" },
    );
    render(<ProductMetricsCard />);

    expect(metricsSwitch()).not.toBeChecked();
    expect(metricsSwitch()).toBeEnabled();

    fireEvent.click(metricsSwitch());
    expect(diagnostics.save).toHaveBeenCalledWith({
      productMetrics: { enabled: true, dryRun: true },
    });
  });

  it("explains an environment opt-out and disables the switch, whatever Studio saved", () => {
    setProductMetrics(
      { enabled: true, dryRun: false },
      { effective: false, source: "environment" },
    );
    render(<ProductMetricsCard />);

    expect(screen.getByText(ENVIRONMENT_OPT_OUT_NOTE)).toBeInTheDocument();
    // The saved switch is on, but the card shows what the agent actually
    // does: nothing Studio passes can out-rank the computer's opt-out.
    expect(metricsSwitch()).not.toBeChecked();
    expect(metricsSwitch()).toBeDisabled();
    fireEvent.click(metricsSwitch());
    expect(diagnostics.save).not.toHaveBeenCalled();
  });

  it("disables the switch behind an Applying line while a save is in flight, and shows a refusal inline", () => {
    diagnostics.busy = true;
    diagnostics.error = "mecated refused to start: bad flag";
    render(<ProductMetricsCard />);
    expect(metricsSwitch()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Applying…");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "mecated refused to start: bad flag",
    );
  });

  it("renders the external note with no switch when the agent runs elsewhere", () => {
    runtime.mode = "external";
    render(<ProductMetricsCard />);
    expect(screen.getByText(EXTERNAL_PRODUCT_METRICS_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders the loading, offline and unavailable notes instead of a form", () => {
    diagnostics.options = null;
    diagnostics.productMetrics = null;

    diagnostics.isLoading = true;
    const { unmount } = render(<ProductMetricsCard />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    unmount();

    diagnostics.isLoading = false;
    runtime.connected = false;
    const offline = render(<ProductMetricsCard />);
    expect(
      screen.getByText(/The agent is offline, so these settings/),
    ).toBeInTheDocument();
    offline.unmount();

    runtime.connected = true;
    render(<ProductMetricsCard />);
    expect(screen.getByText(OPTIONS_UNAVAILABLE_NOTE)).toBeInTheDocument();
  });
});
