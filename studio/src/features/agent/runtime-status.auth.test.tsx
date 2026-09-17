import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetHarnessClient } from "@/lib/harness/sdk";
import { jsonResponse, stubHarnessFetch } from "@/lib/harness/sdk-test-stub";
import { RuntimeStatusProvider, useRuntimeStatus } from "./runtime-status";

/**
 * The runtime-status provider's banner choice: a probe that fails because
 * Studio's credential was refused renders the auth-recovery banner (named
 * cause, Sign in, settings link) INSTEAD of the generic "Mecatl is
 * unreachable." strip; a daemon that is genuinely down keeps that strip; and
 * the callback page's `mecatl-oidc` message re-probes at once, so the
 * connection flips back without waiting for the 5-second poll.
 */

vi.mock("./composer-capabilities", () => ({
  refreshComposerCapabilities: vi.fn(async () => undefined),
}));

function CauseProbe() {
  const { state, offlineCause } = useRuntimeStatus();
  return (
    <output data-testid="probe">
      {state}:{offlineCause?.kind ?? "none"}
    </output>
  );
}

const oidcStatus = (over: Record<string, unknown> = {}) =>
  jsonResponse(200, {
    configured: true,
    state: "expired",
    issuer: "https://idp.example.com",
    ...over,
  });

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetHarnessClient();
});

describe("RuntimeStatusProvider offline cause", () => {
  it("renders the auth-recovery banner, not 'unreachable', when the proxy answers 401 oidc_session_expired", async () => {
    stubHarnessFetch((request) => {
      if (request.path === "/api/auth/oidc/status") return oidcStatus();
      if (request.path === "/v1/models")
        return jsonResponse(401, {
          code: "oidc_session_expired",
          error:
            "The OIDC session expired — sign in again from Settings to keep using this deployment.",
        });
      return undefined;
    });
    render(
      <RuntimeStatusProvider>
        <CauseProbe />
      </RuntimeStatusProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "offline:session-expired",
      ),
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Session expired");
    expect(alert).not.toHaveTextContent("Mecatl is unreachable.");
    expect(
      screen.getByRole("link", { name: "Open sign-in settings" }),
    ).toHaveAttribute("href", "/workspace/settings/provider");
    expect(
      await screen.findByRole("button", { name: "Sign in again" }),
    ).toBeInTheDocument();
  });

  it("names a daemon 401 as a rejected credential with the env remediation", async () => {
    stubHarnessFetch((request) => {
      if (request.path === "/api/auth/oidc/status")
        return oidcStatus({ configured: false, state: "not-configured" });
      if (request.path === "/v1/models")
        return jsonResponse(401, {
          code: "unauthenticated",
          error: "missing or invalid bearer token",
        });
      return undefined;
    });
    render(
      <RuntimeStatusProvider>
        <CauseProbe />
      </RuntimeStatusProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "offline:credential-rejected",
      ),
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Credential rejected");
    expect(alert).toHaveTextContent(/MECATL_AUTH_TOKEN/);
    expect(
      screen.queryByRole("button", { name: /Sign in/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the plain 'Mecatl is unreachable.' strip for a daemon that is down", async () => {
    stubHarnessFetch((request) => {
      if (request.path === "/v1/models")
        return jsonResponse(503, {
          code: "draining",
          error: "server draining",
        });
      return undefined;
    });
    render(
      <RuntimeStatusProvider>
        <CauseProbe />
      </RuntimeStatusProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "offline:connectivity",
      ),
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Mecatl is unreachable.");
    expect(alert).toHaveTextContent(/restarting/);
    expect(
      screen.queryByRole("link", { name: "Open sign-in settings" }),
    ).not.toBeInTheDocument();
  });

  it("reconnects at once on the sign-in callback's message — no wait for the poll", async () => {
    let signedIn = false;
    stubHarnessFetch((request) => {
      if (request.path === "/api/auth/oidc/status") return oidcStatus();
      if (request.path === "/v1/models") {
        if (signedIn) return { models: [] };
        return jsonResponse(401, {
          code: "oidc_login_required",
          error: "This deployment requires OIDC sign-in.",
        });
      }
      return undefined;
    });
    render(
      <RuntimeStatusProvider>
        <CauseProbe />
      </RuntimeStatusProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "offline:login-required",
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();

    // The popup completed: the callback page notifies the opener.
    signedIn = true;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "mecatl-oidc", ok: true },
          origin: window.location.origin,
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("connected:none"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
