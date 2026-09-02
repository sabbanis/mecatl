/** Shared structural-decode helpers for the wire seam. Not exported by index. */

export type UnknownRecord = Record<string, unknown>;

export const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

export const optionalString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const optionalNumber = (value: unknown) =>
  typeof value === "number" ? value : undefined;

export const numeric = (value: unknown) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const booleanFlag = (value: unknown) => value === true;

export function stringFields(value: unknown, names: string[]) {
  const source = asRecord(value);
  if (!source) return undefined;
  return Object.fromEntries(
    names.map((name) => [name, optionalString(source[name])]),
  ) as Record<string, string | undefined>;
}

// A Timestamp is {seconds,nanos} under stdlib encoding/json and an RFC 3339
// string under protojson. The zero time has no wire form, so absent, zero, and
// unparseable all collapse to null — "no next fire" is a real state (a
// one-shot that fired, a cron past max_fires) and must not read as 1970.
export function protoMillis(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  }
  const timestamp = asRecord(value);
  const seconds = Number(timestamp?.seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds === 0) return null;
  const nanos = Number(timestamp?.nanos ?? 0);
  return (
    seconds * 1000 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6)
  );
}

// A Duration is {seconds,nanos} under stdlib encoding/json and a "1.5s" string
// under protojson. Returned in seconds because that is the unit the proto field
// is documented in and the unit the request form has to send back.
export function protoSeconds(value: unknown): number {
  if (typeof value === "string") return numeric(value.replace(/s$/, ""));
  const duration = asRecord(value);
  if (!duration) return 0;
  return numeric(duration.seconds) + numeric(duration.nanos) / 1e9;
}

// An enum arrives as a NUMBER under stdlib encoding/json (what mecated's HTTP
// surface uses) and as its SCREAMING_CASE name under protojson (what a relay in
// front of it may use). Both normalise to the number the UI switches on, so a
// proxied deployment does not render every posture as "unset".
export const enumNumber = (value: unknown, names: Record<string, number>) =>
  typeof value === "string" ? (names[value] ?? 0) : numeric(value);
