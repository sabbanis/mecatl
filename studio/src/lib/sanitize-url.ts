// SPDX-License-Identifier: Apache-2.0

// Validates a customer-supplied logo / favicon URL: absolute http(s) only.
// Returns the input unchanged when valid, `undefined` otherwise.

const ALLOWED_PROTOCOLS = ["http:", "https:"] as const;

export function sanitizeBrandUrl(
  url: string | undefined | null,
): string | undefined {
  if (url == null) return undefined;
  if (url.trim() === "") return undefined;

  const trimmed = url.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (
    !ALLOWED_PROTOCOLS.includes(protocol as (typeof ALLOWED_PROTOCOLS)[number])
  ) {
    return undefined;
  }

  return url;
}
