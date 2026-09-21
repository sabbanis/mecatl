// SPDX-License-Identifier: Apache-2.0

import type { ListScheduleFiresResponse } from "@mecatl-studio/contracts/generated";
import { describe, expect, it } from "vitest";
import { fireDurationMs, sortScheduleFires } from "./schedule-detail";

type Fire = ListScheduleFiresResponse["items"][number];

function fire(overrides: Partial<Fire> & Pick<Fire, "id">): Fire {
  return {
    deadline: "",
    error: "",
    firedAt: "",
    inFlight: false,
    progressAt: "",
    scheduleName: "daily",
    sessionId: "",
    startedAt: "",
    stop: "completed",
    ...overrides,
  };
}

describe("schedule fire history", () => {
  it("sorts by duration with newest fire as the tie break", () => {
    const items = [
      fire({
        firedAt: "2026-01-02T00:00:00.000Z",
        id: "newer",
        progressAt: "2026-01-02T00:00:02.000Z",
        startedAt: "2026-01-02T00:00:00.000Z",
      }),
      fire({
        firedAt: "2026-01-01T00:00:00.000Z",
        id: "older",
        progressAt: "2026-01-01T00:00:02.000Z",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
      fire({
        firedAt: "2026-01-03T00:00:00.000Z",
        id: "longest",
        progressAt: "2026-01-03T00:00:03.000Z",
        startedAt: "2026-01-03T00:00:00.000Z",
      }),
    ];

    expect(sortScheduleFires(items, "duration", "asc").map((item) => item.id)).toEqual([
      "newer",
      "older",
      "longest",
    ]);
  });

  it("uses the current time for an in-flight duration", () => {
    expect(
      fireDurationMs(
        fire({ id: "live", inFlight: true, startedAt: "2026-01-01T00:00:00.000Z" }),
        Date.parse("2026-01-01T00:00:04.500Z"),
      ),
    ).toBe(4_500);
  });
});
