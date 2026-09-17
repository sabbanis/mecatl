import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineCause } from "@/features/agent/offline-cause";
import {
  type ConnectionFacts,
  ConnectionIndicator,
  ConnectionPill,
  DIAGNOSTICS_SETTINGS_HREF,
  describeConnection,
} from "./connection-indicator";

/**
 * The shell connection indicator — mecatui's affirmative "connected" status
 * line for the top navigation. Pins (1) the description table: connecting /
 * connected / offline map to a label, a tone and the tooltip lines, with the
 * offline label named by the probe's classified cause and the connected
 * tooltip omitting every empty fact (an external daemon has no provider
 * line, an older daemon has no posture line, an unset deployment label
 * disappears); (2) the pill is a `role="status"` live region named by its
 * label around a link to Settings → Diagnostics, whose tooltip opens on
 * keyboard focus and lists the facts; (3) the context-reading indicator
 * always renders — never null — so the healthy state is stated.
 */

const connectivity: OfflineCause = {
  kind: "connectivity",
  title: "Mecatl is unreachable.",
  remedy: "Run `task build`, then `task studio:dev` to start it.",
  detail: "fetch failed",
  signIn: null,
};

const loginRequired: OfflineCause = {
  kind: "login-required",
  title: "Sign-in required",
  remedy: "This deployment requires OIDC sign-in.",
  detail: "",
  signIn: "sign-in",
};

function facts(overrides: Partial<ConnectionFacts> = {}): ConnectionFacts {
  return {
    state: "connected",
    mode: "managed",
    provider: "openrouter",
    isMock: false,
    deployment: "",
    serverCapabilities: { posture: "trusted" },
    offlineCause: null,
    ...overrides,
  };
}

const runtime: ConnectionFacts = facts();

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

beforeEach(() => {
  Object.assign(runtime, facts());
});

describe("describeConnection", () => {
  it("describes the connected managed daemon with provider and posture lines", () => {
    expect(describeConnection(facts())).toEqual({
      state: "connected",
      tone: "connected",
      label: "Connected",
      lines: [
        "Connected to mecated",
        "Provider: openrouter",
        "Posture: trusted",
      ],
      cause: "",
    });
  });

  it("flags the offline mock provider", () => {
    expect(
      describeConnection(facts({ provider: "mock", isMock: true })).lines,
    ).toContain("Provider: mock (offline mock)");
  });

  it("names an external daemon and drops the stubbed provider line", () => {
    const described = describeConnection(
      facts({ mode: "external", provider: "external daemon" }),
    );
    expect(described.lines[0]).toBe("Connected to an external daemon");
    expect(described.lines.some((line) => line.startsWith("Provider:"))).toBe(
      false,
    );
    expect(described.lines).toContain("Posture: trusted");
  });

  it("adds the deployment label when the operator set one", () => {
    expect(
      describeConnection(facts({ deployment: "staging-eu" })).lines,
    ).toContain("Deployment: staging-eu");
  });

  it("omits every empty fact against an older daemon with no provider", () => {
    expect(
      describeConnection(
        facts({ provider: "  ", deployment: "  ", serverCapabilities: {} }),
      ).lines,
    ).toEqual(["Connected to mecated"]);
  });

  it("ignores a non-string posture capability", () => {
    expect(
      describeConnection(facts({ serverCapabilities: { posture: 3 } })).lines,
    ).toEqual(["Connected to mecated", "Provider: openrouter"]);
  });

  it("describes connecting with the amber tone", () => {
    expect(describeConnection(facts({ state: "connecting" }))).toEqual({
      state: "connecting",
      tone: "connecting",
      label: "Connecting…",
      lines: ["Connecting to Mecatl…"],
      cause: "",
    });
  });

  it("describes plain connectivity loss as Offline with the cause's title and detail", () => {
    expect(
      describeConnection(
        facts({ state: "offline", offlineCause: connectivity }),
      ),
    ).toEqual({
      state: "offline",
      tone: "offline",
      label: "Offline",
      lines: ["Mecatl is unreachable.", "fetch failed"],
      cause: "connectivity",
    });
  });

  it("falls back to the connectivity wording when the cause is missing", () => {
    expect(
      describeConnection(facts({ state: "offline", offlineCause: null })),
    ).toMatchObject({
      label: "Offline",
      lines: ["Mecatl is unreachable."],
      cause: "connectivity",
    });
  });

  it.each([
    ["login-required", loginRequired, "Sign in required"],
    [
      "session-expired",
      { ...loginRequired, kind: "session-expired" as const },
      "Sign in required",
    ],
    [
      "credential-rejected",
      {
        ...connectivity,
        kind: "credential-rejected" as const,
        title: "Credential rejected",
      },
      "Credential rejected",
    ],
    [
      "idp-unavailable",
      {
        ...connectivity,
        kind: "idp-unavailable" as const,
        title: "Identity provider unreachable",
      },
      "Offline",
    ],
  ])("labels an offline %s cause", (_kind, cause, label) => {
    const described = describeConnection(
      facts({ state: "offline", offlineCause: cause }),
    );
    expect(described.label).toBe(label);
    expect(described.tone).toBe("offline");
    expect(described.cause).toBe(cause.kind);
    expect(described.lines[0]).toBe(cause.title);
  });

  it("clamps a long server detail to one glance", () => {
    const detail = "x".repeat(400);
    const described = describeConnection(
      facts({
        state: "offline",
        offlineCause: { ...connectivity, detail },
      }),
    );
    expect(described.lines[1]?.length).toBeLessThanOrEqual(160);
    expect(described.lines[1]?.endsWith("…")).toBe(true);
  });
});

