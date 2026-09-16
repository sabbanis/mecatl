/**
 * The controller's DIAGNOSTICS OPTIONS as the browser sees them through
 * /api/mecatl-control: the observability spawn flags of the MANAGED mecated
 * (log level, the loopback admin/metrics listener with its perf MCP mount
 * and goroutine alarm, product-metrics opt-out) plus the controller-side
 * `quiet` switch. The flag grammar itself lives in
 * `src/lib/controller-diagnostics-options.mjs`; this module only moves the
 * document. Nothing here is a credential.
 *
 * The operator POSTURE is deliberately NOT part of this document — it is
 * the permissions document (`fetchHarnessPermissions` /
 * `saveHarnessPermissions`), and one spawn flag with two writers would be
 * a bug. The Diagnostics page's posture card READS the daemon's effective
 * tier off `serverCapabilities.posture` and links to Permissions to change
 * it.
 */

import { apiError } from "./errors";

const CONTROL_API = "/api/mecatl-control";

export interface HarnessDiagnosticsOptions {
  /** mecated's `--log-level`: debug | info | warn | error. */
  logLevel: string;
  /** Controller-side only: stop mirroring mecated's stderr onto the
   *  controller's (no daemon flag, no restart). */
  quiet: boolean;
  admin: {
    /** Open the loopback admin listener (`--metrics-addr`, the controller
     *  picks the port); off = the endpoint is explicitly disabled. */
    enabled: boolean;
    /** Mount the read-only perf MCP server on it (`--perf-mcp`). */
    perfMcp: boolean;
    /** `--goroutine-warn-threshold`; 0 = the alarm is off. */
    goroutineWarnThreshold: number;
  };
  productMetrics: {
    /** The SAVED switch (`--product-metrics=false` when off). */
    enabled: boolean;
    /** `--product-metrics-dry-run`. */
    dryRun: boolean;
  };
}

/** A partial document: name only the fields to change. */
export interface HarnessDiagnosticsPatch {
  logLevel?: string;
  quiet?: boolean;
  admin?: Partial<HarnessDiagnosticsOptions["admin"]>;
  productMetrics?: Partial<HarnessDiagnosticsOptions["productMetrics"]>;
}

export interface HarnessDiagnosticsState {
  /** The saved document the managed daemon was spawned with. */
  options: HarnessDiagnosticsOptions;
  productMetrics: {
    /** Whether product metrics are actually on: the saved switch AND no
     *  environment opt-out on the controller (mecated reads the inherited
     *  DO_NOT_TRACK / MECATL_PRODUCT_METRICS regardless of Studio's flag). */
    effective: boolean;
    /** "environment" when the controller's env opts out — the switch in the
     *  UI cannot turn them back on from here. */
    source: "studio" | "environment";
  };
}

/** Decodes the controller's document; null when it is not one. */
export function readDiagnosticsOptions(
  raw: unknown,
): HarnessDiagnosticsOptions | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as {
    logLevel?: unknown;
    quiet?: unknown;
    admin?: {
      enabled?: unknown;
      perfMcp?: unknown;
      goroutineWarnThreshold?: unknown;
    } | null;
    productMetrics?: { enabled?: unknown; dryRun?: unknown } | null;
  };
  const threshold = Number(body.admin?.goroutineWarnThreshold ?? 0);
  return {
    logLevel: typeof body.logLevel === "string" ? body.logLevel : "info",
    quiet: body.quiet === true,
    admin: {
      enabled: body.admin?.enabled === true,
      perfMcp: body.admin?.perfMcp === true,
      goroutineWarnThreshold:
        Number.isInteger(threshold) && threshold > 0 ? threshold : 0,
    },
    productMetrics: {
      // Absent = on: mecated's default, and the field a pre-feature
      // controller never wrote.
      enabled: body.productMetrics?.enabled !== false,
      dryRun: body.productMetrics?.dryRun === true,
    },
  };
}

/**
 * The saved document plus the effective product-metrics verdict. Null when
 * the controller cannot answer — external mode's 409 (the deployment owns
 * its daemon's flags) or an older controller without the route — so the
 * caller renders the managed/unsupported note rather than a form.
 */
export async function fetchHarnessDiagnosticsOptions(
  signal?: AbortSignal,
): Promise<HarnessDiagnosticsState | null> {
  const response = await fetch(`${CONTROL_API}/diagnostics-options`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    options?: unknown;
    productMetrics?: { enabled?: unknown; source?: unknown } | null;
  };
  const options = readDiagnosticsOptions(body.options);
  if (!options) return null;
  const source =
    body.productMetrics?.source === "environment" ? "environment" : "studio";
  return {
    options,
    productMetrics: {
      effective:
        typeof body.productMetrics?.enabled === "boolean"
          ? body.productMetrics.enabled
          : options.productMetrics.enabled && source === "studio",
      source,
    },
  };
}

/**
 * Applies a PARTIAL document. A change to anything but `quiet` RESTARTS
 * the daemon (in-flight runs end); a start mecated refuses is rolled back
 * by the controller and surfaces here as the thrown HarnessApiError with
 * mecated's own words. Resolves to the controller's echo of the saved
 * document (null when it sent none).
 */
export async function saveHarnessDiagnosticsOptions(
  patch: HarnessDiagnosticsPatch,
): Promise<HarnessDiagnosticsOptions | null> {
  const response = await fetch(`${CONTROL_API}/diagnostics-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await apiError(response);
  const answer = (await response.json().catch(() => null)) as {
    options?: unknown;
  } | null;
  return readDiagnosticsOptions(answer?.options);
}
