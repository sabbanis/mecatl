import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PlacementBadge,
  placementBadgeText,
  placementBadgeTitle,
} from "./placement-badge";

/**
 * The chat header's placement badge (the TUI's startup worktree/branch
 * line): label and branch from the daemon's display metadata, the kind and
 * short revision on hover, "No filesystem" for a no-fs session, and nothing
 * at all when the daemon reports no placement.
 */
describe("PlacementBadge", () => {
  const badge = () => screen.queryByTestId("placement-badge");

  it("renders the label and the branch from the daemon's display metadata", () => {
    render(
      <PlacementBadge
        placement={{
          kind: "git-worktree",
          label: "feature-x",
          branch: "feature/x",
          revision: "0123456789abcdef",
        }}
      />,
    );
    expect(badge()).toHaveTextContent("feature-x · feature/x");
    expect(badge()).toHaveAttribute("data-placement-kind", "git-worktree");
    // The kind word and the seven-character revision, the way the worktree
    // picker abbreviates one; the full revision lives in the /session dialog.
    expect(badge()).toHaveAttribute(
      "title",
      "Placement: git-worktree @ 0123456",
    );
  });

  it("shows the label alone when the branch is unknown (a detached HEAD)", () => {
    render(
      <PlacementBadge
        placement={{ kind: "local", label: "studio", branch: "", revision: "" }}
      />,
    );
    expect(badge()).toHaveTextContent("studio");
    expect(badge()?.textContent).not.toContain("·");
    expect(badge()).toHaveAttribute("title", "Placement: local");
  });

  it("shows the branch alone when the daemon set no label", () => {
    render(
      <PlacementBadge
        placement={{ kind: "local", label: "", branch: "main", revision: "" }}
      />,
    );
    expect(badge()).toHaveTextContent("main");
  });

  it("names a no-filesystem placement in words, never as a branch", () => {
    render(
      <PlacementBadge
        placement={{ kind: "no-fs", label: "", branch: "", revision: "" }}
      />,
    );
    expect(badge()).toHaveTextContent("No filesystem");
    expect(badge()).toHaveAttribute(
      "title",
      "Placement: no filesystem — this chat has no workspace",
    );
    expect(
      placementBadgeText({ kind: "nofs", label: "", branch: "", revision: "" }),
    ).toBe("No filesystem");
  });

  it("renders nothing when the daemon reports no placement", () => {
    const { rerender } = render(<PlacementBadge placement={null} />);
    expect(badge()).toBeNull();
    rerender(<PlacementBadge placement={undefined} />);
    expect(badge()).toBeNull();
    // A kind word with neither label nor branch has nothing to show.
    rerender(
      <PlacementBadge
        placement={{ kind: "local", label: "", branch: "", revision: "abc" }}
      />,
    );
    expect(badge()).toBeNull();
  });

  it("announces itself as the placement to assistive technology", () => {
    render(
      <PlacementBadge
        placement={{
          kind: "local",
          label: "fixture",
          branch: "main",
          revision: "fixture",
        }}
      />,
    );
    expect(badge()).toHaveTextContent("Placement: fixture · main");
  });

  it("falls back to a neutral kind word in the title when the daemon set none", () => {
    expect(
      placementBadgeTitle({
        kind: "",
        label: "x",
        branch: "",
        revision: "deadbeefcafe",
      }),
    ).toBe("Placement: placement @ deadbee");
  });
});
