import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveWelcomeHints,
  deriveWelcomeIdentity,
  WELCOME_MASCOT_SRC,
  WelcomeHints,
  WelcomeMascot,
} from "./welcome-hints";

/**
 * The draft splash's welcome extras (mecatui's zero-state card): the mascot
 * is decorative; the hint rows render only on a connected daemon and
 * advertise only what the daemon/controller report as on — memory, agents,
 * skills, scheduling off the capabilities document, the gateway slot off
 * the controller — and the identity line names provider · posture ·
 * deployment without ever guessing an unreported posture.
 */

const runtime = {
  connected: true,
  mode: "managed" as "managed" | "external",
  provider: "",
  deployment: "",
  gateway: null as { name: string; url: string } | null,
  toolhiveAvailable: false,
  serverCapabilities: {} as Record<string, unknown>,
};

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

beforeEach(() => {
  runtime.connected = true;
  runtime.mode = "managed";
  runtime.provider = "";
  runtime.deployment = "";
  runtime.gateway = null;
  runtime.toolhiveAvailable = false;
  runtime.serverCapabilities = {};
});

const hintIds = (caps: Record<string, unknown>, over = {}) =>
  deriveWelcomeHints({
    serverCapabilities: caps,
    gateway: null,
    toolhiveAvailable: false,
    provider: "",
    ...over,
  }).map((h) => h.id);

describe("WelcomeMascot", () => {
  it("renders the web copy of the mascot decoratively", () => {
    render(<WelcomeMascot />);
    const img = screen.getByTestId("welcome-mascot");
    expect(img).toHaveAttribute("src", WELCOME_MASCOT_SRC);
    expect(img).toHaveAttribute("alt", "");
    // Decorative: no img role for assistive tech to announce.
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("WelcomeHints — connection gate", () => {
  it("renders nothing while the daemon is not connected", () => {
    runtime.connected = false;
    runtime.serverCapabilities = { memory: true, agents: true };
    const { container } = render(<WelcomeHints />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WelcomeHints — capability rows", () => {
  it("always offers slash commands and the ? shortcuts link", () => {
    render(<WelcomeHints />);
    expect(screen.getByText("Slash commands")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Keyboard shortcuts and features" }),
    ).toHaveAttribute("href", "/workspace/shortcuts");
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.queryByText(/Cross-session memory is on/)).toBeNull();
    expect(screen.queryByText("Mention an agent")).toBeNull();
    expect(screen.queryByText("Scheduled runs are available")).toBeNull();
  });

  it("names skills on the slash row only when the deployment enables them", () => {
    runtime.serverCapabilities = { skills: true };
    render(<WelcomeHints />);
    expect(screen.getByText("Slash commands and skills")).toBeInTheDocument();
  });

  it("shows the memory note only with memory: true", () => {
    runtime.serverCapabilities = { memory: true };
    render(<WelcomeHints />);
    expect(
      screen.getByText(
        "Cross-session memory is on — context carries across runs",
      ),
    ).toBeInTheDocument();
    // A non-boolean truthy value is not "on": absence and "yes" both read off.
    expect(hintIds({ memory: "yes" })).not.toContain("memory");
  });

  it("shows the @-mention row only with agents: true", () => {
    runtime.serverCapabilities = { agents: true };
    render(<WelcomeHints />);
    expect(screen.getByText("Mention an agent")).toBeInTheDocument();
    expect(screen.getByText("@")).toBeInTheDocument();
    expect(hintIds({ agents: false })).not.toContain("agents");
  });

  it("links to the schedules page only with scheduling: true", () => {
    runtime.serverCapabilities = { scheduling: true };
    render(<WelcomeHints />);
    expect(
      screen.getByRole("link", { name: "Scheduled runs are available" }),
    ).toHaveAttribute("href", "/workspace/schedules");
    expect(hintIds({})).not.toContain("scheduling");
  });
});

describe("WelcomeHints — gateway slot", () => {
  it("names the connected MCP gateway when the controller reports one", () => {
    runtime.gateway = { name: "toolhive", url: "http://127.0.0.1:8080" };
    render(<WelcomeHints />);
    expect(
      screen.getByText("MCP gateway toolhive connected"),
    ).toBeInTheDocument();
  });

  it("offers the ToolHive LLM gateway when it is reachable but not the active provider", () => {
    runtime.toolhiveAvailable = true;
    runtime.provider = "openai";
    render(<WelcomeHints />);
    expect(
      screen.getByRole("link", {
        name: "ToolHive LLM gateway detected — no API key needed",
      }),
    ).toHaveAttribute("href", "/workspace/settings/provider");
  });

  it("stays quiet about ToolHive once it is the active provider", () => {
    runtime.toolhiveAvailable = true;
    runtime.provider = "ToolHive LLM gateway";
    render(<WelcomeHints />);
    expect(screen.queryByText(/ToolHive LLM gateway detected/)).toBeNull();
  });

  it("is one row: a connected gateway wins over the ToolHive note", () => {
    const ids = hintIds(
      {},
      { gateway: { name: "gw" }, toolhiveAvailable: true, provider: "openai" },
    );
    expect(ids).toContain("gateway");
    expect(ids).not.toContain("toolhive");
  });

  it("never exceeds six rows with everything on", () => {
    const ids = hintIds(
      { skills: true, agents: true, memory: true, scheduling: true },
      { gateway: { name: "gw" }, toolhiveAvailable: true, provider: "openai" },
    );
    expect(ids).toHaveLength(6);
    expect(ids).toEqual([
      "slash",
      "agents",
      "shortcuts",
      "memory",
      "gateway",
      "scheduling",
    ]);
  });
});

describe("WelcomeHints — identity line", () => {
  it("carries the provider, the daemon-reported posture and the deployment label", () => {
    runtime.provider = "openai";
    runtime.deployment = "staging";
    runtime.serverCapabilities = { posture: "trusted" };
    render(<WelcomeHints />);
    expect(screen.getByTestId("welcome-identity")).toHaveTextContent(
      "Connected · openai · posture trusted · staging",
    );
  });

  it("falls back to the daemon mode when no provider is reported and omits an unreported posture", () => {
    expect(
      deriveWelcomeIdentity({
        provider: "",
        mode: "external",
        serverCapabilities: {},
        deployment: "",
      }),
    ).toBe("Connected · external daemon");
    expect(
      deriveWelcomeIdentity({
        provider: "",
        mode: "managed",
        serverCapabilities: { posture: "" },
        deployment: "",
      }),
    ).toBe("Connected · managed daemon");
    // A non-string posture is not a tier — never rendered as one.
    expect(
      deriveWelcomeIdentity({
        provider: "mock",
        mode: "managed",
        serverCapabilities: { posture: 3 },
        deployment: "",
      }),
    ).toBe("Connected · mock");
  });

  it("never renders a URL or host", () => {
    runtime.gateway = { name: "toolhive", url: "http://127.0.0.1:8080" };
    runtime.provider = "external daemon";
    runtime.mode = "external";
    const { container } = render(<WelcomeHints />);
    expect(container.textContent).not.toMatch(/https?:\/\//);
    expect(container.textContent).not.toContain("127.0.0.1");
  });
});
