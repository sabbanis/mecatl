/**
 * Browser-side client for the durable session watch
 * (`GET /v1/sessions/{id}/watch`, ADR 0250): SSE frames whose `data:` payload
 * is a `{event, cursor, phase}` envelope — replay of what is already durable,
 * one event-less boundary frame with phase "live", then live follow.
 *
 * Like client.ts this module owns TRANSPORT only; all wire decoding lives in
 * the protocol seam. It has its own SSE parser because the watch route uses
 * `event:`-tagged frames for terminal faults — the prompt stream's parser
 * only ever looks at `data:` lines and would silently drop them, which is
 * exactly the failure the tagged frame exists to abolish.
 */

import type { StreamEvent } from "@/features/agent/types";
import { parseWatchEnvelope, translateEvent } from "@/lib/protocol";
import { apiError, HARNESS_API } from "./client";

/** One decoded SSE frame: the (optional) `event:` tag and the joined `data:`
 *  payload. Frames with no data lines carry nothing and decode to null. */
export interface SSEFrame {
  event: string;
  data: string;
}

/**
 * Parses one SSE frame block (the text between blank-line separators) per the
 * EventSource grammar: `field: value` lines split at the first colon, one
 * optional leading space stripped from the value, multiple `data:` lines
 * joined with newlines, comment lines (leading colon) ignored.
 */
export function parseSSEFrame(block: string): SSEFrame | null {
  let event = "";
  const data: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

/**
 * A watch that ended on a stream fault, typed on the daemon's stable machine
 * code (mid-stream faults ride an `event: error` frame — the 200 is already
 * committed, so the status code is spent). The codes a caller branches on:
 * - `watch_lagging`: resumable — the client fell behind; reconnect from the
 *   last cursor (this module already retried its bounded budget).
 * - `activity_gap`: recorded events are missing; refetch the transcript.
 * - `cursor_expired`: the cursor is from a superseded log generation; refetch
 *   the transcript and restart from the beginning.
 */
export class WatchStreamError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WatchStreamError";
    this.code = code;
  }
}

/** One delivery to the watch consumer. */
export interface WatchDelivery {
  /** Open string: "replay" | "live" | "gap" — tolerate unknown values. */
  phase: string;
  /** Opaque resume cursor positioned AFTER this envelope. */
  cursor: string;
  /** Null on event-less frames — the replay→live boundary (phase "live") and
   *  gap markers (phase "gap") — and on envelopes whose event kinds have no
   *  visual surface (the cursor still advances). */
  event: StreamEvent | null;
}

export interface WatchOptions {
  /** Resume cursor; empty/absent = from the beginning (the normal first
   *  attachment). A cursor is scoped to the runId it was issued under. */
  cursor?: string;
  /** Narrows delivery to one run's events (ADR 0249). */
  runId?: string;
  signal?: AbortSignal;
  /** Budget for RESUMABLE faults (watch_lagging, idle timeout, a dropped
   *  connection); any delivered frame refills it. */
  maxReconnects?: number;
}

/** Mirrors client.ts's stream idle timeout: the watch route sends no
 *  keepalives, so a silent stretch (a parked approval can sit for hours) is
 *  handled by reconnecting from the last cursor, never by failing the UI. */
const WATCH_IDLE_TIMEOUT_MS = 120_000;

const DEFAULT_MAX_RECONNECTS = 5;

/** Sentinel distinguishing the idle race from real read errors. */
const idleTimeout = Symbol("watch-idle-timeout");

