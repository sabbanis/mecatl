import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ContextMeter, contextUtilisation } from "./context-meter";

/**
 * Pins the context-meter math (B1.1): counted input+output tokens over the
 * resolved model's context window, clamped, and honestly null when the window
 * is unknown — the meter must never render against a made-up denominator.
 */
describe("contextUtilisation", () => {
  it("computes the fraction of the window the counted tokens occupy", () => {
    expect(contextUtilisation(30_000, 10_000, 400_000)).toBeCloseTo(0.1);
    expect(contextUtilisation(0, 0, 400_000)).toBe(0);
  });

  it("clamps overshoot to 1 (the daemon compacts before the client's approximation catches up)", () => {
    expect(contextUtilisation(500_000, 100_000, 400_000)).toBe(1);
  });

  it("returns null when the window is unknown", () => {
    expect(contextUtilisation(1_000, 1_000, 0)).toBeNull();
    expect(contextUtilisation(1_000, 1_000, -1)).toBeNull();
    expect(contextUtilisation(1_000, 1_000, Number.NaN)).toBeNull();
  });

  it("ignores negative token figures rather than going below zero", () => {
    expect(contextUtilisation(-5, 100, 1_000)).toBeCloseTo(0.1);
  });
});

/**
 * The rendered strip lives at the right end of the composer toolbar: a short
 * bar plus a plain "N% used" (the tooltip owns the approximation caveat and
 * explains what a context window is), text matching the toolbar pills' value
 * typography (text-sm, muted — the "On" in "Memory On"), no model name.
 */
describe("ContextMeter render", () => {
  const props = {
    contextWindow: 400_000,
    inputTokens: 80_000,
    outputTokens: 8_000,
  };

  it("shows the plain percentage as used, no approximate tag", () => {
    const { container } = render(createElement(ContextMeter, props));
    expect(container.textContent).toContain("22% used");
    expect(container.textContent).not.toContain("~");
    expect(container.textContent).not.toContain("of context");
    expect(container.textContent).not.toContain("approximate");
  });

  it("docks right with a short fixed bar and no model name", () => {
    const { container } = render(createElement(ContextMeter, props));
    const root = container.firstElementChild;
    expect(root?.className).toContain("ml-auto");
    expect(root?.innerHTML).toContain("w-16");
    expect(container.textContent?.trim()).toBe("22% used");
  });

  it("uses the toolbar pills' value typography", () => {
    const { container } = render(createElement(ContextMeter, props));
    const root = container.firstElementChild;
    expect(root?.className).toContain("text-sm");
    expect(root?.className).toContain("text-muted-foreground");
  });

  it("stays quiet until this visit has counted tokens", () => {
    const { container } = render(
      createElement(ContextMeter, {
        ...props,
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
    expect(container.firstElementChild).toBeNull();
  });
});
