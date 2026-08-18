"use client";

import { cn } from "@/lib/utils";

/** Shared pill-track classes so button tabs render like the app's other tabs. */
const TAB_TRACK_CLASS =
  "inline-flex w-max items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800";

const tabPillClass = (active: boolean) =>
  cn(
    "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );

export type SectionTabButtonItem<K extends string = string> = {
  key: K;
  label: string;
};

/**
 * Button tab bar whose tabs switch local state instead of navigating. Renders
 * the app's standard pill track.
 */
export function SectionTabButtons<K extends string>({
  items,
  value,
  onValueChange,
}: {
  items: SectionTabButtonItem<K>[];
  value: K;
  onValueChange: (value: K) => void;
}) {
  return (
    <nav className="max-w-full overflow-x-auto">
      <div className={TAB_TRACK_CLASS}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onValueChange(item.key)}
            className={tabPillClass(item.key === value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
