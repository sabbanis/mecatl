import { describe, expect, it } from "vitest";
import {
  normalizeToolProfile,
  SHELL_DISABLED_NOTE,
  shellDisabledOnDaemon,
  TOOL_PROFILE_OPTIONS,
  toolProfileLabel,
  toolProfilePillSuffix,
} from "./tool-profile";

/**
 * The tool-profile vocabulary the composer's Tools rows, the schedule form
 * and the detail badges share: the closed `"" | "no-fs"` set, its labels,
 * the pill suffix, and the daemon-wide shell-off gate.
 */
describe("tool profile vocabulary", () => {
  it("offers exactly the daemon's two profiles, default first", () => {
    expect(TOOL_PROFILE_OPTIONS.map((o) => o.id)).toEqual(["", "no-fs"]);
    expect(TOOL_PROFILE_OPTIONS[0].label).toBe("All");
    expect(TOOL_PROFILE_OPTIONS[1].label).toBe("None");
    // The description names the tools that leave AND what stays.
    expect(TOOL_PROFILE_OPTIONS[1].description).toMatch(
      /No file or shell tools/,
    );
    expect(TOOL_PROFILE_OPTIONS[1].description).toMatch(/web tools only/);
  });

  it("labels each profile and falls back to All", () => {
    expect(toolProfileLabel("")).toBe("All");
    expect(toolProfileLabel("no-fs")).toBe("None");
  });

  it("narrows an untrusted value to the closed set", () => {
    expect(normalizeToolProfile("no-fs")).toBe("no-fs");
    expect(normalizeToolProfile("")).toBe("");
    expect(normalizeToolProfile("NO-FS")).toBe("");
    expect(normalizeToolProfile(undefined)).toBe("");
    expect(normalizeToolProfile(42)).toBe("");
  });

  it("suffixes the pill only for the attenuated profile", () => {
    expect(toolProfilePillSuffix("")).toBe("");
    expect(toolProfilePillSuffix("no-fs")).toBe(" · None");
  });

  it("reports shell-off only on an explicit bash:false (absent = unknown)", () => {
    expect(shellDisabledOnDaemon({ bash: false })).toBe(true);
    expect(shellDisabledOnDaemon({ bash: true })).toBe(false);
    expect(shellDisabledOnDaemon({})).toBe(false);
    expect(shellDisabledOnDaemon(null)).toBe(false);
    expect(shellDisabledOnDaemon(undefined)).toBe(false);
    expect(SHELL_DISABLED_NOTE).toBe("Shell is disabled on this daemon");
  });
});
