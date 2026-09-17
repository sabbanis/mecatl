import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutStudioCard } from "./about-studio-card";

/**
 * The About Studio card is the web `mecatui --version` plus the docs
 * pointer: three build-time rows that never wait on the daemon, and three
 * links — the documentation site, the repository, and the in-app shortcuts
 * reference (the page's first visible entry point).
 */

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_STUDIO_VERSION", "0.1.0");
  vi.stubEnv("NEXT_PUBLIC_SDK_VERSION", "0.2.0");
  vi.stubEnv("NEXT_PUBLIC_STUDIO_BUILD", "0.1.0+abc1234");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AboutStudioCard", () => {
  it("renders the inlined Studio, build and SDK versions", () => {
    render(<AboutStudioCard />);
    expect(screen.getByText("About Studio")).toBeInTheDocument();
    expect(screen.getByTestId("about-studio-version")).toHaveTextContent(
      "0.1.0",
    );
    expect(screen.getByTestId("about-studio-build-stamp")).toHaveTextContent(
      "0.1.0+abc1234",
    );
    expect(screen.getByTestId("about-sdk-version")).toHaveTextContent("0.2.0");
  });

  it("reads 'unknown' rather than an empty cell when a version was not inlined", () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_VERSION", "");
    vi.stubEnv("NEXT_PUBLIC_SDK_VERSION", "   ");
    render(<AboutStudioCard />);
    expect(screen.getByTestId("about-studio-version")).toHaveTextContent(
      "unknown",
    );
    expect(screen.getByTestId("about-sdk-version")).toHaveTextContent(
      "unknown",
    );
  });

  it("links to the documentation, the repository (new tab) and the shortcuts reference", () => {
    render(<AboutStudioCard />);
    const docs = screen.getByRole("link", { name: /Documentation/ });
    expect(docs).toHaveAttribute("href", "https://mecatl.dev/docs/");
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs).toHaveAttribute("rel", "noreferrer");

    const source = screen.getByRole("link", { name: /Source & issues/ });
    expect(source).toHaveAttribute(
      "href",
      "https://github.com/stacklok/mecatl",
    );
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noreferrer");

    const shortcuts = screen.getByRole("link", { name: /Keyboard shortcuts/ });
    expect(shortcuts).toHaveAttribute("href", "/workspace/shortcuts");
    expect(shortcuts).not.toHaveAttribute("target");
  });
});
