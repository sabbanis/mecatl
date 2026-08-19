"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildUserNav } from "@/components/app/nav-items";
import { cn } from "@/lib/utils";

/**
 * The mobile bottom tab bar (below the 500px breakpoint the top nav's icon
 * row hides and this renders instead — native app convention). It sits
 * directly on the fixed dark-green gradient like the top nav, so every
 * colour is a fixed brand colour, identical in light and dark themes.
 *
 * Styled after a Material 3 navigation bar: the active surface gets a light
 * pill behind its icon (echoing the top nav's active pill) with a small
 * always-visible label beneath. Bottom padding tracks the iOS home-indicator
 * safe area for the installed-PWA case.
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "";
  const nav = buildUserNav();

  return (
    <nav
      aria-label={nav.navLabel}
      className="hidden shrink-0 items-stretch justify-around px-1 pt-0.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] max-[499px]:flex"
    >
      {nav.items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                active
                  ? "bg-[#cadfd8] text-[#03433e]"
                  : "text-[#a5b8b4] active:bg-white/10",
              )}
            >
              <Icon className="size-[19px] shrink-0" />
            </span>
            <span
              className={cn(
                // truncate clips overflow, so the line box must clear
                // descenders — no leading-none here.
                "truncate text-[10px] leading-normal font-medium",
                active ? "text-white" : "text-[#a5b8b4]",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
