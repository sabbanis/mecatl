import { describe, expect, it } from "vitest";
import {
  PERF_MCP_SERVER_NAME,
  PERF_SNAPSHOT_SERIES,
  parsePrometheusText,
  perfMcpConfig,
  perfSnapshot,
} from "./prometheus-text";

/**
 * The Performance card's pure half: the Prometheus text reader keeps only
 * un-labelled finite samples (comments, labelled families, NaN/Inf and
 * malformed lines are skipped, never thrown on), `perfSnapshot` picks the
 * four tiled series and leaves the rest absent, and `perfMcpConfig` prints
 * the SAME bytes as `mecated perf-mcp print-config` (cmd/mecated/main.go
 * runPerfMCPPrintConfig: Go's json.Encoder, two-space indent, trailing
 * newline, no headers field).
 */

const sample = [
  "# HELP go_goroutines Number of goroutines that currently exist.",
  "# TYPE go_goroutines gauge",
  "go_goroutines 143",
  "# TYPE go_gc_duration_seconds summary",
  'go_gc_duration_seconds{quantile="0"} 0.000021',
  'go_gc_duration_seconds{quantile="1"} 0.0012',
  "go_gc_duration_seconds_sum 0.0421",
  "go_gc_duration_seconds_count 37",
  "go_memstats_heap_alloc_bytes 1.8350080e+07",
  "process_resident_memory_bytes 73400320 1726000000000",
  'mecatl_tool_calls_total{tool="Read"} 12',
  "go_memstats_gc_cpu_fraction NaN",
  "go_info +Inf",
  "not a metric line at all",
  "",
].join("\n");

describe("parsePrometheusText", () => {
  it("keeps un-labelled finite samples, skipping comments, labelled series, NaN/Inf and junk", () => {
    const series = parsePrometheusText(sample);
    expect(series.get("go_goroutines")).toBe(143);
    expect(series.get("go_gc_duration_seconds_sum")).toBeCloseTo(0.0421);
    expect(series.get("go_gc_duration_seconds_count")).toBe(37);
    expect(series.get("go_memstats_heap_alloc_bytes")).toBe(18_350_080);
    // A trailing timestamp is ignored, not glued onto the value.
    expect(series.get("process_resident_memory_bytes")).toBe(73_400_320);
    expect(series.has("go_gc_duration_seconds")).toBe(false);
    expect(series.has("mecatl_tool_calls_total")).toBe(false);
    expect(series.has("go_memstats_gc_cpu_fraction")).toBe(false);
    expect(series.has("go_info")).toBe(false);
    expect(series.has("not")).toBe(false);
  });

  it("survives CRLF, leading whitespace and an empty exposition", () => {
    expect(parsePrometheusText("")).toEqual(new Map());
    expect(parsePrometheusText("  go_goroutines 7\r\n# done\r\n")).toEqual(
      new Map([["go_goroutines", 7]]),
    );
  });
});

describe("perfSnapshot", () => {
  it("picks the four tiled series and leaves a missing one absent", () => {
    expect(perfSnapshot(parsePrometheusText(sample))).toEqual({
      goroutines: 143,
      heapBytes: 18_350_080,
      rssBytes: 73_400_320,
      gcPauseTotalSeconds: 0.0421,
    });
    expect(perfSnapshot(new Map([["go_goroutines", 9]]))).toEqual({
      goroutines: 9,
    });
    expect(perfSnapshot(new Map())).toEqual({});
  });

  it("reads exactly the series mecated's runtime collector exports", () => {
    expect(PERF_SNAPSHOT_SERIES).toEqual({
      goroutines: "go_goroutines",
      heapBytes: "go_memstats_heap_alloc_bytes",
      rssBytes: "process_resident_memory_bytes",
      gcPauseTotalSeconds: "go_gc_duration_seconds_sum",
    });
  });
});

describe("perfMcpConfig", () => {
  // `mecated perf-mcp print-config --metrics-addr 127.0.0.1:41234`, captured
  // verbatim: json.Encoder.SetIndent("", "  ") + Encode's trailing newline.
  const printed = [
    "{",
    '  "mcpServers": {',
    '    "mecatl-perf": {',
    '      "type": "http",',
    '      "url": "http://127.0.0.1:41234/mcp"',
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");

  it("prints mecated's snippet byte for byte from a host:port", () => {
    expect(perfMcpConfig("127.0.0.1:41234")).toBe(printed);
    expect(PERF_MCP_SERVER_NAME).toBe("mecatl-perf");
  });

  it("accepts the controller's http:// adminUrl and never emits a headers field", () => {
    expect(perfMcpConfig("http://127.0.0.1:41234")).toBe(printed);
    expect(perfMcpConfig("http://127.0.0.1:41234/")).toBe(printed);
    expect(printed).not.toMatch(/headers|Authorization/);
  });
});
