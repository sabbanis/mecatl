"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { settingsSectionLabel } from "./settings-sections";

/**
 * The settings page heading. Desktop always titles the page "Settings" (the
 * left nav names the section). On mobile the index drill-down list keeps that
 * title, while a subpage follows the native convention instead: a "‹ Settings"
 * back link above the section's own large title.
 */
export function SettingsHeader() {
  const pathname = usePathname() ?? "";
  const section = settingsSectionLabel(pathname);

  return (
    <div className="space-y-1">
      {section && (
        <Link
          href="/workspace/settings"
          className="hidden items-center gap-0.5 py-1 text-[15px] font-medium text-brand max-[499px]:inline-flex"
        >
          <ChevronLeft className="size-5 shrink-0" />
          Settings
        </Link>
      )}
      <h1
        className={cn(
          pageTitleClass("truncate pb-0 text-4xl leading-tight"),
          section && "max-[499px]:hidden",
        )}
      >
        Settings
      </h1>
      {section && (
        <h1
          className={pageTitleClass(
            "hidden truncate pb-0 text-3xl leading-tight max-[499px]:block",
          )}
        >
          {section}
        </h1>
      )}
    </div>
  );
}
