"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import type { NavItem, ShellNav } from "@/components/shell/nav-items";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavCollapsed } from "@/hooks/use-nav-collapsed";
import {
  RAIL_COLLAPSE_AT,
  RAIL_LABELED_MIN,
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  useRailWidth,
} from "@/hooks/use-rail-width";
import { cn } from "@/lib/utils";

/**
 * True when the destination at `href` is the active one for the current
 * `pathname` (and, for query-bearing hrefs, `search`).
 *
 * A console-root destination is active only on an exact match — otherwise
 * every deeper page would light it up. Every other destination is active on
 * its exact route or any path segment under it. The under-route check compares
 * against `${href}/` (not a raw string prefix) so a sibling like
 * `/admin/identity-providers` never counts as "under" `/admin/identity`.
 *
 * When an href carries a query (e.g. two "Setup" destinations that deep-link
 * the same page to different tabs via `?mode=`), the path must match *and*
 * every query param on the href must be present with the same value in the
 * current `search`, so only the matching tab lights up.
 *
 * Pure and exported so tests can pin the rule without rendering. `homeHref`
 * names the console root so the exact-match rule is not hard-wired to one
 * console.
 */
export function isNavItemActive(
  href: string,
  pathname: string,
  homeHref: string,
  search = "",
): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  if (hrefPath === homeHref) {
    return pathname === homeHref;
  }
  const pathActive =
    pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  if (!pathActive || !hrefQuery) {
    return pathActive;
  }
  const current = new URLSearchParams(search);
  const wanted = new URLSearchParams(hrefQuery);
  for (const [key, value] of wanted) {
    if (current.get(key) !== value) {
      return false;
    }
  }
  return true;
}

/**
 * Among a console's destinations, the key of the single active one for
 * `pathname`/`search` — the most specific match (longest `href`) so a parent
 * like `/admin/tools` does not stay lit while on a nested destination such as
 * `/admin/tools/[serverId]`. Returns null when nothing matches.
 */
export function activeNavItemKey(
  items: readonly NavItem[],
  pathname: string,
  homeHref: string,
  search = "",
): string | null {
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    if (
      isNavItemActive(item.href, pathname, homeHref, search) &&
      item.href.length > bestLen
    ) {
      bestKey = item.key;
      bestLen = item.href.length;
    }
  }
  return bestKey;
}

/**
 * The light left sidebar with a console's destinations. Each destination is a
 * full-width bar; the active route carries a brand-coloured left accent and a
 * muted fill. The Stacklok wordmark sits at the top, tinted with the `--logo`
 * token, and links to the console root.
 *
 * The component is generic over the `ShellNav` it is given, so the admin
 * console and the user console render the same sidebar and differ only in
 * their `items`, `homeHref`, `navLabel`, and optional `footerKey`. Contiguous
 * runs of items sharing a `group` get a small uppercase muted heading above
 * the run. The nav keeps `role="navigation"` (via the `<nav>` element) and
 * marks the active destination with `aria-current="page"`. `onNavigate` lets
 * the responsive drawer close itself when a destination is chosen.
 */
