/**
 * Pure helpers behind the Performance card (Settings → Diagnostics): reading
 * mecated's Prometheus `/metrics` text — relayed by the controller, since the
 * browser's CSP (`connect-src 'self'`) never lets it reach the loopback
 * admin listener itself — into the handful of runtime gauges the card
 * tiles, and printing the paste-ready `.mcp.json` snippet for the perf MCP
 * server exactly as `mecated perf-mcp print-config` does
 * (cmd/mecated/main.go `runPerfMCPPrintConfig`), so a Studio user and a CLI
 * user paste the same bytes.
 */

/** A Prometheus metric name (the exposition format's `[a-zA-Z_:][a-zA-Z0-9_:]*`). */
const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

/**
 * The un-labelled samples of a Prometheus text exposition, by series name.
 * `# HELP`/`# TYPE`/comment lines are skipped, and so is every LABELLED
 * series (`name{...} value`): the card wants process-wide gauges and
 * counters (`go_goroutines`, `go_memstats_heap_alloc_bytes`, …), and a
 * labelled family (histogram buckets, per-tool counters) has no single
 * value to tile. A trailing timestamp is ignored; a sample whose value is
 * not a finite number (`NaN`, `+Inf`) is dropped rather than tiled as
 * garbage. Malformed lines are skipped, never thrown on — the text is
 * produced by the daemon, but the card must survive a truncated relay.
 */
export function parsePrometheusText(text: string): Map<string, number> {
  const series = new Map<string, number>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    // `name value [timestamp]`; anything with `{` is a labelled series.
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [name, value] = parts;
    if (!METRIC_NAME.test(name)) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    series.set(name, parsed);
  }
  return series;
}

/** The four runtime figures the card tiles; each absent when the daemon's
 *  exposition lacks the series (an older build, or a collector turned off). */
export interface PerfSnapshot {
  /** `go_goroutines` — the live goroutine count the leak alarm watches. */
  goroutines?: number;
  /** `go_memstats_heap_alloc_bytes` — heap bytes in use right now. */
  heapBytes?: number;
  /** `process_resident_memory_bytes` — the process's RSS. */
  rssBytes?: number;
  /** `go_gc_duration_seconds_sum` — total GC pause time since start. */
  gcPauseTotalSeconds?: number;
}

/** The series each tile reads, in the order the card shows them. */
export const PERF_SNAPSHOT_SERIES: Readonly<
  Record<keyof PerfSnapshot, string>
> = Object.freeze({
  goroutines: "go_goroutines",
  heapBytes: "go_memstats_heap_alloc_bytes",
  rssBytes: "process_resident_memory_bytes",
  gcPauseTotalSeconds: "go_gc_duration_seconds_sum",
});

/** Picks the tiled figures out of a parsed exposition. */
export function perfSnapshot(series: Map<string, number>): PerfSnapshot {
  const snapshot: PerfSnapshot = {};
  for (const [key, name] of Object.entries(PERF_SNAPSHOT_SERIES) as [
    keyof PerfSnapshot,
    string,
  ][]) {
    const value = series.get(name);
    if (value !== undefined) snapshot[key] = value;
  }
  return snapshot;
}

/** The MCP server name mecated prints (and its docs tell users to expect). */
export const PERF_MCP_SERVER_NAME = "mecatl-perf";

/**
 * The `.mcp.json` snippet `mecated perf-mcp print-config --metrics-addr
 * <addr>` prints, byte for byte: Go's `json.Encoder` with a two-space
 * indent and a trailing newline, no headers/Authorization field (the perf
 * MCP is unauthenticated by design and loopback only). `adminAddr` is the
 * listener's `host:port`; a full `http://…` origin is accepted too, so the
 * caller can pass the controller's `adminUrl` straight through.
 */
export function perfMcpConfig(adminAddr: string): string {
  const addr = adminAddr.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const config = {
    mcpServers: {
      [PERF_MCP_SERVER_NAME]: { type: "http", url: `http://${addr}/mcp` },
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}
