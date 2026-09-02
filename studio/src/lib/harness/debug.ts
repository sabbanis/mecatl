/**
 * AI session debugger — ADR 0254.
 *
 * Wire: `POST /v1/sessions` with `debug_target_session_id` creates a SEPARATE
 * durable diagnostic session bound to one stored target. The daemon requires
 * `profile: "no-fs"` and an EMPTY workspace (the debug engine has exactly one
 * read-only tool, InspectSession, and never touches a filesystem), authorizes
 * the target server-side before creating anything (an unowned or unknown
 * target answers 404 — ownership failures are concealed as not-found), and
 * never copies target conversation state. The new session then opens and runs
 * like an ordinary chat; its inventory row carries
 * `relationship.debug_target_session_id` plus capabilities that deny
 * rename/delete. Gated by `capabilities.session_debug` (and the optional
 * server list by `capabilities.debug_mcp`).
 *
 * CONSENT: invoking the debugger sends the target's stored transcript and
 * event evidence — everything in it, secrets included — to the selected model.
 * Callers must put the ADR-0254 disclosure in front of the user BEFORE calling
 * this; this module only speaks the wire.
 *
 * The `workspace: ""` is explicit rather than omitted: it states the daemon's
 * empty-workspace contract on the wire, and the server proxy's workspace
 * injection (src/lib/server-proxy.ts) skips no-fs/debug creates so the empty
 * value actually survives to the daemon.
 */

import { apiError, HARNESS_API } from "./client";

/** Creates a debug session bound to `targetSessionId`; returns the new id. */
export async function createHarnessDebugSession(
  targetSessionId: string,
  options?: {
    /** Optional debug MCP server names (gated by `capabilities.debug_mcp`). */
    mcpServers?: string[];
    signal?: AbortSignal;
  },
): Promise<string> {
  const response = await fetch(`${HARNESS_API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "default",
      profile: "no-fs",
      workspace: "",
      debug_target_session_id: targetSessionId,
      ...(options?.mcpServers?.length
        ? { debug_mcp_servers: options.mcpServers }
        : {}),
    }),
    signal: options?.signal,
  });
  if (!response.ok) throw await apiError(response);
  const body = (await response.json()) as { session_id?: string };
  if (!body.session_id) throw new Error("harness returned no session id");
  return body.session_id;
}
