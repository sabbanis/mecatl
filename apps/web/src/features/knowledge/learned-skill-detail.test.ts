// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { diffLineKind } from "./learned-skill-detail";

describe("learned-skill diff", () => {
  it("classifies unified diff lines without treating file headers as changes", () => {
    expect(diffLineKind("+new instruction")).toBe("addition");
    expect(diffLineKind("-old instruction")).toBe("deletion");
    expect(diffLineKind("+++ b/SKILL.md")).toBe("metadata");
    expect(diffLineKind("--- a/SKILL.md")).toBe("metadata");
    expect(diffLineKind("@@ -1 +1 @@")).toBe("metadata");
    expect(diffLineKind(" unchanged")).toBe("context");
  });
});
