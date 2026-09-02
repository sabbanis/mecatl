import { HarnessApiError } from "./client";

/**
 * The safe server-identity probe (GET /v1/info, ADR 0245): an opaque build
 * id, the composition family (mecated / mecak8s / embedded), and — when a
 * provider id is named — a sanitized provider endpoint projection. Explicitly
 * designed for client About/bug-report surfaces; the only daemon-side
 * identity available in external mode. Returns null against an older daemon
 * (404).
 */
export interface HarnessServerInfo {
  buildId: string;
  serverImplementation: string;
  providerEndpoint: string;
}

export async function fetchHarnessServerInfo(
  providerId?: string,
  signal?: AbortSignal,
): Promise<HarnessServerInfo | null> {
  const query = providerId
    ? `?provider_id=${encodeURIComponent(providerId)}`
    : "";
  const response = await fetch(`/api/mecatl/v1/info${query}`, {
    signal,
    cache: "no-store",
  });
  if (response.status === 404) return null; // pre-ADR-0245 daemon
  if (!response.ok) {
    throw new HarnessApiError(
      response.status,
      "",
      `${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as {
    build_id?: string;
    server_implementation?: string;
    llm_provider_display_endpoint?: string;
  };
  return {
    buildId: body.build_id ?? "",
    serverImplementation: body.server_implementation ?? "",
    providerEndpoint: body.llm_provider_display_endpoint ?? "",
  };
}