export function Sidebar({
  nav,
  className,
  resizable = false,
  collapsible = false,
  collapseToggle = false,
  storageKey,
  defaultWidth,
  onNavigate,
}: {
  nav: ShellNav;
  className?: string;
  /**
   * Let the user drag the rail's right edge to resize it, persisting the width.
   * Dragging below `RAIL_COLLAPSE_AT` snaps it to the icon-only strip (the
   * wordmark becomes the logo mark, group headings drop to spacing, and labels
   * move into hover tooltips). Only the persistent rail is resizable — the
   * mobile drawer is not.
   */
  resizable?: boolean;
  /**
   * Allow the rail to collapse all the way to the icon strip (Chat). When
   * false, the rail can still be resized but never below the labelled minimum —
   * it never becomes icons-only.
   */
  collapsible?: boolean;
  /**
   * Render the persistent rail's expand/collapse toggle and honour the user's
   * persisted `useNavCollapsed` choice: when collapsed, force the icons-only
   * strip regardless of the remembered width. Only the persistent rail passes
   * this; the mobile drawer leaves it off so it always shows full labels.
   */
  collapseToggle?: boolean;
  /** Persisted-width key + starting width; lets Chat default to collapsed. */
  storageKey?: string;
  defaultWidth?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [railWidth, setRailWidth] = useRailWidth(storageKey, defaultWidth);
  const [navCollapsed, setNavCollapsed] = useNavCollapsed();
  const navRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);

  // The explicit toggle is authoritative: when the user collapses the rail it
  // is icons-only whatever its remembered width. Only applies where the toggle
  // is shown (the persistent rail), never the mobile drawer.
  const collapsedByToggle = collapseToggle && navCollapsed;

  // A non-collapsible rail can't be dragged below the width that keeps its
  // labels readable; a collapsible one (Chat) can go all the way to the icon
  // strip. `iconOnly` engages for collapsible rails dragged narrow, or whenever
  // the user has explicitly collapsed the rail via the toggle.
  const minWidth = collapsible ? RAIL_MIN_WIDTH : RAIL_LABELED_MIN;
  const iconOnly =
    collapsedByToggle ||
    (resizable && collapsible && railWidth < RAIL_COLLAPSE_AT);
  const width = Math.max(minWidth, Math.min(RAIL_MAX_WIDTH, railWidth));
  // A collapsed rail is a fixed icon strip, so hide the drag handle there.
  const showHandle = resizable && !collapsedByToggle;

  useEffect(() => {
    if (!showHandle) return;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const left = navRef.current?.getBoundingClientRect().left ?? 0;
      setRailWidth(
        Math.max(minWidth, Math.min(RAIL_MAX_WIDTH, e.clientX - left)),
      );
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [showHandle, setRailWidth, minWidth]);
  // Resolve a single active destination (most specific match) so a parent like
  // Connectors doesn't stay lit on a nested connector, and so query-bearing
  // destinations (e.g. Setup's `?mode=` tabs) light up per current tab.
  const activeKey = activeNavItemKey(
    nav.items,
    pathname,
    nav.homeHref,
    searchParams.toString(),
  );

  // The footer destination (e.g. admin's Org Settings) stays in `items` so the
  // shell reads one canonical list, but the sidebar pins it to the footer
  // rather than the scrollable nav. Split it out by key so the destination set
  // never drifts. Consoles with no footer destination (`footerKey` unset)
  // render only the scrollable nav.
  const footerItem = nav.footerKey
    ? nav.items.find((item) => item.key === nav.footerKey)
    : undefined;
  const mainItems = nav.items.filter((item) => item.key !== nav.footerKey);

  // Renders a destination as a full-width square-edged bar with a 3px left
  // accent. Shared by the scrollable nav and the pinned footer so their
  // styling and semantics can never diverge. In `iconOnly` mode it collapses to
  // a centred icon whose label is disclosed by a hover tooltip.
  const renderNavLink = (item: NavItem) => {
    const isActive = item.key === activeKey;
    const Icon = item.icon;
    const link = (
      <Link
        key={item.key}
        href={item.href}
        onClick={() => {
          // Parity with the old top nav: re-choosing the active destination
          // asks the page to reopen its own inner sidebar (chat/teams listen
          // for this via use-nav-reopen-sidebar).
          if (isActive) {
            window.dispatchEvent(new CustomEvent("nav-reopen-sidebar"));
          }
          onNavigate?.();
        }}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center border-l-[3px] border-transparent font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          iconOnly
            ? "justify-center py-2.5"
            : "gap-[0.65rem] px-5 py-2 text-[0.85rem]",
          isActive &&
            "border-brand-ink bg-accent text-brand-ink hover:text-brand-ink",
        )}
      >
        <Icon
          className={cn(
            // Same glyph size whether the rail is collapsed to icons or
            // expanded with labels.
            "size-[17px] shrink-0",
            // Unselected icons sit back a little (static, so hover never
            // re-rasterises the glyph and makes it appear to shift).
            !isActive && "opacity-70",
          )}
        />
        {iconOnly ? <span className="sr-only">{item.label}</span> : item.label}
      </Link>
    );
    if (!iconOnly) {
      return link;
    }
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label={nav.navLabel}
      className={cn(
        "relative flex shrink-0 flex-col border-r border-border bg-sidebar",
        // Resizable rails size via inline style; fixed rails via width classes.
        !resizable && "w-64",
        className,
      )}
      style={
        resizable ? { width: iconOnly ? RAIL_MIN_WIDTH : width } : undefined
      }
    >
      {showHandle && (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag-to-resize handle
        <div
          className="absolute right-0 top-0 bottom-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-brand/20 active:bg-brand/30"
          onMouseDown={() => {
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />
      )}
      <Link
        href={nav.logoHref ?? nav.homeHref}
        onClick={onNavigate}
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border",
          iconOnly ? "justify-center px-0" : "px-5",
        )}
      >
        {/* The logo is rendered as a mask so it recolours with the theme
            (--logo) instead of baking in a fixed fill. Icon-only mode reuses the
            SAME wordmark image at the SAME 21px height, but clips the container
            to the arrow mark's width so only the glyph shows — this keeps the
            mark pixel-identical in size and ratio to the mark in the full logo,
            rather than restretching a separate square asset. */}
        <span
          aria-hidden="true"
          className={cn(
            "block h-[21px] bg-logo",
            iconOnly ? "w-6" : "w-[134px]",
          )}
          style={{
            WebkitMaskImage: "url(/stacklok-logo.svg)",
            maskImage: "url(/stacklok-logo.svg)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: iconOnly ? "auto 21px" : "contain",
            maskSize: iconOnly ? "auto 21px" : "contain",
            WebkitMaskPosition: "left center",
            maskPosition: "left center",
          }}
        />
        <span className="sr-only">Stacklok</span>
      </Link>
      {/* Full-width square-edged bars with a 3px left accent: no horizontal
          container padding, no radius. A group heading precedes the first item
          of each contiguous run sharing the same `group`. In icon-only mode the
          heading text is dropped and the group boundary becomes vertical space. */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        {mainItems.map((item, index) => {
          const previous = mainItems[index - 1];
          const showGroupHeading =
            item.group !== undefined && item.group !== previous?.group;
          // A trailing ungrouped item after a group (e.g. Org Settings) gets
          // the same top gap a group heading would, so it reads as separated.
          const standaloneAfterGroup =
            item.group === undefined && previous?.group !== undefined;
          // Icon-only: no heading text, but a small top gap at each group
          // boundary so the runs still read as groups.
          if (iconOnly) {
            const needsGap =
              index > 0 && (showGroupHeading || standaloneAfterGroup);
            return (
              <div key={item.key} className={needsGap ? "pt-5" : undefined}>
                {renderNavLink(item)}
              </div>
            );
          }
          if (showGroupHeading) {
            return (
              <div key={item.key} className="contents">
                <div
                  className={cn(
                    "px-5 pb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground",
                    // Later group headings get a big top gap; the first still
                    // gets breathing room below the wordmark.
                    index > 0 ? "pt-7" : "pt-3",
                  )}
                >
                  {item.group}
                </div>
                {renderNavLink(item)}
              </div>
            );
          }
          return standaloneAfterGroup ? (
            <div key={item.key} className="pt-7">
              {renderNavLink(item)}
            </div>
          ) : (
            renderNavLink(item)
          );
        })}
      </div>
      {/* A footer destination (e.g. admin's Org Settings) is pinned to the
          bottom, in a `py-3 border-t` block after the scrollable nav. It stays
          inside the `<nav>` so every destination lives in one landmark. */}
      {footerItem && (
        <div className="border-t border-border py-3">
          {renderNavLink(footerItem)}
        </div>
      )}
      {/* The expand/collapse toggle, pinned below any footer destination. Only
          the persistent rail renders it (the drawer leaves `collapseToggle`
          off). The chevron points the way the rail will move; the label is a
          hover tooltip when collapsed and inline when expanded. */}
      {collapseToggle && (
        <div className="border-t border-border py-2">
          {collapsedByToggle ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setNavCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="flex w-full items-center justify-center py-3.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PanelLeftOpen className="size-[19px] shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => setNavCollapsed(true)}
              aria-label="Collapse sidebar"
              className="flex w-full items-center gap-[0.65rem] px-5 py-3.5 text-[0.85rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-[17px] shrink-0" />
              Collapse
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
