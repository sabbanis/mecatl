import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatBytes } from "@/lib/formatters";
import type { HarnessPerfStatus } from "@/lib/harness/client";
import { perfMcpConfig } from "@/lib/prometheus-text";
import {
  ADMIN_RESTART_WARNING,
  EXTERNAL_PERF_NOTE,
  formatGcPause,
  GOROUTINE_RESTART_WARNING,
  LOOPBACK_LINK_NOTE,
  PERF_MCP_RESTART_WARNING,
  PerformanceCard,
} from "./performance-card";

/**
 * Settings → Diagnostics → "Performance": the web analogue of mecatui's
 * embedded-server `--perf` family. Pins that (1) the three knobs are the
 * controller's diagnostics document — admin listener, perf MCP (disabled
 * until the listener is on, and taken down with it), goroutine alarm — each
 * saved only after the restart confirm and never on cancel, (2) a live
 * listener renders its origin, the controller-reported paths as
 * `target=_blank rel=noreferrer` loopback links with the "only on the
 * daemon's host" note, and the `.mcp.json` snippet byte-identical to
 * mecated's own only while the perf MCP is mounted, (3) the snapshot relays
 * `/metrics` through the controller into the four tiles and a PLAIN-TEXT
 * raw view, with a controller refusal shown inline, and (4) external,
 * offline and loading states render notes, not a form.
 */

