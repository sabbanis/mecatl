import { describe, expect, it } from "vitest";
import {
  builtinSlashCommands,
  CLOSED_BUILTIN_GATES,
  classifySlashLine,
  isStudioBuiltinCommand,
  STUDIO_BUILTIN_COMMANDS,
} from "./composer-builtins";

/**
 * Pins the client-owned slash layer: the TUI's fixed palette order (minus
 * `/quit`), the capability gate hiding `/compact`, and the classifier that
 * decides — on the FIRST line only — whether a submission is a bare built-in
 * (run locally), a held built-in (arguments/second line), a gated-off one,
 * or ordinary text for the daemon.
 */

const OPEN = { manualCompaction: true };

describe("builtinSlashCommands", () => {
  it("lists the built-ins in the TUI's fixed order", () => {
    expect(builtinSlashCommands(OPEN).map((c) => c.name)).toEqual([
      "clear",
      "help",
      "session",
      "retry",
      "diagnostics",
      "compact",
    ]);
  });

  it("hides /compact when the daemon lacks manual compaction", () => {
    const names = builtinSlashCommands(CLOSED_BUILTIN_GATES).map((c) => c.name);
    expect(names).not.toContain("compact");
    expect(names).toEqual(["clear", "help", "session", "retry", "diagnostics"]);
  });

  it("documents every built-in with the TUI's description and the builtin mark", () => {
    expect(STUDIO_BUILTIN_COMMANDS).toHaveLength(6);
    for (const command of STUDIO_BUILTIN_COMMANDS) {
      expect(command.builtin).toBe(true);
      expect(command.description.length).toBeGreaterThan(0);
    }
    expect(
      STUDIO_BUILTIN_COMMANDS.find((c) => c.name === "retry")?.description,
    ).toBe(
      "retry the last eligible failed model step without resending its prompt",
    );
    expect(isStudioBuiltinCommand("quit")).toBe(false);
    expect(isStudioBuiltinCommand("clear")).toBe(true);
  });
});

describe("classifySlashLine", () => {
  it("runs a bare built-in", () => {
    expect(classifySlashLine("/clear", OPEN)).toEqual({
      kind: "builtin",
      name: "clear",
    });
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(classifySlashLine("/CLEAR ", OPEN)).toEqual({
      kind: "builtin",
      name: "clear",
    });
    expect(classifySlashLine("  /Help\n", OPEN)).toEqual({
      kind: "builtin",
      name: "help",
    });
  });

  it("holds a built-in typed with arguments", () => {
    expect(classifySlashLine("/clear now", OPEN)).toEqual({
      kind: "held",
      name: "clear",
      reason: "/clear takes no arguments — remove the text to run it",
    });
  });

  it("holds a built-in followed by a second line", () => {
    expect(classifySlashLine("/diagnostics\nmore", OPEN)).toMatchObject({
      kind: "held",
      name: "diagnostics",
    });
  });

  it("refuses a gated-off built-in with the daemon warning", () => {
    expect(classifySlashLine("/compact", CLOSED_BUILTIN_GATES)).toEqual({
      kind: "gated",
      name: "compact",
      reason: "/compact is not available on this daemon",
    });
    expect(classifySlashLine("/compact", OPEN)).toEqual({
      kind: "builtin",
      name: "compact",
    });
  });

  it("passes daemon workspace commands and ordinary text through", () => {
    expect(classifySlashLine("/deploy prod", OPEN)).toEqual({ kind: "pass" });
    expect(classifySlashLine("/review", OPEN)).toEqual({ kind: "pass" });
    expect(classifySlashLine("hello /clear", OPEN)).toEqual({ kind: "pass" });
    expect(classifySlashLine("/clearance", OPEN)).toEqual({ kind: "pass" });
    expect(classifySlashLine("", OPEN)).toEqual({ kind: "pass" });
  });
});
