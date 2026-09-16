import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatBytes } from "@/lib/formatters";
import type { HarnessDaemonLog } from "@/lib/harness/client";
import {
  DAEMON_LOG_FOLLOW_INTERVAL_MS,
  DaemonLogCard,
  EXTERNAL_LOG_NOTE,
  LOG_LEVEL_OPTIONS,
  LOG_LEVEL_RESTART_WARNING,
} from "./daemon-log-card";

/**
 * Settings → Diagnostics → "Daemon log": the web analogue of mecatui's
 * embedded-server log file and `--quiet`. Pins that (1) managed mode shows
 * the controller-owned file's path and size, a same-origin Download link,
 * and the tail as PLAIN TEXT (log content is model-influenced), (2) a
 * start mecated refused is reported above the tail even while the daemon
 * is unreachable (the controller still answers), (3) muting the terminal
 * echo saves `{quiet}` immediately with no restart confirm while the log
 * level saves `{logLevel}` only after the restart confirm, (4) Refresh,
 * Copy and Follow re-read/copy the tail, and (5) external, offline,
 * older-controller and empty states render notes, not a viewer.
 */

const { runtime, diagnostics, fetchHarnessDaemonLog } = vi.hoisted(() => ({
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
  fetchHarnessDaemonLog: vi.fn(),
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

vi.mock("@/features/agent/hooks/use-diagnostics-options", () => ({
  useDiagnosticsOptions: () => diagnostics,
}));

vi.mock("@/lib/harness/client", () => ({
  fetchHarnessDaemonLog,
  DAEMON_LOG_DEFAULT_LINES: 200,
  DAEMON_LOG_DOWNLOAD_URL: "/api/mecatl-control/logs/download",
}));

const sampleLog: HarnessDaemonLog = {
  path: "/repo/studio/.scratch/mecated.log",
  rotatedPath: "/repo/studio/.scratch/mecated.log.1",
  sizeBytes: 4_096,
  maxBytes: 10 * 1024 * 1024,
  lines: [
    "time=1 level=INFO msg=ready",
    'time=2 level=WARN msg="provider retry" <b>not markup</b>',
  ],
  truncated: true,
  quiet: false,
  level: "info",
  running: true,
  startupError: "",
};

beforeEach(() => {
  runtime.connected = true;
  runtime.mode = "managed";
  diagnostics.options = {
    logLevel: "info",
    quiet: false,
    admin: { enabled: false, perfMcp: false, goroutineWarnThreshold: 0 },
    productMetrics: { enabled: true, dryRun: false },
  };
  diagnostics.busy = false;
  diagnostics.error = null;
  diagnostics.notice = null;
  diagnostics.save.mockReset();
  diagnostics.save.mockResolvedValue(true);
  fetchHarnessDaemonLog.mockReset();
  fetchHarnessDaemonLog.mockResolvedValue(sampleLog);
});

describe("DaemonLogCard", () => {
  it("renders the file path, size, a same-origin download link and the tail as plain text", async () => {
    const { container } = render(<DaemonLogCard />);
    const tail = await screen.findByTestId("daemon-log-tail");

    expect(fetchHarnessDaemonLog).toHaveBeenCalledWith(
      200,
      expect.any(AbortSignal),
    );
    const path = screen.getByTestId("daemon-log-path");
    expect(path).toHaveTextContent("/repo/studio/.scratch/mecated.log");
    // The size and the rotation bound sit in the same description line.
    expect(path.parentElement).toHaveTextContent(
      `${formatBytes(4_096)} · rotates at ${formatBytes(10 * 1024 * 1024)}`,
    );
    // Model-influenced content renders as text: the literal tag is visible
    // and no element was created from it.
    expect(tail).toHaveTextContent("<b>not markup</b>");
    expect(container.querySelector("pre b")).toBeNull();
    expect(tail).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByText(/Last 2 lines — older output is in the file\./),
    ).toBeInTheDocument();

    const download = screen.getByTestId("daemon-log-download");
    expect(download).toHaveAttribute(
      "href",
      "/api/mecatl-control/logs/download",
    );
    expect(download).toHaveAttribute("download", "mecated.log");

    expect(screen.getByRole("button", { name: "Log level" })).toHaveTextContent(
      "Info (default)",
    );
    expect(
      screen.getByRole("switch", { name: "Mute terminal echo" }),
    ).not.toBeChecked();
    expect(LOG_LEVEL_OPTIONS.map((option) => option.value)).toEqual([
      "debug",
      "info",
      "warn",
      "error",
    ]);
  });

  it("reports a start mecated refused above the tail even while the daemon is unreachable", async () => {
    runtime.connected = false;
    fetchHarnessDaemonLog.mockResolvedValue({
      ...sampleLog,
      running: false,
      startupError:
        "OpenRouter could not start. Add providers.openrouter.api_key to auth.yaml, then switch to it again.",
    });
    render(<DaemonLogCard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      /mecated could not start: OpenRouter could not start/,
    );
    expect(screen.getByTestId("daemon-log-tail")).toBeInTheDocument();
    expect(screen.getByText(/The daemon is not running\./)).toBeInTheDocument();
    expect(screen.queryByText(/The runtime is offline/)).toBeNull();
  });

  it("mutes the terminal echo immediately, with no restart confirm, then re-reads the tail", async () => {
    render(<DaemonLogCard />);
    await screen.findByTestId("daemon-log-tail");
    fireEvent.click(screen.getByRole("switch", { name: "Mute terminal echo" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({ quiet: true }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(2));
  });

  it("changes the log level only after the restart confirm, and not at all on cancel", async () => {
    const user = userEvent.setup();
    render(<DaemonLogCard />);
    await screen.findByTestId("daemon-log-tail");

    await user.click(screen.getByRole("button", { name: "Log level" }));
    await user.click(await screen.findByRole("menuitem", { name: "Debug" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Set the log level to debug?");
    expect(dialog).toHaveTextContent(LOG_LEVEL_RESTART_WARNING);
    expect(diagnostics.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await waitFor(() =>
      expect(diagnostics.save).toHaveBeenCalledWith({ logLevel: "debug" }),
    );

    await user.click(screen.getByRole("button", { name: "Log level" }));
    await user.click(await screen.findByRole("menuitem", { name: "Warn" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(diagnostics.save).toHaveBeenCalledTimes(1);

    // Re-picking the current level is a no-op: nothing to confirm.
    await user.click(screen.getByRole("button", { name: "Log level" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Info (default)" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(diagnostics.save).toHaveBeenCalledTimes(1);
  });

  it("refreshes on demand and copies the tail to the clipboard", async () => {
    const writeText = vi.fn(async () => {});
    // A plain DOM click: user-event's setup() installs its own clipboard
    // stub over navigator.clipboard, which would swallow this spy.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<DaemonLogCard />);
    await screen.findByTestId("daemon-log-tail");
    expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: /Copy tail/ }));
    expect(writeText).toHaveBeenCalledWith(sampleLog.lines.join("\n"));
  });

  it("re-reads the tail on an interval while Follow is on", async () => {
    vi.useFakeTimers();
    try {
      render(<DaemonLogCard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("switch", { name: "Follow" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // Turning Follow on re-arms the reader (one immediate read) …
      expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(2);
      // … then one more per interval.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DAEMON_LOG_FOLLOW_INTERVAL_MS);
      });
      expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(3);

      fireEvent.click(screen.getByRole("switch", { name: "Follow" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DAEMON_LOG_FOLLOW_INTERVAL_MS * 2);
      });
      // Off again: the re-arm reads once, the interval is gone.
      expect(fetchHarnessDaemonLog).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the external note and never reads the controller in external mode", () => {
    runtime.mode = "external";
    render(<DaemonLogCard />);
    expect(screen.getByText(EXTERNAL_LOG_NOTE)).toBeInTheDocument();
    expect(fetchHarnessDaemonLog).not.toHaveBeenCalled();
    expect(screen.queryByTestId("daemon-log-tail")).toBeNull();
  });

  it("renders the offline note when neither the daemon nor the controller answers", async () => {
    runtime.connected = false;
    fetchHarnessDaemonLog.mockResolvedValue(null);
    render(<DaemonLogCard />);
    expect(await screen.findByText(/The runtime is offline/)).toBeVisible();
    expect(screen.queryByTestId("daemon-log-tail")).toBeNull();
  });

  it("explains an older controller when the daemon is up but the route is missing", async () => {
    fetchHarnessDaemonLog.mockResolvedValue(null);
    render(<DaemonLogCard />);
    expect(
      await screen.findByText(/did not report a daemon log/),
    ).toBeInTheDocument();
  });

  it("surfaces a controller failure as the note", async () => {
    fetchHarnessDaemonLog.mockRejectedValue(new Error("controller exploded"));
    render(<DaemonLogCard />);
    expect(await screen.findByText("controller exploded")).toBeInTheDocument();
  });

  it("disables Download and Copy while nothing has been written", async () => {
    fetchHarnessDaemonLog.mockResolvedValue({
      ...sampleLog,
      sizeBytes: 0,
      lines: [],
      truncated: false,
    });
    render(<DaemonLogCard />);
    const tail = await screen.findByTestId("daemon-log-tail");
    expect(tail).toHaveTextContent("No output yet.");
    expect(screen.queryByTestId("daemon-log-download")).toBeNull();
    expect(screen.getByRole("button", { name: /Download/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Copy tail/ })).toBeDisabled();
    expect(screen.getByText(/nothing written yet/)).toBeInTheDocument();
  });

  it("shows the options hook's error and notice, and falls back to the log's own knobs", async () => {
    diagnostics.options = null;
    diagnostics.error = "mecated refused --log-level (previous restored)";
    diagnostics.notice = "Diagnostics options saved.";
    fetchHarnessDaemonLog.mockResolvedValue({
      ...sampleLog,
      quiet: true,
      level: "warn",
    });
    render(<DaemonLogCard />);
    await screen.findByTestId("daemon-log-tail");
    expect(
      screen.getByText("mecated refused --log-level (previous restored)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Diagnostics options saved.",
    );
    expect(screen.getByRole("button", { name: "Log level" })).toHaveTextContent(
      "Warn",
    );
    expect(
      screen.getByRole("switch", { name: "Mute terminal echo" }),
    ).toBeChecked();
  });
});
