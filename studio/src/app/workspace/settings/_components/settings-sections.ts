import {
  Activity,
  Bot,
  Brain,
  CircleHelp,
  Database,
  FlaskConical,
  GraduationCap,
  Keyboard,
  Network,
  Palette,
  PanelBottom,
  Route,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";

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
        label: "You",
        icon: UserRound,
      },
      {
        href: "/workspace/settings/appearance",
        label: "Personalize",
        icon: Palette,
      },
      {
        href: "/workspace/settings/keyboard",
        label: "Keyboard",
        icon: Keyboard,
      },
      {
        // mecatui's `status_customization`: the header/footer templates.
        href: "/workspace/settings/status-line",
        label: "Status line",
        icon: PanelBottom,
      },
      // After Appearance: identity, then how the app looks, then how the chat
      // behaves, then when it interrupts you.
    ],
  },
  {
    label: "Agent runtime",
    items: [
      {
        href: "/workspace/settings/agent",
        label: "Agent",
        icon: Bot,
      },
      {
        href: "/workspace/settings/permissions",
        label: "Permissions",
        icon: ShieldCheck,
      },
      {
        href: "/workspace/settings/memory",
        label: "Memory",
        icon: Brain,
      },
      {
        href: "/workspace/settings/learning",
        label: "Learning",
        icon: GraduationCap,
      },
      {
        href: "/workspace/settings/provider",
        label: "Provider",
        icon: Server,
      },
      {
        href: "/workspace/settings/model-router",
        label: "Model router",
        icon: Route,
      },
      {
        href: "/workspace/settings/gateway",
        // The MCP inventory (sources, ToolHive groups) above the gateway
        // connect form; the route keeps its historical name.
        label: "MCP tools",
        icon: Network,
      },
      {
        href: "/workspace/settings/storage",
        label: "Storage",
        icon: Database,
      },
      {
        href: "/workspace/settings/diagnostics",
        label: "Diagnostics",
        icon: Activity,
      },
    ],
  },
  {
    label: "Experimental",
    items: [
      {
        href: "/workspace/settings/labs",
        label: "Labs",
        icon: FlaskConical,
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        // Studio's version, docs and source links, the daemon's identity and
        // the configuration reference — the web analogue of --version/--help.
        href: "/workspace/settings/help",
        label: "Help & about",
        icon: CircleHelp,
      },
    ],
  },
];

/**
 * The section a pathname belongs to, for the mobile back-header and the
 * desktop nav active state. Prefix-aware so a section's deeper pages
 * (e.g. a memory entry) still resolve to their section.
 */
export function settingsSectionFor(
  pathname: string,
): SettingsSection | undefined {
  for (const group of SETTINGS_GROUPS) {
    const hit = group.items.find(
      (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
    );
    if (hit) return hit;
  }
  return undefined;
}
