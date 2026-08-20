import { describe, expect, it } from "vitest";
import { splitPendingSteersOnWatermark } from "./use-agent-chat";

const pending = [
  { id: "steer-1", text: "first" },
  { id: "steer-2", text: "second" },
  { id: "steer-3", text: "third" },
];

describe("splitPendingSteersOnWatermark", () => {
  it("drops every pending steer up to and including the watermark, keeping the tail", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-2")).toEqual([
      { id: "steer-3", text: "third" },
    ]);
  });

  it("clears the whole list when the watermark is the last pending steer", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-3")).toEqual([]);
  });

  it("clears the whole list on an empty watermark — the daemon's FIFO is authoritative", () => {
    expect(splitPendingSteersOnWatermark(pending, "")).toEqual([]);
  });

  it("clears the whole list on an unmatched watermark rather than text-matching", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-unknown")).toEqual([]);
  });

  it("leaves an empty list empty", () => {
    expect(splitPendingSteersOnWatermark([], "steer-1")).toEqual([]);
  });
});
