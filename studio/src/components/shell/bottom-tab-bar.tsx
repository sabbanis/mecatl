"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buildUserNav } from "@/components/app/nav-items";
import { cn } from "@/lib/utils";

function isEditable(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

/**
 * Whether a text input currently holds focus — the on-screen keyboard is
 * (about to be) up, so the tab bar should get out of its way. Focus-based
 * rather than visualViewport-based: it also covers the browsers that resize
 * the layout viewport for the keyboard, where the bar would otherwise eat
 * the little height that remains.
 */
function useEditableFocused() {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target)) setFocused(true);
    };
    const onFocusOut = () => {
      // Defer: focus may be moving between two inputs.
      setTimeout(() => setFocused(isEditable(document.activeElement)), 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    setFocused(isEditable(document.activeElement));
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return focused;
}

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
  const keyboardUp = useEditableFocused();

  return (
    <nav
      aria-label={nav.navLabel}
      className={cn(
        "hidden shrink-0 items-stretch justify-around px-1 pt-0.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]",
        // While a text input holds focus the on-screen keyboard owns the
        // bottom of the screen — the bar gets out of its way.
        !keyboardUp && "max-[499px]:flex",
      )}
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
