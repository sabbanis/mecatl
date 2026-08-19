import { Bell, Network, Palette, Route, Server, UserRound } from "lucide-react";

export interface SettingsSection {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * The settings information architecture, shared by the desktop secondary nav,
 * the mobile drill-down list on the settings index, and the mobile subpage
 * back-header. One entry per subpage.
 */
export const SETTINGS_GROUPS: Array<{
  label: string;
  items: SettingsSection[];
}> = [
  {
    label: "Preferences",
    items: [
      {
        href: "/workspace/settings/profile",
        label: "Profile",
        icon: UserRound,
      },
      {
        href: "/workspace/settings/appearance",
        label: "Appearance",
        icon: Palette,
      },
      {
        href: "/workspace/settings/notifications",
        label: "Notifications",
        icon: Bell,
      },
    ],
  },
  {
    label: "Agent runtime",
    items: [
      { href: "/workspace/settings/provider", label: "Provider", icon: Server },
      {
        href: "/workspace/settings/model-router",
        label: "Model router",
        icon: Route,
      },
      {
        href: "/workspace/settings/gateway",
        label: "MCP gateway",
        icon: Network,
      },
    ],
  },
];

/** Subpage label by pathname, for the mobile back-header. */
export function settingsSectionLabel(pathname: string): string | undefined {
  for (const group of SETTINGS_GROUPS) {
    const hit = group.items.find((item) => item.href === pathname);
    if (hit) return hit.label;
  }
  return undefined;
}
