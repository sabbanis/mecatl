import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_SNAPSHOT_FOOTER,
  MCP_SOURCES_EMPTY_TEXT,
  MCP_UPDATED_FOOTER,
} from "@/components/mcp/mcp-sources-list";
import type { McpInventoryView } from "@/features/agent/hooks/use-mcp-inventory";
import {
  MCP_BROKER_ONLY_TEXT,
  MCP_NO_INVENTORY_TEXT,
  McpSourcesCard,
} from "./mcp-sources-card";

/**
 * Settings → MCP tools: the daemon's resolved MCP sources as a card. Pins
 * that (1) the card is gated on `capabilities.mcp` — a broker-only daemon
 * (`mcp_connector_status` alone) gets the pointer note and NEVER the direct
 * source read, a daemon with neither says so, offline renders the offline
 * note; (2) each source renders its kind/enabled/group badges, its servers
 * and its skip reasons, with the ToolHive groups line under them; (3) the
 * footer carries the startup-snapshot caveat until a manual refresh lands,
 * and the Refresh button drives `refresh()`; (4) empty and error states.
 */

const { runtime, inventory } = vi.hoisted(() => ({
  runtime: {
    connected: true,
    serverCapabilities: {} as Record<string, unknown>,
  },
  inventory: {
    enabledCalls: [] as boolean[],
    view: {} as McpInventoryView,
  },
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

vi.mock("@/features/agent/hooks/use-mcp-inventory", () => ({
  useMcpInventory: (options?: { enabled?: boolean }) => {
    inventory.enabledCalls.push(options?.enabled ?? true);
    return inventory.view;
  },
}));

function view(overrides: Partial<McpInventoryView> = {}): McpInventoryView {
  return {
    sources: [
      {
        name: "static",
        kind: "static",
        enabled: true,
        group: "",
        servers: [
          {
            name: "github",
            url: "http://127.0.0.1:1/gh",
            transport: "streamable-http",
            group: "",
          },
        ],
        diagnostics: [],
      },
      {
        name: "toolhive(default)",
        kind: "toolhive",
        enabled: false,
        group: "default",
        servers: [],
        diagnostics: ["fetch: skipped, unsupported transport stdio"],
      },
    ],
    groups: ["default", "research"],
    groupsError: false,
    groupsLoaded: true,
    isLoading: false,
    refreshing: false,
    refreshed: false,
    error: null,
    refresh: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  runtime.connected = true;
  runtime.serverCapabilities = { mcp: true };
  inventory.enabledCalls = [];
  inventory.view = view();
});

describe("McpSourcesCard", () => {
  it("renders every source with its badges, servers, skip reasons and the groups line", () => {
    render(<McpSourcesCard />);

    expect(
      screen.getByRole("heading", { name: "MCP tools" }),
    ).toBeInTheDocument();
    const sources = screen.getAllByTestId("mcp-source");
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveTextContent("static");
    expect(sources[0]).toHaveTextContent("enabled");
    expect(sources[0]).toHaveTextContent("github");
    expect(sources[0]).toHaveTextContent("streamable-http");
    expect(sources[0]).toHaveTextContent("http://127.0.0.1:1/gh");
    expect(sources[1]).toHaveTextContent("toolhive(default)");
    expect(sources[1]).toHaveTextContent("toolhive");
    expect(sources[1]).toHaveTextContent("disabled");
    expect(sources[1]).toHaveTextContent("group default");
    expect(screen.getByTestId("mcp-diagnostic")).toHaveTextContent(
      "fetch: skipped, unsupported transport stdio",
    );
    expect(screen.getByTestId("mcp-groups")).toHaveTextContent(
      "ToolHive groups: default, research",
    );
    expect(inventory.enabledCalls.at(-1)).toBe(true);
  });

  it("degrades the groups line when only the groups read failed", () => {
    inventory.view = view({ groups: [], groupsError: true });
    render(<McpSourcesCard />);
    expect(screen.getAllByTestId("mcp-source")).toHaveLength(2);
    expect(screen.getByTestId("mcp-groups")).toHaveTextContent(
      "ToolHive groups: unavailable",
    );
  });

  it("carries the startup-snapshot caveat until a refresh lands, and Refresh drives refresh()", () => {
    const { rerender } = render(<McpSourcesCard />);
    expect(screen.getByTestId("mcp-footer")).toHaveTextContent(
      MCP_SNAPSHOT_FOOTER,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh MCP sources" }),
    );
    expect(inventory.view.refresh).toHaveBeenCalledTimes(1);

    inventory.view = view({ refreshed: true });
    rerender(<McpSourcesCard />);
    expect(screen.getByTestId("mcp-footer")).toHaveTextContent(
      MCP_UPDATED_FOOTER,
    );
  });

  it("renders the empty and error states", () => {
    inventory.view = view({ sources: [] });
    const { rerender } = render(<McpSourcesCard />);
    expect(screen.getByText(MCP_SOURCES_EMPTY_TEXT)).toBeInTheDocument();

    inventory.view = view({
      sources: [],
      error: "No MCP provider is wired on this daemon.",
    });
    rerender(<McpSourcesCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No MCP provider is wired on this daemon.",
    );
  });

  it("never reads sources on a broker-only daemon, and points at the chat panel", () => {
    runtime.serverCapabilities = { mcp_connector_status: true };
    render(<McpSourcesCard />);
    expect(screen.getByText(MCP_BROKER_ONLY_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId("mcp-source")).toBeNull();
    expect(inventory.enabledCalls.every((enabled) => enabled === false)).toBe(
      true,
    );
  });

  it("says so plainly when the daemon reports no MCP inventory at all", () => {
    runtime.serverCapabilities = {};
    render(<McpSourcesCard />);
    expect(screen.getByText(MCP_NO_INVENTORY_TEXT)).toBeInTheDocument();
    expect(inventory.enabledCalls.every((enabled) => enabled === false)).toBe(
      true,
    );
  });

  it("renders the offline note while the runtime is unreachable", () => {
    runtime.connected = false;
    render(<McpSourcesCard />);
    expect(
      screen.getByText("The runtime is offline", { exact: false }),
    ).toBeInTheDocument();
    expect(inventory.enabledCalls.every((enabled) => enabled === false)).toBe(
      true,
    );
  });
});
