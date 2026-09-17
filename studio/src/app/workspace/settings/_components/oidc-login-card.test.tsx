import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OIDC_START_URL,
  OidcLoginCard,
  type OidcStatus,
} from "./oidc-login-card";

/**
 * The remote sign-in card's `mecatui login` parity: the discovered-profile
 * review step (values listed, default-deny until "Continue with browser
 * login" confirms — the popup is pointed at the authorize redirect only
 * AFTER the server accepted the hash, and closed on refusal), the
 * `--no-browser` copy-link flow, and the deployment rows (credential
 * ordering, token store, transport warnings, sign-in window). No token and
 * no daemon address ever render.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const baseStatus: OidcStatus = {
  configured: true,
  state: "signed-out",
  source: "env",
  issuer: "https://idp.example.com/realms/mecatl",
  clientId: "studio-client",
  audience: "mecatl-daemon",
  scopes: ["openid", "profile", "offline_access"],
  authMode: "oidc",
  store: { kind: "memory" },
  transport: { tlsCa: false, insecure: false, privateIssuer: false },
  callbackTimeoutSeconds: 600,
};

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function stubFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      return handler(url, init) ?? json(404, { error: "unexpected" });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function stubClipboard() {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OidcLoginCard — discovered profile review", () => {
  const discovered: OidcStatus = {
    ...baseStatus,
    configured: false,
    state: "discovered",
    source: "discovery",
    profileHash: "a".repeat(64),
  };

  it("lists issuer, client id, audience and scopes and confirms BEFORE pointing the popup at the authorize redirect", async () => {
    const popup = { location: { href: "about:blank" }, close: vi.fn() };
    const open = vi.fn(() => popup as unknown as Window);
    vi.stubGlobal("open", open);
    const calls = stubFetch((url, init) => {
      if (url === "/api/auth/oidc/status") return json(200, discovered);
      if (url === "/api/auth/oidc/confirm-discovery" && init?.method === "POST")
        return json(200, { ok: true });
      return undefined;
    });
    render(<OidcLoginCard />);

    expect(await screen.findByTestId("oidc-issuer")).toHaveTextContent(
      "https://idp.example.com/realms/mecatl",
    );
    expect(screen.getByTestId("oidc-client-id")).toHaveTextContent(
      "studio-client",
    );
    expect(screen.getByTestId("oidc-audience")).toHaveTextContent(
      "mecatl-daemon",
    );
    expect(screen.getByTestId("oidc-scopes")).toHaveTextContent(
      "openid profile offline_access",
    );
    expect(
      screen.getByText(/Discovered from the deployment/),
    ).toBeInTheDocument();
    // Default-deny: no plain Sign in button while unconfirmed.
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with browser login" }),
    );
    // The popup opens synchronously on the click (popup-blocker safe) but on
    // about:blank — the issuer is not reached before the confirmation.
    expect(open).toHaveBeenCalledWith(
      "about:blank",
      "mecatl-oidc-login",
      expect.any(String),
    );
    expect(popup.location.href).toBe("about:blank");

    await waitFor(() => expect(popup.location.href).toBe(OIDC_START_URL));
    const confirm = calls.find(
      (c) => c.url === "/api/auth/oidc/confirm-discovery",
    );
    expect(confirm?.init?.method).toBe("POST");
    expect(JSON.parse(String(confirm?.init?.body))).toEqual({
      profileHash: "a".repeat(64),
    });
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("closes the popup and shows the refusal when the server rejects the hash", async () => {
    const popup = { location: { href: "about:blank" }, close: vi.fn() };
    vi.stubGlobal(
      "open",
      vi.fn(() => popup as unknown as Window),
    );
    stubFetch((url, init) => {
      if (url === "/api/auth/oidc/status") return json(200, discovered);
      if (url === "/api/auth/oidc/confirm-discovery" && init?.method === "POST")
        return json(409, {
          ok: false,
          error:
            "The discovered sign-in profile changed since it was reviewed — review it again.",
        });
      return undefined;
    });
    render(<OidcLoginCard />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Continue with browser login",
      }),
    );
    await waitFor(() => expect(popup.close).toHaveBeenCalled());
    expect(popup.location.href).toBe("about:blank");
    expect(screen.getByRole("status")).toHaveTextContent(/review it again/);
  });
});

describe("OidcLoginCard — copy sign-in link (no-browser flow)", () => {
  it("fetches ?mode=link, writes the clipboard and says where the link works", async () => {
    const writeText = stubClipboard();
    const calls = stubFetch((url) => {
      if (url === "/api/auth/oidc/status") return json(200, baseStatus);
      if (url === `${OIDC_START_URL}?mode=link`)
        return json(200, {
          authorizationUrl:
            "https://idp.example.com/authorize?client_id=studio-client&state=s1",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        });
      return undefined;
    });
    render(<OidcLoginCard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy sign-in link" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://idp.example.com/authorize?client_id=studio-client&state=s1",
      ),
    );
    expect(calls.some((c) => c.url === `${OIDC_START_URL}?mode=link`)).toBe(
      true,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Sign-in link copied\. Open it in any browser that can reach this Studio/,
    );
    // The plain Sign in popup path is still there beside it.
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the server's refusal instead of copying when the link cannot be minted", async () => {
    const writeText = stubClipboard();
    stubFetch((url) => {
      if (url === "/api/auth/oidc/status") return json(200, baseStatus);
      if (url === `${OIDC_START_URL}?mode=link`)
        return json(400, { error: "OIDC discovery failed (HTTP 503)" });
      return undefined;
    });
    render(<OidcLoginCard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy sign-in link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/discovery failed/),
    );
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("OidcLoginCard — deployment rows", () => {
  it("renders the transport warnings, the anonymous credential mode, the file store and the sign-in window", async () => {
    stubFetch((url) =>
      url === "/api/auth/oidc/status"
        ? json(200, {
            ...baseStatus,
            state: "signed-in",
            email: "op@example.com",
            authMode: "anonymous",
            store: { kind: "file" },
            transport: {
              tlsCa: true,
              insecure: true,
              privateIssuer: true,
              problem:
                "MECATL_TLS_CA and MECATL_TLS_INSECURE are mutually exclusive; the CA bundle is used and verification stays on.",
            },
            callbackTimeoutSeconds: 900,
          })
        : undefined,
    );
    render(<OidcLoginCard />);
    expect(await screen.findByTestId("oidc-auth-mode")).toHaveTextContent(
      /anonymously/,
    );
    expect(screen.getByText(/MECATL_AUTH_ANONYMOUS=1/)).toBeInTheDocument();
    expect(screen.getByTestId("oidc-store-kind")).toHaveTextContent("file");
    expect(screen.getByText(/survives a Studio restart/)).toBeInTheDocument();
    expect(screen.getByTestId("oidc-transport-insecure")).toHaveTextContent(
      /verification is disabled/,
    );
    expect(screen.getByTestId("oidc-transport-problem")).toHaveTextContent(
      /mutually exclusive/,
    );
    expect(screen.getByText(/Private CA bundle/)).toBeInTheDocument();
    expect(
      screen.getByText(/MECATL_OIDC_PRIVATE_ISSUER=1/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("oidc-callback-timeout")).toHaveTextContent(
      "15 minutes",
    );
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("names the discovery opt-in in the not-configured copy and still shows the deployment rows", async () => {
    stubFetch((url) =>
      url === "/api/auth/oidc/status"
        ? json(200, {
            configured: false,
            state: "not-configured",
            authMode: "static",
            store: { kind: "memory" },
            transport: { tlsCa: false, insecure: false, privateIssuer: false },
            callbackTimeoutSeconds: 600,
          })
        : undefined,
    );
    render(<OidcLoginCard />);
    expect(
      await screen.findByText(/MECATL_OIDC_DISCOVERY=1/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("oidc-auth-mode")).toHaveTextContent(
      /MECATL_AUTH_TOKEN/,
    );
    expect(screen.getByTestId("oidc-transport")).toHaveTextContent("default");
    expect(screen.getByTestId("oidc-callback-timeout")).toHaveTextContent(
      "10 minutes",
    );
  });
});
