/**
 * Tolerant field readers shared by the daemon wire modules that decode
 * stdlib-JSON-encoded proto messages (learning, learned skills, dream,
 * storage health).
 *
 * The daemon marshals these responses with Go's encoding/json over the
 * generated proto structs, so keys are snake_case proto field names, absent
 * means zero-value (omitempty), and google.protobuf.Timestamp arrives as the
 * struct `{seconds, nanos}` — NOT the protojson RFC 3339 string. Every reader
 * here degrades to a zero value rather than throwing, so a shape drift renders
 * as missing data, never a broken page.
 */

export function asString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function asNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function asBool(raw: unknown): boolean {
  return raw === true;
}

export function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

export function asStringArray(raw: unknown): string[] {
  return asArray(raw).filter(
    (item): item is string => typeof item === "string",
  );
}

/** Unix seconds off a stdlib-JSON proto Timestamp (`{seconds, nanos}`). */
export function timestampUnix(raw: unknown): number {
  return asNumber(asRecord(raw).seconds);
}
