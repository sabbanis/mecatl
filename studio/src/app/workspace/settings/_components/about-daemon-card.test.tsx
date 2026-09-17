import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_DRAFT_KEY } from "@/lib/pending-draft";
import { AboutDaemonCard, HANDOFF_FAILED } from "./about-daemon-card";

/**
 * The About card is ALWAYS rendered (the web analogue of `mecatui
 * --version`, which always answers): Studio's own build stamp and the
 * managed/external server mode come first; the daemon rows follow when GET
 * /v1/info answered, otherwise ONE "Server identity" row names why they are
 * missing (older daemon / unreachable / invalid answer / offline). "Copy
 * debug info" copies the rows; "Send to a new chat" hands the full
 * `/diagnostics` report to the draft composer and navigates — the user still
 * presses Enter.
 */

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const runtime = vi.hoisted(() => ({
  state: "connected" as "connecting" | "connected" | "offline",
  mode: "external" as "managed" | "external",
  deployment: "staging-eu",
  serverCapabilities: {} as Record<string, unknown>,
  workspace: "",
}));
vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

const probe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/harness/server-info", () => ({
  probeHarnessServerInfo: probe,
}));

const OK_PROBE = {
  info: {
    buildId: "fixture",
    serverImplementation: "fixture-daemon",
    providerEndpoint: "https://openrouter.ai/api/v1",
  },
  lookup: "ok",
};

beforeEach(() => {
  runtime.state = "connected";
  runtime.mode = "external";
  runtime.deployment = "staging-eu";
  runtime.serverCapabilities = { posture: "trusted" };
  runtime.workspace = "";
  probe.mockReset();
  probe.mockResolvedValue(OK_PROBE);
  vi.stubEnv("NEXT_PUBLIC_STUDIO_BUILD", "0.1.0+abc1234");
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AboutDaemonCard", () => {
  it("renders Studio's build, the server mode and the daemon rows when the probe answers", async () => {
    render(<AboutDaemonCard selectedProviderId="openrouter" />);
    expect(screen.getByTestId("about-studio-build")).toHaveTextContent(
      "0.1.0+abc1234",
    );
    expect(screen.getByTestId("about-server-mode")).toHaveTextContent(
      "external",
    );
    // Before the probe resolves the identity row says it is loading — the
    // card is never blank.
    expect(screen.getByTestId("about-server-identity")).toHaveTextContent(
      "loading…",
    );
    await waitFor(() =>
      expect(screen.getByTestId("about-server-build")).toHaveTextContent(
        "fixture",
      ),
    );
    expect(probe).toHaveBeenCalledWith("openrouter", expect.any(AbortSignal));
    expect(screen.getByTestId("about-server-implementation")).toHaveTextContent(
      "fixture-daemon",
    );
    expect(
      screen.getByText("https://openrouter.ai/api/v1"),
    ).toBeInTheDocument();
    expect(screen.getByText("staging-eu")).toBeInTheDocument();
    expect(screen.getByTestId("about-posture")).toHaveTextContent("trusted");
    expect(screen.queryByTestId("about-server-identity")).toBeNull();
  });

  it("adds a Workspace row, in either mode, when the runtime reports a root — and it joins the debug blob", async () => {
    runtime.workspace = "/workspace/from-deployment";
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<AboutDaemonCard selectedProviderId="openrouter" />);
    expect(screen.getByTestId("about-workspace")).toHaveTextContent(
      "/workspace/from-deployment",
    );
    await waitFor(() =>
      expect(screen.getByTestId("about-server-build")).toHaveTextContent(
        "fixture",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy debug info" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const lines = String(writeText.mock.calls[0]?.[0]).split("\n");
    // Right after the server mode, before the daemon's identity rows.
    expect(lines.slice(0, 3)).toEqual([
      "Studio: 0.1.0+abc1234",
      "Server mode: external",
      "Workspace: /workspace/from-deployment",
    ]);
  });

  it("stays rendered against an older daemon, naming the missing route", async () => {
    probe.mockResolvedValue({ info: null, lookup: "not-supported" });
    runtime.serverCapabilities = {};
    runtime.deployment = "";
    render(<AboutDaemonCard />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-identity")).toHaveTextContent(
        "unavailable on this daemon (GET /v1/info not supported)",
      ),
    );
    expect(screen.getByTestId("about-studio-build")).toHaveTextContent(
      "0.1.0+abc1234",
    );
    expect(screen.queryByTestId("about-server-build")).toBeNull();
    expect(screen.getByText("not set")).toBeInTheDocument();
    expect(screen.getByTestId("about-posture")).toHaveTextContent(
      "not reported",
    );
  });

  it("names an unreachable daemon and an invalid answer", async () => {
    probe.mockResolvedValue({ info: null, lookup: "unreachable" });
    const view = render(<AboutDaemonCard />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-identity")).toHaveTextContent(
        "the daemon did not answer",
      ),
    );
    view.unmount();
    probe.mockResolvedValue({ info: null, lookup: "invalid-response" });
    render(<AboutDaemonCard />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-identity")).toHaveTextContent(
        "not with its identity",
      ),
    );
  });

  it("renders offline without probing and disables the handoff", () => {
    runtime.state = "offline";
    render(<AboutDaemonCard />);
    expect(probe).not.toHaveBeenCalled();
    expect(screen.getByTestId("about-server-identity")).toHaveTextContent(
      "the daemon is offline",
    );
    expect(
      screen.getByRole("button", { name: "Send to a new chat" }),
    ).toBeDisabled();
    // Copy still works offline: the Studio rows are worth reporting alone.
    expect(
      screen.getByRole("button", { name: "Copy debug info" }),
    ).toBeEnabled();
  });

  it("copies the rows as label: value lines", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<AboutDaemonCard selectedProviderId="openrouter" />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-build")).toHaveTextContent(
        "fixture",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy debug info" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toBe(
      [
        "Studio: 0.1.0+abc1234",
        "Server mode: external",
        "Build: fixture",
        "Implementation: fixture-daemon",
        "Provider endpoint: https://openrouter.ai/api/v1",
        "Deployment: staging-eu",
        "Posture: trusted",
      ].join("\n"),
    );
    expect(toast.success).toHaveBeenCalledWith("Debug info copied");
  });

  it("hands the full /diagnostics report to a new chat's composer", async () => {
    render(<AboutDaemonCard selectedProviderId="openrouter" />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-build")).toHaveTextContent(
        "fixture",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send to a new chat" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/workspace/chat"),
    );
    const stashed = window.sessionStorage.getItem(PENDING_DRAFT_KEY) ?? "";
    const lines = stashed.split("\n");
    expect(lines[0]).toBe("Mecatl diagnostics (current client state only):");
    expect(lines).toContain("client build: 0.1.0+abc1234");
    expect(lines).toContain("server mode: external");
    expect(lines).toContain("server build: fixture");
    expect(lines).toContain("server implementation: fixture-daemon");
    expect(lines).toContain("server lookup: ok");
    expect(lines).toContain("deployment: staging-eu");
    expect(lines).toContain("posture: trusted");
    // No session on the Settings page: the session lines say so.
    expect(lines).toContain("active model: unavailable");
    expect(lines).toContain("permission mode: unavailable");
    // The card's own probe IS the report's server half — no second call.
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("says so instead of navigating when the browser cannot hold the handoff", async () => {
    // A browser with site data blocked throws on the accessor itself.
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    render(<AboutDaemonCard />);
    await waitFor(() =>
      expect(screen.getByTestId("about-server-build")).toHaveTextContent(
        "fixture",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send to a new chat" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(HANDOFF_FAILED),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});
