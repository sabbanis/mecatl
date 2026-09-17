import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMemoryFootprint, MemoryFootprint } from "./memory-footprint";

/**
 * The footprint line above the memory table — the TUI's "N facts · M bytes ·
 * sha:…" aggregate — with every unreported part omitted rather than shown
 * as a zero.
 */
describe("formatMemoryFootprint", () => {
  it("renders count · bytes · a 12-hex digest prefix", () => {
    expect(
      formatMemoryFootprint({
        count: 3,
        sizeBytes: 64,
        sha256: "abcdef0123456789abcdef",
      }),
    ).toBe("3 facts · 64 bytes · sha256 abcdef012345");
  });

  it("singularises one fact", () => {
    expect(formatMemoryFootprint({ count: 1, sizeBytes: 12, sha256: "" })).toBe(
      "1 fact · 12 bytes",
    );
  });

  it("omits the parts the daemon did not report", () => {
    expect(formatMemoryFootprint({ count: 2, sizeBytes: 0, sha256: "" })).toBe(
      "2 facts",
    );
    expect(formatMemoryFootprint({ count: 0, sizeBytes: 0, sha256: "" })).toBe(
      "",
    );
  });
});

describe("MemoryFootprint", () => {
  it("shows the line with the full digest as its title", () => {
    render(
      <MemoryFootprint
        store={{ count: 1, sizeBytes: 64, sha256: "f".repeat(64) }}
      />,
    );
    const line = screen.getByTestId("memory-footprint");
    expect(line).toHaveTextContent("1 fact · 64 bytes · sha256 ffffffffffff");
    expect(line).toHaveAttribute("title", `sha256 ${"f".repeat(64)}`);
  });

  it("renders nothing when there is nothing to report", () => {
    render(<MemoryFootprint store={{ count: 0, sizeBytes: 0, sha256: "" }} />);
    expect(screen.queryByTestId("memory-footprint")).toBeNull();
  });
});
