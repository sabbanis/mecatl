import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HELP_ROUTE, HelpMenuItem, HelpSheetItem } from "./help-menu-item";

/**
 * The chat ··· menus' entry point to the help reference: both the desktop
 * dropdown item and the mobile sheet row navigate to the shortcuts page, and
 * the sheet row tells its sheet to close.
 */

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("HelpMenuItem", () => {
  it("navigates to the help reference from the dropdown", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <HelpMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Keyboard shortcuts & features",
      }),
    );
    expect(router.push).toHaveBeenCalledWith(HELP_ROUTE);
    expect(HELP_ROUTE).toBe("/workspace/shortcuts");
  });
});

describe("HelpSheetItem", () => {
  it("navigates and closes the sheet", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<HelpSheetItem onSelect={onSelect} />);
    await user.click(
      screen.getByRole("button", { name: "Keyboard shortcuts & features" }),
    );
    expect(router.push).toHaveBeenCalledWith("/workspace/shortcuts");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
