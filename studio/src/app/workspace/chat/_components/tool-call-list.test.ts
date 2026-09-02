import { describe, expect, it } from "vitest";
import { activitySummary } from "./tool-call-list";

const call = (status: "running" | "completed" | "failed") => ({ status });

/**
 * The collapsed "Activity" line's text: the count fragment, pluralized only
 * past one call.
 */
describe("activitySummary", () => {
  it("counts every call regardless of status", () => {
    expect(activitySummary([call("completed"), call("running")])).toEqual({
      tools: "2 tools",
    });
  });

  it("pluralizes only the tool count", () => {
    expect(activitySummary([call("failed")]).tools).toBe("1 tool");
  });
});
