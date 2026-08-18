/**
 * Extract a human-readable error message from an API error response.
 *
 * The registry server returns errors as `{ error: "message" }` or
 * `{ message: "..." }` objects. This utility handles both shapes
 * plus fallback for unknown formats.
 */
export function parseApiError(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;

    // { error: "message" } or { message: "message" }
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;

    // { field: "error1", field2: "error2" } — join all string values
    const values = Object.values(obj).filter(
      (v): v is string => typeof v === "string",
    );
    if (values.length > 0) return values.join(", ");
  }

  return fallback;
}