async function readOrIdle<T>(
  read: Promise<T>,
): Promise<T | typeof idleTimeout> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof idleTimeout>((resolve) => {
    timer = setTimeout(() => resolve(idleTimeout), WATCH_IDLE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attaches a durable watch and delivers every envelope to `onDelivery` until
 * the caller aborts (resolves quietly) or the watch faults (throws).
 *
 * Resumable faults — `watch_lagging`, the idle timeout, a connection the
 * daemon dropped without a terminal frame (e.g. a restart) — reconnect from
 * the last processed cursor, bounded by `maxReconnects` per silent stretch
 * (any delivered frame refills the budget). Non-resumable faults throw
 * immediately: `activity_gap` / `cursor_expired` as WatchStreamError (the
 * caller falls back to a transcript refetch), pre-stream refusals as
 * HarnessApiError (`no_event_log` / `watch_unsupported` / 404 / 400).
 */
export async function watchSessionEvents(
  sessionId: string,
  onDelivery: (delivery: WatchDelivery) => void,
  options?: WatchOptions,
): Promise<void> {
  const signal = options?.signal;
  const maxReconnects = options?.maxReconnects ?? DEFAULT_MAX_RECONNECTS;
  let cursor = options?.cursor ?? "";
  let reconnectsLeft = maxReconnects;

  // Each iteration is one connection attempt; `continue` reconnects from the
  // last processed cursor after a resumable fault.
  while (true) {
    if (signal?.aborted) return;
    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    if (options?.runId) query.set("run_id", options.runId);
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    let response: Response;
    try {
      response = await fetch(
        `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/watch${suffix}`,
        { signal, cache: "no-store" },
      );
    } catch (caught) {
      // A caller-initiated abort resolves quietly; a real network fault
      // (daemon offline) propagates — the connection gate owns that state.
      if (signal?.aborted) return;
      throw caught;
    }
    // Pre-stream refusals are real HTTP statuses with a problem body: a
    // missing feature (501 no_event_log / watch_unsupported), an unknown
    // session (404), a delegation-child id (400). Never retried here.
    if (!response.ok) throw await apiError(response);
    if (!response.body) throw new Error("harness returned no event stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stalled = false;
    try {
      while (true) {
        const result = await readOrIdle(reader.read());
        if (result === idleTimeout) {
          // No keepalives on this route: silence is ambiguous between a
          // genuinely quiet session and a dead socket. Reconnecting from the
          // cursor is correct in both cases (at-least-once delivery).
          stalled = true;
          break;
        }
        if (result.done) {
          // The daemon never ends a healthy watch — a clean close without a
          // terminal frame is a restart or a dropped proxy. Resumable.
          stalled = true;
          break;
        }
        buffer += decoder.decode(result.value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const frame = parseSSEFrame(block);
          if (!frame) continue;
          if (frame.event === "error") {
            // Terminal fault after the 200: {code, error} on the data line.
            let code = "";
            let detail = frame.data;
            try {
              const body = JSON.parse(frame.data) as {
                code?: string;
                error?: string;
              };
              code = typeof body.code === "string" ? body.code : "";
              detail = body.error ?? frame.data;
            } catch {
              // A malformed fault frame still terminates; code stays "".
            }
            if (code === "watch_lagging") {
              // Resumable by contract: reconnect from the last processed
              // cursor. The shared budget check at the bottom bounds it.
              stalled = true;
              break;
            }
            throw new WatchStreamError(code, detail);
          }
          let delivered: WatchDelivery[];
          try {
            const envelope = parseWatchEnvelope(frame.data);
            const events = envelope.event
              ? translateEvent(envelope.event, sessionId)
              : [];
            delivered =
              events.length > 0
                ? events.map((event) => ({
                    phase: envelope.phase,
                    cursor: envelope.cursor,
                    event,
                  }))
                : [
                    // Event-less frames (the live boundary, gap markers) and
                    // envelopes whose kinds render nothing still advance the
                    // caller's cursor and carry the phase.
                    {
                      phase: envelope.phase,
                      cursor: envelope.cursor,
                      event: null,
                    },
                  ];
          } catch {
            // A frame this Studio version cannot decode is surfaced to the
            // caller as an unrenderable notice, never silently dropped.
            delivered = [
              {
                phase: "",
                cursor,
                event: {
                  type: "notice",
                  text: "Mecatl sent a watch frame this Studio version could not decode.",
                },
              },
            ];
          }
          for (const delivery of delivered) {
            if (delivery.cursor) cursor = delivery.cursor;
            onDelivery(delivery);
          }
          // Progress proves the wire is healthy; refill the retry budget.
          reconnectsLeft = maxReconnects;
        }
        if (stalled) break;
      }
    } catch (caught) {
      if (signal?.aborted) return;
      if (caught instanceof WatchStreamError) throw caught;
      // A network read error mid-stream is resumable, like a dropped socket.
      stalled = true;
    } finally {
      reader.cancel().catch(() => undefined);
    }
    if (signal?.aborted) return;
    if (!stalled) return;
    if (reconnectsLeft <= 0) {
      throw new WatchStreamError(
        "watch_lagging",
        "The watch kept stalling and its reconnect budget is spent.",
      );
    }
    reconnectsLeft -= 1;
  }
}
