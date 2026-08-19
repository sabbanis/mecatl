"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SETTINGS_GROUPS } from "./_components/settings-sections";

/**
 * The settings index. On mobile it is the first level of a native-style
 * drill-down: grouped inset lists of tappable rows (icon chip, label,
 * chevron) linking to each subpage, which renders with a back header.
 * Desktop keeps the old behaviour — land on the first section, with the
 * left secondary nav for switching — via a client redirect (the split is
 * a viewport question, so the server cannot decide it).
 */
export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    if (window.matchMedia("(min-width: 500px)").matches) {
      router.replace("/workspace/settings/profile");
    }
  }, [router]);

  return (
    <div className="space-y-6 min-[500px]:hidden">
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.label} className="space-y-1.5">
          <p className="px-4 text-[13px] font-medium text-muted-foreground">
            {group.label}
          </p>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors active:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {item.label}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
