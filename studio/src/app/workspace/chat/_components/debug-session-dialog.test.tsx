import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEBUG_MCP_APPROVAL_HINT,
  DEBUG_SESSION_CONSENT,
  DebugSessionDialog,
  MCP_LIST_UNAVAILABLE_NOTE,
  NO_MCP_SERVER_NOTE,
  parseServerNames,
  useDebugSessionDialog,
} from "./debug-session-dialog";

/**
 * Pins the "Debug with AI" consent dialog (ADR 0254): the disclosure is
 * always in front of the operator; the attach-MCP section exists ONLY when
 * the daemon's `debug_mcp` capability is on; listed servers are checkboxes
 * whose picks confirm as the server names; a daemon that cannot list falls
 * back to typed comma-separated names; an empty inventory says so; and the
 * per-call-approval / Always-allow-not-learned hint always rides the section.
 */

const runtime = vi.hoisted(() => ({
  serverCapabilities: {} as Record<string, unknown>,
}));
vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => ({
    mode: "managed",
    serverCapabilities: runtime.serverCapabilities,
  }),
}));

const mcp = vi.hoisted(() => ({
  fetchNames: vi.fn<() => Promise<string[]>>(),
}));
vi.mock("@/lib/harness/mcp-sources", () => ({
  fetchHarnessMcpServerNames: mcp.fetchNames,
}));

afterEach(() => {
  runtime.serverCapabilities = {};
  mcp.fetchNames.mockReset();
});

describe("parseServerNames", () => {
  it("splits on commas and whitespace, trims, and drops empties and duplicates", () => {
    expect(parseServerNames(" github, slack ,, github\nfetch ")).toEqual([
      "github",
      "slack",
      "fetch",
    ]);
    expect(parseServerNames("")).toEqual([]);
  });
});

describe("DebugSessionDialog", () => {
  it("shows the consent text and no attach section when debug_mcp is off; confirming passes no servers", () => {
    const onConfirm = vi.fn();
    render(
      <DebugSessionDialog
        open
        onOpenChange={() => {}}
        mcpSupported={false}
        servers={{ status: "ready", names: ["github"] }}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText(DEBUG_SESSION_CONSENT)).toBeInTheDocument();
    expect(screen.queryByText("Attach debugger MCP servers")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(DEBUG_MCP_APPROVAL_HINT)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Send evidence & debug" }),
    );
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("offers each listed server as a checkbox and confirms the picked names, with the not-learned hint", () => {
    const onConfirm = vi.fn();
    render(
      <DebugSessionDialog
        open
        onOpenChange={() => {}}
        mcpSupported
        servers={{ status: "ready", names: ["github", "slack"] }}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("Attach debugger MCP servers")).toBeInTheDocument();
    expect(screen.getByText(DEBUG_MCP_APPROVAL_HINT)).toBeInTheDocument();
    const github = screen.getByRole("checkbox", { name: "github" });
    const slack = screen.getByRole("checkbox", { name: "slack" });
    expect(github).toHaveAttribute("aria-checked", "false");
    fireEvent.click(github);
    fireEvent.click(slack);
    fireEvent.click(slack);
    expect(github).toHaveAttribute("aria-checked", "true");
    expect(slack).toHaveAttribute("aria-checked", "false");
    fireEvent.click(
      screen.getByRole("button", { name: "Send evidence & debug" }),
    );
    expect(onConfirm).toHaveBeenCalledWith(["github"]);
  });

  it("says so when the daemon lists no server, and still shows the hint", () => {
    render(
      <DebugSessionDialog
        open
        onOpenChange={() => {}}
        mcpSupported
        servers={{ status: "ready", names: [] }}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(NO_MCP_SERVER_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(DEBUG_MCP_APPROVAL_HINT)).toBeInTheDocument();
  });

  it("falls back to typed comma-separated names when the daemon could not list", () => {
    const onConfirm = vi.fn();
    render(
      <DebugSessionDialog
        open
        onOpenChange={() => {}}
        mcpSupported
        servers={{ status: "unavailable" }}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText(MCP_LIST_UNAVAILABLE_NOTE)).toBeInTheDocument();
    const input = screen.getByLabelText("Server names (comma-separated)");
    fireEvent.change(input, { target: { value: "github, slack, github" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Send evidence & debug" }),
    );
    expect(onConfirm).toHaveBeenCalledWith(["github", "slack"]);
  });

  it("shows a listing status while the servers load and cancels through onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(
      <DebugSessionDialog
        open
        onOpenChange={onOpenChange}
        mcpSupported
        servers={{ status: "loading" }}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Listing configured MCP servers",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("useDebugSessionDialog", () => {
  function Host({
    onCreate,
  }: {
    onCreate: (id: string, servers: string[]) => void;
  }) {
    const { requestDebugSession, debugSessionDialog } = useDebugSessionDialog({
      onCreate,
    });
    return (
      <>
        <button type="button" onClick={() => requestDebugSession("target-1")}>
          Debug with AI
        </button>
        {debugSessionDialog}
      </>
    );
  }

  it("lists the daemon's servers on open only when debug_mcp is on, and hands the target plus picks to onCreate", async () => {
    runtime.serverCapabilities = { session_debug: true, debug_mcp: true };
    mcp.fetchNames.mockResolvedValue(["github"]);
    const onCreate = vi.fn();
    render(<Host onCreate={onCreate} />);
    expect(mcp.fetchNames).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Debug with AI" }));
    expect(mcp.fetchNames).toHaveBeenCalledTimes(1);
    const github = await screen.findByRole("checkbox", { name: "github" });
    fireEvent.click(github);
    fireEvent.click(
      screen.getByRole("button", { name: "Send evidence & debug" }),
    );
    expect(onCreate).toHaveBeenCalledWith("target-1", ["github"]);
    await waitFor(() =>
      expect(screen.queryByText(DEBUG_SESSION_CONSENT)).toBeNull(),
    );
  });

  it("never lists servers when debug_mcp is off, and confirms a plain debug session", async () => {
    runtime.serverCapabilities = { session_debug: true };
    const onCreate = vi.fn();
    render(<Host onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Debug with AI" }));
    expect(await screen.findByText(DEBUG_SESSION_CONSENT)).toBeInTheDocument();
    expect(mcp.fetchNames).not.toHaveBeenCalled();
    expect(screen.queryByText("Attach debugger MCP servers")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Send evidence & debug" }),
    );
    expect(onCreate).toHaveBeenCalledWith("target-1", []);
  });

  it("falls back to typed names when the listing fails", async () => {
    runtime.serverCapabilities = { debug_mcp: true };
    mcp.fetchNames.mockRejectedValue(new Error("no route"));
    render(<Host onCreate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Debug with AI" }));
    expect(
      await screen.findByLabelText("Server names (comma-separated)"),
    ).toBeInTheDocument();
  });

  it("starts closed and ignores a confirm with no target", () => {
    const onCreate = vi.fn();
    const { result } = renderHook(() => useDebugSessionDialog({ onCreate }));
    expect(result.current.debugSessionDialog.props.open).toBe(false);
    act(() => result.current.debugSessionDialog.props.onConfirm([]));
    expect(onCreate).not.toHaveBeenCalled();
  });
});
