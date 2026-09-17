import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describePosture,
  PERMISSIONS_SETTINGS_HREF,
  PostureBadge,
  PostureChip,
} from "./posture-badge";

/**
 * The shell posture badge — the chrome analogue of mecatui's ⚠ auto/⚠ yolo
 * badge. Pins (1) the description table: strict, absent, empty and
 * non-string values earn NO chrome, trusted/auto/yolo get their tone,
 * label and plain-language sentence, and an unknown tier stays observable
 * as a quiet chip with the raw value; (2) the chip is a link to the
 * Permissions page whose accessible name is the full sentence; (3) the
 * context-reading badge renders nothing while disconnected or when the
 * capability is absent (an older daemon), and renders the chip otherwise.
 */

const runtime = {
  connected: true,
  serverCapabilities: {} as Record<string, unknown>,
};

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime,
}));

beforeEach(() => {
  runtime.connected = true;
  runtime.serverCapabilities = {};
});

describe("describePosture", () => {
  it.each([
    ["strict", "strict"],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["undefined", undefined],
    ["null", null],
    ["a number", 3],
    ["a boolean", true],
  ])("renders no chrome for %s", (_name, value) => {
    expect(describePosture(value)).toBeNull();
  });

  it("describes trusted as PROJECT trust with a neutral tone", () => {
    const described = describePosture("trusted");
    expect(described).toMatchObject({
      tier: "trusted",
      label: "Trusted project",
      tone: "neutral",
    });
    expect(described?.title).toMatch(/^Project instructions are trusted/);
    expect(described?.title).toContain(
      "Settings → Permissions → Project trust",
    );
  });

  it("describes auto as a warning with the allow-all sentence", () => {
    const described = describePosture("auto");
    expect(described).toMatchObject({
      tier: "auto",
      label: "⚠ auto",
      tone: "warning",
    });
    expect(described?.title).toContain("Operator posture: auto");
    expect(described?.title).toContain("auto-approved unless a rule says ask");
    expect(described?.title).toContain("Settings → Permissions");
  });

  it("describes yolo as danger and names the dropped child defense", () => {
    const described = describePosture("yolo");
    expect(described).toMatchObject({
      tier: "yolo",
      label: "⚠ yolo",
      tone: "danger",
    });
    expect(described?.title).toContain("Operator posture: yolo");
    expect(described?.title).toContain(
      "subagents run shell substitutions without asking",
    );
  });

  it("trims the reported token before classifying it", () => {
    expect(describePosture(" yolo ")).toMatchObject({
      tier: "yolo",
      tone: "danger",
    });
  });

  it("keeps an unknown non-empty tier observable as a quiet chip", () => {
    const described = describePosture("paranoid");
    expect(described).toMatchObject({
      tier: "paranoid",
      label: "paranoid",
      tone: "neutral",
    });
    expect(described?.title).toContain("Operator posture: paranoid");
    expect(described?.title).toContain("does not know");
  });
});

describe("PostureChip", () => {
  it("renders nothing for strict", () => {
    const { container } = render(<PostureChip posture="strict" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links the auto badge to the Permissions page with the sentence as its name", () => {
    render(<PostureChip posture="auto" />);
    const chip = screen.getByTestId("posture-badge");
    expect(chip).toHaveAttribute("href", PERMISSIONS_SETTINGS_HREF);
    expect(chip).toHaveTextContent("⚠ auto");
    expect(chip).toHaveAttribute("data-tone", "warning");
    expect(chip).toHaveAttribute("data-posture", "auto");
    expect(
      screen.getByRole("link", {
        name: /^Operator posture: auto — tool calls are auto-approved/,
      }),
    ).toBe(chip);
  });

  it("renders the yolo badge in the danger tone", () => {
    render(<PostureChip posture="yolo" />);
    const chip = screen.getByTestId("posture-badge");
    expect(chip).toHaveTextContent("⚠ yolo");
    expect(chip).toHaveAttribute("data-tone", "danger");
  });

  it("renders the trusted chip as project trust", () => {
    render(<PostureChip posture="trusted" />);
    const chip = screen.getByTestId("posture-badge");
    expect(chip).toHaveTextContent("Trusted project");
    expect(chip).toHaveAttribute("data-tone", "neutral");
    expect(chip).toHaveAccessibleName(/^Project instructions are trusted/);
  });
});

describe("PostureBadge", () => {
  it("renders nothing while the daemon is disconnected, even with a stale tier", () => {
    runtime.connected = false;
    runtime.serverCapabilities = { posture: "yolo" };
    const { container } = render(<PostureBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing against an older daemon that omits the capability", () => {
    runtime.serverCapabilities = { steer: true };
    const { container } = render(<PostureBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for the strict default", () => {
    runtime.serverCapabilities = { posture: "strict" };
    const { container } = render(<PostureBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the chip for the daemon-reported tier", () => {
    runtime.serverCapabilities = { posture: "auto" };
    render(<PostureBadge />);
    expect(screen.getByTestId("posture-badge")).toHaveTextContent("⚠ auto");
  });
});
