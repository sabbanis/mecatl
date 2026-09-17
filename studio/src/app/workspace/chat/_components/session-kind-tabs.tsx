"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_TAB_LABELS,
  SESSION_TABS,
  type SessionTab,
} from "@/lib/session-kinds";
import { cn } from "@/lib/utils";

/** Browser-local: which inventory tab the sidebar last showed. */
export const SESSION_TAB_STORAGE_KEY = "studio.sessions.tab";

function isSessionTab(value: string | null): value is SessionTab {
  return value !== null && (SESSION_TABS as readonly string[]).includes(value);
}

/**
 * The tabs the sidebar offers right now: Chats / Runs / Scheduled always;
 * Drafts only when the daemon advertises `session_activity_inventory` (it
 * alone can classify a chat as a draft); Other only while it has rows (an
 * unknown-kind row is rare, so an empty tab would be noise).
 */
export function visibleSessionTabs(options: {
  showDrafts: boolean;
  showOther: boolean;
}): SessionTab[] {
  return SESSION_TABS.filter((tab) => {
    if (tab === "drafts") return options.showDrafts;
    if (tab === "other") return options.showOther;
    return true;
  });
}

/**
 * The active inventory tab, remembered in localStorage. A remembered tab
 * that is not offered right now (Drafts against an older daemon, an Other
 * that emptied) reads as Chats without overwriting the preference.
 */
export function useSessionTab(options: {
  showDrafts: boolean;
  showOther: boolean;
}): { tab: SessionTab; setTab: (tab: SessionTab) => void } {
  const [stored, setStored] = useState<SessionTab>("chats");
  useEffect(() => {
    try {
      const value = window.localStorage.getItem(SESSION_TAB_STORAGE_KEY);
      if (isSessionTab(value)) setStored(value);
    } catch {
      // Storage disabled — the tab just does not persist.
    }
  }, []);

  const setTab = useCallback((tab: SessionTab) => {
    setStored(tab);
    try {
      window.localStorage.setItem(SESSION_TAB_STORAGE_KEY, tab);
    } catch {
      // Storage disabled or full — the preference just doesn't persist.
    }
  }, []);

  const tab = visibleSessionTabs(options).includes(stored) ? stored : "chats";
  return { tab, setTab };
}

/**
 * The sidebar's kind tabs (the TUI's /sessions overlay tabs): a segmented
 * control under the "Chat History" header with a row count per tab. A
 * proper tablist — Left/Right/Home/End move and select, the selected tab is
 * the one in the Tab order — so the keyboard reaches every inventory.
 */
export function SessionKindTabs({
  value,
  onChange,
  counts,
  showDrafts,
  showOther,
}: {
  value: SessionTab;
  onChange: (tab: SessionTab) => void;
  counts: Record<SessionTab, number>;
  showDrafts: boolean;
  showOther: boolean;
}) {
  const tabs = visibleSessionTabs({ showDrafts, showOther });
  const refs = useRef(new Map<SessionTab, HTMLButtonElement>());

  const select = (tab: SessionTab) => {
    onChange(tab);
    refs.current.get(tab)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.indexOf(value);
    let next: SessionTab | undefined;
    switch (event.key) {
      case "ArrowRight":
        next = tabs[(index + 1) % tabs.length];
        break;
      case "ArrowLeft":
        next = tabs[(index - 1 + tabs.length) % tabs.length];
        break;
      case "Home":
        next = tabs[0];
        break;
      case "End":
        next = tabs[tabs.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next) select(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Session kinds"
      onKeyDown={onKeyDown}
      className="mx-3 mt-3 flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5 text-xs lg:mx-4"
    >
      {tabs.map((tab) => {
        const selected = tab === value;
        const count = counts[tab] ?? 0;
        return (
          <button
            key={tab}
            ref={(node) => {
              if (node) refs.current.set(tab, node);
              else refs.current.delete(tab);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(tab)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{SESSION_TAB_LABELS[tab]}</span>
            {count > 0 && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1 text-[10px] tabular-nums",
                  selected ? "bg-muted" : "bg-background/60",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The sidebar's foot when the daemon reports storage health (the TUI's
 * Maintenance tab analogue): the inventory's maintenance lives on the
 * Storage settings page, so the list points there instead of duplicating it.
 */
export function StorageMaintenanceLink() {
  return (
    <div className="px-4 pt-3">
      <Link
        href="/workspace/settings/storage"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Storage &amp; maintenance
        <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
