// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { clampPanelWidth, maxPanelWidth, minPanelWidth } from "./panel-width";

describe("panel width", () => {
  it("clamps and rounds requested widths", () => {
    expect(clampPanelWidth(100)).toBe(minPanelWidth);
    expect(clampPanelWidth(900)).toBe(maxPanelWidth);
    expect(clampPanelWidth(301.6)).toBe(302);
  });
});
