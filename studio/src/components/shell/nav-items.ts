/**
 * The shared console-shell vocabulary. The `shell/` components (sidebar,
 * topbar, nav-drawer) are generic over these types, so the admin console and
 * the user console render the *same* chrome and differ only in the `ShellNav`
 * each one passes in. Each console owns its own destination list.
 */

import type { ComponentType } from "react";

export interface NavItem {
  /** Stable key for React keys and test selectors. */
  readonly key: string;
  /** Sidebar label. */
  readonly label: string;
  /** Absolute route this destination points at. */
  readonly href: string;
  /** Sidebar icon. */
  readonly icon: ComponentType<{ className?: string }>;
  /**
   * Optional group heading rendered as a small uppercase muted label above
   * the first item of each contiguous run sharing the same value (e.g. the
   * user console's "Workspace" and "Tools" groups). Ungrouped consoles omit
   * it entirely.
   */
  readonly group?: string;
}

/**
 * The counterpart console the profile menu offers to switch to, if any.
 */
interface ConsoleSwitch {
  /** Profile-menu item label. */
  readonly label: string;
  /** Absolute route the switcher navigates to. */
  readonly href: string;
}

/**
 * A console's navigation configuration. One value per console drives the whole
 * shell: the sidebar destinations, the wordmark's home link, and the optional
 * footer-pinned destination.
 */
export interface ShellNav {
  /** The console's root route (used for the "home" active-state rule). */
  readonly homeHref: string;
  /** Where the wordmark links, if different from `homeHref` (e.g. Atrium
      sends the logo to the workspace chats rather than the gateway home). */
  readonly logoHref?: string;
  /** `aria-label` for the sidebar `<nav>` landmark. */
  readonly navLabel: string;
  /** Ordered sidebar destinations. */
  readonly items: readonly NavItem[];
  /**
   * Key of the destination pinned to the sidebar footer (e.g. admin's Org
   * Settings), if any. Consoles with no footer destination omit it.
   */
  readonly footerKey?: string;
  /** Role line shown under the display name in the profile menu, if used. */
  readonly roleLabel?: string;
  /**
   * The counterpart console a profile-menu switcher navigates to, if any.
   */
  readonly switchTo?: ConsoleSwitch;
}
