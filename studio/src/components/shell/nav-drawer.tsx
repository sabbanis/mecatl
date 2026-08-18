"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ShellNav } from "@/components/shell/nav-items";
import { Sidebar } from "@/components/shell/sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The small-screen navigation drawer.
 *
 * Below the `md` breakpoint the fixed sidebar is hidden and this menu button
 * takes its place in the topbar. Opening it renders the same `Sidebar` inside
 * a left-side Sheet, which traps focus while open and closes on Escape. The
 * drawer also closes on a route change: when `pathname` changes it drops back
 * to closed, and each destination link calls `onNavigate` to close immediately
 * on select. The trigger and drawer are `md:hidden`, so on wide screens the
 * persistent sidebar is the only nav. Generic over the `ShellNav` it renders,
 * so both consoles share it. Interactive — carries `"use client"`.
 */
export function NavDrawer({ nav }: { nav: ShellNav }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  // Close on route change so a chosen destination never leaves the drawer up.
  // Comparing against the previous path keeps `pathname` a genuine dependency
  // (not a stale-closure trick) and only closes when the route actually moved.
  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex size-9 items-center justify-center rounded-md text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 max-w-[80vw] gap-0 p-0 md:hidden"
        data-testid="nav-drawer"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar
          nav={nav}
          className="h-full w-full border-r-0"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
