"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  ATRIUM_SEARCH_ENTRIES,
  ATRIUM_SEARCH_GROUPS,
} from "@/components/shell/atrium-search-data";
import { createStaticSearchProvider } from "@/components/shell/search-static";
import type { SearchEntry } from "@/components/shell/search-types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useShortcut } from "@/lib/shortcuts/use-shortcuts";
import { cn } from "@/lib/utils";

/** Atrium workspace results. */
const ALL_GROUPS = [...ATRIUM_SEARCH_GROUPS];
const provider = createStaticSearchProvider([...ATRIUM_SEARCH_ENTRIES]);

/**
 * The global nav search in the shell topbar. Opens a ⌘/Ctrl-K command palette
 * (built on cmdk) whose filtering is delegated to a `SearchProvider` — the
 * static index today, a server search later — so cmdk's own fuzzy filter is
 * turned off (`shouldFilter={false}`). Chat hits found inside a transcript show
 * a snippet of where the term matched. Selecting a result routes to it.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // App-wide shortcuts, wired through the central dispatcher: ⌘K toggles the
  // palette; `?` opens the keyboard-shortcuts reference.
  useShortcut("search.open", () => setOpen((prev) => !prev));
  useShortcut("shortcuts.open", () => router.push("/workspace/shortcuts"));

  const results = useMemo(() => provider.query(query), [query]);
  const byCategory = useMemo(() => {
    const map = new Map<string, { entry: SearchEntry; snippet?: string }[]>();
    for (const r of results) {
      const list = map.get(r.entry.category) ?? [];
      list.push(r);
      map.set(r.entry.category, list);
    }
    return map;
  }, [results]);

  const handleSelect = useCallback(
    (entry: SearchEntry) => {
      setOpen(false);
      router.push(entry.href);
    },
    [router],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Icon-only on narrow screens; a full search field from `sm` up.
          "size-9 justify-center px-0 sm:w-64 sm:justify-start sm:px-3",
        )}
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left text-sm sm:inline">
          Search…
        </span>
        <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[0.65rem] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global search"
        description="Search chats, memory, skills, connectors, and more"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search chats, memory, skills, connectors…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {ALL_GROUPS.map(({ category, heading }) => {
            const hits = byCategory.get(category);
            if (!hits || hits.length === 0) return null;
            return (
              <CommandGroup key={category} heading={heading}>
                {hits.map(({ entry, snippet }) => {
                  const Icon = entry.icon;
                  return (
                    <CommandItem
                      key={entry.id}
                      value={entry.id}
                      onSelect={() => handleSelect(entry)}
                    >
                      <Icon className="size-4 shrink-0" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{entry.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {snippet ?? entry.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
