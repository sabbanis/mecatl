/**
 * The Atrium workspace console's sidebar configuration.
 *
 * The app is Atrium-only: a single rail of workspace destinations — the in-app
 * chat plus the state that outlives a turn (Skills, Memory, Scheduled). The
 * wordmark and home both point at Chats.
 */

import {
  Brain,
  Clock,
  GraduationCap,
  MessageCircle,
  Settings,
} from "lucide-react";
import type { ShellNav } from "@/components/shell/nav-items";
import { ATRIUM_WORKSPACE_HOME } from "@/lib/feature-flags";

/** Builds the Atrium workspace `ShellNav`. */
export function buildUserNav(): ShellNav {
  return {
    // The workspace root (redirects to chat). Kept distinct from the Chats
    // item's href so Chats highlights on any /workspace/chat/* route rather
    // than only the exact base path (the "console root" exact-match rule).
    homeHref: "/workspace",
    logoHref: ATRIUM_WORKSPACE_HOME,
    navLabel: "Main navigation",
    items: [
      {
        key: "chat",
        label: "Chats",
        href: "/workspace/chat",
        icon: MessageCircle,
      },
      {
        key: "agent-schedules",
        label: "Scheduled",
        href: "/workspace/schedules",
        icon: Clock,
      },
      {
        key: "agent-skills",
        label: "Skills",
        href: "/workspace/skills",
        icon: GraduationCap,
      },
      {
        key: "agent-memory",
        label: "Memory",
        href: "/workspace/memory",
        icon: Brain,
      },
      {
        key: "settings",
        label: "Settings",
        href: "/workspace/settings",
        icon: Settings,
      },
    ],
  };
}