const {
  runtime,
  diagnostics,
  fetchHarnessPerfStatus,
  fetchHarnessPerfMetrics,
} = vi.hoisted(() => ({
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
    productMetrics: null,
    isLoading: false,
    busy: false,
    error: null as string | null,
    notice: null as string | null,
    reload: vi.fn(async () => null),
    save: vi.fn(async (_patch: unknown) => true),
  },
  fetchHarnessPerfStatus: vi.fn(),
  fetchHarnessPerfMetrics: vi.fn(),
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

vi.mock("@/features/agent/hooks/use-diagnostics-options", () => ({
  useDiagnosticsOptions: () => diagnostics,
}));

vi.mock("@/lib/harness/client", () => ({
  fetchHarnessPerfStatus,
  fetchHarnessPerfMetrics,
}));

const ADMIN_URL = "http://127.0.0.1:41234";
const ADMIN_PATHS = [
  "/metrics",
  "/debug/pprof",
  "/debug/vars",
  "/debug/flightrecorder",
];

const offStatus: HarnessPerfStatus = {
  enabled: false,
  adminUrl: "",
  paths: ADMIN_PATHS,
  perfMcp: false,
  goroutineWarnThreshold: 0,
  goroutineWarnIntervalSeconds: 30,
};

const onStatus: HarnessPerfStatus = {
  ...offStatus,
  enabled: true,
  adminUrl: ADMIN_URL,
};

const mcpStatus: HarnessPerfStatus = {
  ...onStatus,
  paths: [...ADMIN_PATHS, "/mcp"],
  perfMcp: true,
};

const metricsText = [
  "# TYPE go_goroutines gauge",
  "go_goroutines 143",
  "go_memstats_heap_alloc_bytes 18350080",
  "process_resident_memory_bytes 73400320",
  'go_gc_duration_seconds{quantile="0"} 0.00002',
  "go_gc_duration_seconds_sum 0.0421",
  'mecatl_prompt_preview{text="<b>not markup</b>"} 1',
  "",
].join("\n");

function setAdmin(admin: {
  enabled: boolean;
  perfMcp: boolean;
  goroutineWarnThreshold: number;
}) {
  diagnostics.options = {
    logLevel: "info",
    quiet: false,
    admin,
    productMetrics: { enabled: true, dryRun: false },
  };
}

const adminSwitch = () =>
  screen.getByRole("switch", { name: "Runtime admin surface" });
const perfMcpSwitch = () =>
  screen.getByRole("switch", { name: "Perf MCP server" });
const thresholdInput = () =>
  screen.getByRole("spinbutton", { name: "Goroutine-leak alarm" });

beforeEach(() => {
  runtime.connected = true;
  runtime.mode = "managed";
  setAdmin({ enabled: false, perfMcp: false, goroutineWarnThreshold: 0 });
  diagnostics.isLoading = false;
  diagnostics.busy = false;
  diagnostics.error = null;
  diagnostics.notice = null;
  diagnostics.save.mockReset();
  diagnostics.save.mockResolvedValue(true);
  fetchHarnessPerfStatus.mockReset();
  fetchHarnessPerfStatus.mockResolvedValue(offStatus);
  fetchHarnessPerfMetrics.mockReset();
  fetchHarnessPerfMetrics.mockResolvedValue(metricsText);
});

describe("PerformanceCard", () => {
  it("renders the three knobs off, with the perf MCP switch disabled until the listener is on", async () => {
    render(<PerformanceCard />);
    await waitFor(() =>
      expect(fetchHarnessPerfStatus).toHaveBeenCalledWith(
        expect.any(AbortSignal),
      ),
    );
    expect(adminSwitch()).not.toBeChecked();
    expect(perfMcpSwitch()).not.toBeChecked();
    expect(perfMcpSwitch()).toBeDisabled();
    expect(thresholdInput()).toHaveValue(0);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.queryByTestId("perf-admin-url")).toBeNull();
    expect(screen.queryByRole("button", { name: /snapshot/i })).toBeNull();
    // The default posture is spelled out: no admin port until asked.
    expect(
      screen.getByText(/opens no admin port until you turn it on here/),
    ).toBeInTheDocument();
  });

  it("opens the listener only after the restart confirm, keeping the perf MCP off, then re-reads the live status", async () => {
    const user = userEvent.setup();
    render(<PerformanceCard />);
    await waitFor(() => expect(fetchHarnessPerfStatus).toHaveBeenCalled());

    fireEvent.click(adminSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Open the runtime admin surface?");
    expect(dialog).toHaveTextContent(ADMIN_RESTART_WARNING);
    expect(diagnostics.save).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        admin: { enabled: true, perfMcp: false, goroutineWarnThreshold: 0 },
      }),
    );
    await waitFor(() =>
      expect(fetchHarnessPerfStatus).toHaveBeenCalledTimes(2),
    );
  });

  it("saves nothing when the restart confirm is cancelled", async () => {
    const user = userEvent.setup();
    render(<PerformanceCard />);
    await waitFor(() => expect(fetchHarnessPerfStatus).toHaveBeenCalled());

    fireEvent.click(adminSwitch());
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(diagnostics.save).not.toHaveBeenCalled();
  });

  it("renders a live listener's origin and its paths as loopback links, and mounts the perf MCP after its confirm", async () => {
    const user = userEvent.setup();
    setAdmin({ enabled: true, perfMcp: false, goroutineWarnThreshold: 0 });
    fetchHarnessPerfStatus.mockResolvedValue(onStatus);
    render(<PerformanceCard />);

    expect(await screen.findByTestId("perf-admin-url")).toHaveTextContent(
      ADMIN_URL,
    );
    const list = screen.getByRole("list", { name: "Admin listener paths" });
    const links = list.querySelectorAll("a");
    expect([...links].map((link) => link.getAttribute("href"))).toEqual(
      ADMIN_PATHS.map((path) => `${ADMIN_URL}${path}`),
    );
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }
    expect(screen.getByText(LOOPBACK_LINK_NOTE)).toBeInTheDocument();
    // No /mcp link and no snippet until the perf MCP is mounted.
    expect(list).not.toHaveTextContent("/mcp");
    expect(screen.queryByTestId("perf-mcp-config")).toBeNull();
    expect(screen.getByText(/Sampled every 30 s\./)).toBeInTheDocument();

    expect(adminSwitch()).toBeChecked();
    expect(perfMcpSwitch()).toBeEnabled();
    fireEvent.click(perfMcpSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Mount the perf MCP server?");
    expect(dialog).toHaveTextContent(PERF_MCP_RESTART_WARNING);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        admin: { enabled: true, perfMcp: true, goroutineWarnThreshold: 0 },
      }),
    );
  });

  it("shows the /mcp path and mecated's exact .mcp.json snippet while the perf MCP is mounted, and copies it", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    setAdmin({ enabled: true, perfMcp: true, goroutineWarnThreshold: 0 });
    fetchHarnessPerfStatus.mockResolvedValue(mcpStatus);
    render(<PerformanceCard />);

    const snippet = await screen.findByTestId("perf-mcp-config");
    expect(snippet).toHaveTextContent('"mecatl-perf"');
    expect(snippet.textContent).toBe(perfMcpConfig("127.0.0.1:41234"));
    expect(screen.getByRole("link", { name: "/mcp" })).toHaveAttribute(
      "href",
      `${ADMIN_URL}/mcp`,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy \.mcp\.json/ }));
    expect(writeText).toHaveBeenCalledWith(perfMcpConfig(ADMIN_URL));
  });

  it("closes the listener AND the perf MCP together (the controller refuses the mount without a listener)", async () => {
    const user = userEvent.setup();
    setAdmin({ enabled: true, perfMcp: true, goroutineWarnThreshold: 500 });
    fetchHarnessPerfStatus.mockResolvedValue(mcpStatus);
    render(<PerformanceCard />);
    await screen.findByTestId("perf-admin-url");

    fireEvent.click(adminSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Close the runtime admin surface?");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        admin: { enabled: false, perfMcp: false, goroutineWarnThreshold: 500 },
      }),
    );
  });

  it("takes a runtime snapshot through the controller's /metrics relay into the four tiles and a plain-text raw view", async () => {
    setAdmin({ enabled: true, perfMcp: false, goroutineWarnThreshold: 100 });
    fetchHarnessPerfStatus.mockResolvedValue(onStatus);
    const { container } = render(<PerformanceCard />);
    await screen.findByTestId("perf-admin-url");
    expect(fetchHarnessPerfMetrics).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Take snapshot/ }));
    const tiles = await screen.findByTestId("perf-snapshot");
    expect(fetchHarnessPerfMetrics).toHaveBeenCalledTimes(1);
    expect(tiles).toHaveTextContent("Goroutines");
    expect(tiles).toHaveTextContent((143).toLocaleString());
    expect(tiles).toHaveTextContent(formatBytes(18_350_080));
    expect(tiles).toHaveTextContent(formatBytes(73_400_320));
    expect(tiles).toHaveTextContent(formatGcPause(0.0421));
    expect(formatGcPause(0.0421)).toBe("0.042 s");
    // 143 goroutines against a 100 threshold: the alarm note is shown.
    expect(
      screen.getByText(/above the goroutine-leak alarm threshold/),
    ).toBeInTheDocument();

    // The raw exposition is text, never markup.
    const raw = screen.getByTestId("perf-metrics-raw");
    expect(raw).toHaveTextContent("<b>not markup</b>");
    expect(container.querySelector("pre b")).toBeNull();

    // The button turns into Refresh and re-relays on demand.
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() =>
      expect(fetchHarnessPerfMetrics).toHaveBeenCalledTimes(2),
    );
  });

  it("leaves a tile blank when its series is missing and shows the controller's refusal inline", async () => {
    setAdmin({ enabled: true, perfMcp: false, goroutineWarnThreshold: 0 });
    fetchHarnessPerfStatus.mockResolvedValue(onStatus);
    fetchHarnessPerfMetrics.mockResolvedValue("go_goroutines 9\n");
    render(<PerformanceCard />);
    await screen.findByTestId("perf-admin-url");

    fireEvent.click(screen.getByRole("button", { name: /Take snapshot/ }));
    const tiles = await screen.findByTestId("perf-snapshot");
    expect(tiles).toHaveTextContent("9");
    expect(screen.getAllByText("not reported")).toHaveLength(3);

    fetchHarnessPerfMetrics.mockRejectedValue(
      new Error("mecated's admin listener did not answer: fetch failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "mecated's admin listener did not answer: fetch failed",
    );
  });

  it("saves the goroutine-leak threshold on blur after the restart confirm, rejecting a bad value inline", async () => {
    const user = userEvent.setup();
    render(<PerformanceCard />);
    await waitFor(() => expect(fetchHarnessPerfStatus).toHaveBeenCalled());

    const input = thresholdInput();
    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.blur(input);
    expect(
      await screen.findByText(/Enter a whole number from 0 \(off\)/),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(diagnostics.save).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "10000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Warn above 10,000 goroutines?");
    expect(dialog).toHaveTextContent(GOROUTINE_RESTART_WARNING);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({
        admin: {
          enabled: false,
          perfMcp: false,
          goroutineWarnThreshold: 10000,
        },
      }),
    );
  });

  it("does not confirm or save an unchanged threshold, and restores the saved value on cancel", async () => {
    const user = userEvent.setup();
    setAdmin({ enabled: false, perfMcp: false, goroutineWarnThreshold: 250 });
    render(<PerformanceCard />);
    await waitFor(() => expect(fetchHarnessPerfStatus).toHaveBeenCalled());
    const input = thresholdInput();
    expect(input).toHaveValue(250);
    expect(screen.getByText("Warns above 250")).toBeInTheDocument();

    fireEvent.blur(input);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Turn the goroutine-leak alarm off?");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(input).toHaveValue(250));
    expect(diagnostics.save).not.toHaveBeenCalled();
  });

  it("explains a saved-on listener the running daemon was not started with", async () => {
    setAdmin({ enabled: true, perfMcp: false, goroutineWarnThreshold: 0 });
    fetchHarnessPerfStatus.mockResolvedValue(offStatus);
    render(<PerformanceCard />);
    expect(
      await screen.findByText(
        /saved on but the running daemon was not started with it/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("perf-admin-url")).toBeNull();
  });

  it("renders the external note and never reads the controller in external mode", () => {
    runtime.mode = "external";
    render(<PerformanceCard />);
    expect(screen.getByText(EXTERNAL_PERF_NOTE)).toBeInTheDocument();
    expect(fetchHarnessPerfStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders the offline note without a document, and the loading note while the document loads", () => {
    diagnostics.options = null;
    runtime.connected = false;
    render(<PerformanceCard />);
    expect(screen.getByText(/The runtime is offline/)).toBeInTheDocument();
    expect(fetchHarnessPerfStatus).not.toHaveBeenCalled();
  });

  it("shows the reading note while the options load and the hook's error afterwards", async () => {
    diagnostics.options = null;
    diagnostics.isLoading = true;
    const { rerender } = render(<PerformanceCard />);
    expect(
      screen.getByText("Reading the diagnostics options…"),
    ).toBeInTheDocument();

    diagnostics.isLoading = false;
    diagnostics.error = "mecated refused --metrics-addr (previous restored)";
    rerender(<PerformanceCard />);
    expect(
      await screen.findByText(
        "mecated refused --metrics-addr (previous restored)",
      ),
    ).toBeInTheDocument();
  });
});
