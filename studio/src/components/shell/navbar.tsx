import type { ReactNode } from "react";
import { GlobalSearch } from "@/components/shell/global-search";
import { NavDrawer } from "@/components/shell/nav-drawer";
import type { ShellNav } from "@/components/shell/nav-items";

/**
 * The light topbar. On the left: the small-screen menu button that opens the
 * navigation drawer (hidden at `md` and up, where the persistent sidebar
 * carries the brand). On the right: the `userMenu` slot — the caller drops
 * the existing profile menu (Experience switch, theme, presentation modes,
 * sign out) in here, restyled for a light surface.
 *
 * It is generic over the `ShellNav` it is given, so the admin console and the
 * user console render the same topbar and differ only in their destinations.
 * The header sits on the light `sidebar` surface with a standard border and
 * references none of the dark nav-band tokens. A Server Component; the
 * interactive pieces it composes carry their own `"use client"`.
 */
export function Navbar({
  nav,
  userMenu,
}: {
  nav: ShellNav;
  /** Right-aligned profile menu slot (e.g. the existing `UserMenu`). */
  userMenu?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <NavDrawer nav={nav} />
        <GlobalSearch />
      </div>
      {userMenu}
    </header>
  );
}
