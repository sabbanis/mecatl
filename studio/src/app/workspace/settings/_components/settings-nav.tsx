"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string }>;
}> = [
  {
    label: "Preferences",
    items: [
      { href: "/workspace/settings/appearance", label: "Appearance" },
      { href: "/workspace/settings/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Agent runtime",
    items: [
      { href: "/workspace/settings/provider", label: "Provider" },
      { href: "/workspace/settings/model-router", label: "Model router" },
      { href: "/workspace/settings/gateway", label: "MCP gateway" },
    ],
  },
];

/** The settings sections as a left secondary menu; one subpage per section. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings sections"
      className="flex shrink-0 gap-6 overflow-x-auto sm:w-44 sm:flex-col sm:gap-5 sm:overflow-visible"
    >
      {GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="flex gap-1 sm:flex-col">
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
