import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_ENV_REFERENCE } from "@/lib/studio-config-reference";
import {
  CONFIGURED_UNAVAILABLE,
  ConfigReferenceCard,
} from "./config-reference-card";

/**
 * The configuration reference renders EVERY reference row from data before
 * the server answers, then fills the Status column from
 * `GET /api/studio/about` — Set / Set (hidden) / Unset — and degrades to
 * "unknown" with a plain note when that read fails. No cell ever shows a
 * value.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConfigReferenceCard", () => {
  it("lists every reference row with its tier before the server answers", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<ConfigReferenceCard />);
    const table = screen.getByRole("table", {
      name: "Studio configuration reference",
    });
    for (const entry of STUDIO_ENV_REFERENCE) {
      expect(table).toHaveTextContent(entry.name);
      expect(
        screen.getByTestId(`config-status-${entry.name}`),
      ).toHaveTextContent("checking…");
    }
    expect(screen.getAllByText("Server tier").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Local controller").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/studio/about",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fills Set, Set (hidden) for the secret, and Unset from the route's booleans", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        mode: "external",
        configured: {
          MECATL_BASE_URL: true,
          MECATL_AUTH_TOKEN: true,
          MECATL_OIDC_ISSUER: false,
        },
      }),
    );
    render(<ConfigReferenceCard />);
    await waitFor(() =>
      expect(
        screen.getByTestId("config-status-MECATL_BASE_URL"),
      ).toHaveTextContent("Set"),
    );
    expect(
      screen.getByTestId("config-status-MECATL_AUTH_TOKEN"),
    ).toHaveTextContent("Set (hidden)");
    expect(
      screen.getByTestId("config-status-MECATL_OIDC_ISSUER"),
    ).toHaveTextContent("Unset");
    // A name the route did not mention reads Unset, not blank.
    expect(
      screen.getByTestId("config-status-XDG_CONFIG_HOME"),
    ).toHaveTextContent("Unset");
    expect(screen.getByTestId("config-status-MECATL_BASE_URL")).toHaveAttribute(
      "data-configured",
      "true",
    );
    expect(screen.queryByText(CONFIGURED_UNAVAILABLE, { exact: false })).toBe(
      null,
    );
  });

  it("reads unknown with a plain note when the route cannot be read", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    render(<ConfigReferenceCard />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        CONFIGURED_UNAVAILABLE,
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("HTTP 503");
    expect(
      screen.getByTestId("config-status-MECATL_BASE_URL"),
    ).toHaveTextContent("unknown");
  });
});