describe("ConnectionPill", () => {
  it("is a status live region named by the label around a link to Diagnostics", () => {
    render(<ConnectionPill described={describeConnection(facts())} />);
    const region = screen.getByRole("status", { name: "Connected" });
    expect(region).toHaveAttribute("aria-live", "polite");
    const link = screen.getByTestId("connection-indicator");
    expect(region).toContainElement(link);
    expect(link).toHaveAttribute("href", DIAGNOSTICS_SETTINGS_HREF);
    expect(link).toHaveAttribute("data-connection", "connected");
    expect(link).not.toHaveAttribute("data-cause");
    expect(screen.getByRole("link", { name: "Connected" })).toBe(link);
    expect(screen.getByTestId("connection-indicator-dot")).toHaveClass(
      "bg-emerald-400",
    );
  });

  it("pulses the amber dot while connecting", () => {
    render(
      <ConnectionPill
        described={describeConnection(facts({ state: "connecting" }))}
      />,
    );
    expect(screen.getByRole("status", { name: "Connecting…" })).toBeVisible();
    const dot = screen.getByTestId("connection-indicator-dot");
    expect(dot).toHaveClass("bg-amber-400");
    expect(dot).toHaveClass("animate-pulse");
  });

  it("names the offline cause on the pill", () => {
    render(
      <ConnectionPill
        described={describeConnection(
          facts({ state: "offline", offlineCause: loginRequired }),
        )}
      />,
    );
    expect(
      screen.getByRole("status", { name: "Sign in required" }),
    ).toBeVisible();
    const link = screen.getByTestId("connection-indicator");
    expect(link).toHaveAttribute("data-connection", "offline");
    expect(link).toHaveAttribute("data-cause", "login-required");
    expect(screen.getByTestId("connection-indicator-dot")).toHaveClass(
      "bg-red-400",
    );
  });

  it("opens the fact tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionPill
        described={describeConnection(
          facts({ provider: "mock", isMock: true, deployment: "lab" }),
        )}
      />,
    );
    await user.tab();
    expect(screen.getByTestId("connection-indicator")).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Connected to mecated");
    expect(tooltip).toHaveTextContent("Provider: mock (offline mock)");
    expect(tooltip).toHaveTextContent("Deployment: lab");
    expect(tooltip).toHaveTextContent("Posture: trusted");
  });
});

describe("ConnectionIndicator", () => {
  it("states the connected state from the runtime provider", () => {
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status", { name: "Connected" })).toBeVisible();
    expect(screen.getByTestId("connection-indicator")).toHaveAttribute(
      "data-connection",
      "connected",
    );
  });

  it("follows the provider into connecting", () => {
    runtime.state = "connecting";
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status", { name: "Connecting…" })).toBeVisible();
  });

  it("follows the provider offline and names the cause", () => {
    runtime.state = "offline";
    runtime.offlineCause = connectivity;
    render(<ConnectionIndicator />);
    expect(screen.getByRole("status", { name: "Offline" })).toBeVisible();
    expect(screen.getByTestId("connection-indicator")).toHaveAttribute(
      "data-cause",
      "connectivity",
    );
  });
});
