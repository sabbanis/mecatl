"use client";

import type { ReactNode } from "react";
import type { ShellNav } from "@/components/shell/nav-items";
import { Navbar } from "@/components/shell/navbar";
import { Sidebar } from "@/components/shell/sidebar";

/**
 * The console chrome shared by the admin console and the user console: the
 * persistent light sidebar beside the topbar and the centred content column.
 * It is generic over the `ShellNav` it is given.
 *
 * This is a Client Component on purpose. A `ShellNav`'s `items` carry `icon`
 * component references, which are functions and so cannot cross a Server →
 * Client Component prop boundary. Each console therefore supplies its `nav`
 * from a Client Component wrapper that imports the config directly, so the
 * icons stay inside the client module graph and never get passed as props
 * from a Server Component. The server layout renders that wrapper with only
 * serializable props plus the page as `children`.
 *
 * Below the `md` breakpoint the persistent sidebar hides and the topbar's
 * menu button opens it as an overlay drawer instead.
 */
export function Shell({
  nav,
  userMenu,
  railStorageKey,
  railDefaultWidth,
  railCollapsible = false,
  contentClassName = "w-full px-4 pb-7 pt-6 sm:px-6",
  children,
}: {
  nav: ShellNav;
  /** Right-aligned topbar profile-menu slot (e.g. the existing `UserMenu`). */
  userMenu?: ReactNode;
  /**
   * Persisted-width key + starting width for the resizable rail. Chat passes a
   * collapsed default so the rail starts icon-only there while staying
   * resizable; other pages default to the expanded width.
   */
  railStorageKey?: string;
  railDefaultWidth?: number;
  /** Whether the rail may collapse to icons (Chat) or keeps a labelled min. */
  railCollapsible?: boolean;
  /** The centred content column's wrapper classes; consoles vary the max-width. */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        nav={nav}
        resizable
        collapsible={railCollapsible}
        collapseToggle
        storageKey={railStorageKey}
        defaultWidth={railDefaultWidth}
        className="hidden md:flex"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar nav={nav} userMenu={userMenu} />
        {/* scrollbar-gutter keeps the centred column at the same x whether or
            not the page is tall enough to scroll — without it, short pages
            render a few px right of scrolling ones.
            relative makes main the containing block for absolutely-positioned
            descendants with no positioned ancestor of their own — notably the
            hidden form-integration checkbox Radix renders beside each Switch
            inside a <form>. Without it those boxes resolve to the document,
            escape this scroll container, and grow the page itself, so the
            whole shell scrolls off-screen. */}
        <main className="relative flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className={contentClassName}>{children}</div>
        </main>
      </div>
    </div>
  );
}
