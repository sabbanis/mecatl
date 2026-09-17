import { describe, expect, it } from "vitest";
import { contextUtilisation, meterOccupancy } from "./context-meter";

/**
 * Pins the context-meter math: the latest turn's input tokens (the context
 * occupancy) over the resolved model's context window, clamped, and honestly
 * null when the window is unknown — the bar must never render against a
 * made-up denominator; the strip degrades to the bare size instead.
 */
describe("contextUtilisation", () => {
  it("computes the fraction of the window the occupancy takes", () => {
    expect(contextUtilisation(40_000, 400_000)).toBeCloseTo(0.1);
    expect(contextUtilisation(0, 400_000)).toBe(0);
  });

  it("clamps overshoot to 1 (the daemon compacts before the client catches up)", () => {
    expect(contextUtilisation(600_000, 400_000)).toBe(1);
  });

  it("returns null when the window is unknown", () => {
    expect(contextUtilisation(1_000, 0)).toBeNull();
    expect(contextUtilisation(1_000, -1)).toBeNull();
    expect(contextUtilisation(1_000, Number.NaN)).toBeNull();
  });

  it("ignores a negative occupancy rather than going below zero", () => {
    expect(contextUtilisation(-5, 1_000)).toBe(0);
  });
});

describe("meterOccupancy", () => {
  it("prefers the latest turn's input tokens", () => {
    expect(
      meterOccupancy(42_100, { inputTokens: 900_000, outputTokens: 1 }),
    ).toBe(42_100);
  });

  it("falls back to cumulative input+output before any turn.end this visit", () => {
    expect(meterOccupancy(0, { inputTokens: 300, outputTokens: 200 })).toBe(
      500,
    );
    expect(meterOccupancy(0, null)).toBe(0);
    expect(
      meterOccupancy(Number.NaN, { inputTokens: 5, outputTokens: 0 }),
    ).toBe(5);
  });
});
