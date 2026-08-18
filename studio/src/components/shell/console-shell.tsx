"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { buildUserNav } from "@/components/app/nav-items";
import { Shell } from "@/components/shell/shell";
import { ShortcutsProvider } from "@/lib/shortcuts/use-shortcuts";

/**
 * Renders the Atrium workspace shell. The `ShellNav` is built client-side
 * because nav items carry icon component references, which cannot cross a
 * Server → Client prop boundary, so the server layout renders this wrapper and
 * the nav config stays inside the client module graph.
 *
 * Workspace sections (`/workspace/*`) manage their own scrolling, inner rails,
 * and padding, so they get a full-bleed `h-full` wrapper; anything else gets a
 * comfortable padded column.
 */

const PADDED_COLUMN = "w-full px-4 pt-6 pb-14 min-[500px]:px-8";
const FULL_BLEED = "h-full";

/** Route prefixes whose section layouts own their scrolling and padding. */
const FULL_BLEED_PREFIXES = ["/workspace"] as const;

export function ConsoleShell({
  userMenu,
  children,
}: {
  /** Right-aligned topbar profile-menu slot (the existing `UserMenu`). */
  userMenu?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const nav = buildUserNav();

  const isFullBleed = FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <ShortcutsProvider>
      <Shell
        nav={nav}
        userMenu={userMenu}
        contentClassName={isFullBleed ? FULL_BLEED : PADDED_COLUMN}
      >
        {children}
      </Shell>
    </ShortcutsProvider>
  );
}
