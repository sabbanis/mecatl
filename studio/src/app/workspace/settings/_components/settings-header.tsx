"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { settingsSectionLabel } from "./settings-sections";

/**
 * Mobile-only subpage header, styled like the chat header: a full-bleed
 * h-16 bar with a back arrow to the settings index and the section title.
 * Renders nothing on the index or from 500px up.
 */
export function SettingsMobileBar() {
  const pathname = usePathname() ?? "";
  const section = settingsSectionLabel(pathname);
  if (!section) return null;

  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 min-[500px]:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        asChild
      >
        <Link href="/workspace/settings" aria-label="Back to settings">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
        {section}
      </h1>
    </div>
  );
}

/**
 * The big serif page title. On a mobile subpage the SettingsMobileBar
 * replaces it; everywhere else (desktop, and the mobile index) it renders.
 */
export function SettingsTitle() {
  const pathname = usePathname() ?? "";
  const section = settingsSectionLabel(pathname);

  return (
    <h1
      className={cn(
        pageTitleClass("truncate pb-0 text-4xl leading-tight"),
        section && "max-[499px]:hidden",
      )}
    >
      Settings
    </h1>
  );
}
