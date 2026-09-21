// SPDX-License-Identifier: Apache-2.0

import {
  listConfiguredSkillsOptions,
  listLearnedSkillsOptions,
  listSchedulesOptions,
  listSessionsOptions,
  listUserMemoryOptions,
} from "@mecatl-studio/contracts/query";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  Compass,
  GraduationCap,
  LoaderCircle,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "../../components/ui/kbd";
import { cn } from "../../lib/utils";
import { useThreadSessionIds } from "../chat/thread-map";
import { useShortcut } from "../shortcuts/shortcut-provider";
import { keycaps } from "../shortcuts/shortcut-registry";
import {
  buildGlobalSearchIndex,
  type GlobalSearchItem,
  type GlobalSearchTarget,
  groupSearchResults,
  searchGlobalIndex,
} from "./search-index";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWasOpen = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sessions = useQuery({ ...listSessionsOptions(), enabled: open });
  const schedules = useQuery({ ...listSchedulesOptions(), enabled: open });
  const configuredSkills = useQuery({ ...listConfiguredSkillsOptions(), enabled: open });
  const learnedSkills = useQuery({ ...listLearnedSkillsOptions(), enabled: open });
  const memory = useQuery({ ...listUserMemoryOptions(), enabled: open });
  const threadSessionIds = useThreadSessionIds();
  const inventories = [sessions, schedules, configuredSkills, learnedSkills, memory];

  const index = useMemo(
    () =>
      buildGlobalSearchIndex({
        configuredSkills: configuredSkills.data?.supported ? configuredSkills.data.items : [],
        learnedSkills: learnedSkills.data?.supported ? learnedSkills.data.items : [],
        memory: memory.data?.supported ? memory.data.items : [],
        schedules: schedules.data?.supported ? schedules.data.items : [],
        sessions: (sessions.data?.items ?? []).filter(
          (session) => !threadSessionIds.has(session.id),
        ),
      }),
    [
      configuredSkills.data,
      learnedSkills.data,
      memory.data,
      schedules.data,
      sessions.data,
      threadSessionIds,
    ],
  );
  const results = useMemo(() => searchGlobalIndex(index, query), [index, query]);
  const groups = useMemo(() => groupSearchResults(results), [results]);
  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const loading = inventories.some((inventory) => inventory.isPending);
  const partialError = inventories.some((inventory) => inventory.isError);
  const mac = navigator.platform.includes("Mac");

  useShortcut("search.open", () => setOpen((current) => !current));
  useShortcut("settings.open", () => void navigate({ to: "/workspace/settings" }));
  useShortcut("shortcuts.open", () => void navigate({ to: "/workspace/shortcuts" }));
  useShortcut("shortcuts.open.mod", () => void navigate({ to: "/workspace/shortcuts" }));

  useEffect(() => {
    if (!open && !searchWasOpen.current) return;
    searchWasOpen.current = open;
    const frame = window.requestAnimationFrame(() =>
      open ? inputRef.current?.focus() : triggerRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  async function choose(target: GlobalSearchTarget) {
    setOpen(false);
    setQuery("");
    if (target.kind === "chat") {
      await navigate({ search: { sessionId: target.sessionId }, to: "/workspace/chat" });
    } else if (target.kind === "schedule") {
      await navigate({
        params: { scheduleName: target.scheduleName },
        to: "/workspace/schedules/$scheduleName",
      });
    } else if (target.kind === "page") {
      await navigate({ to: target.to });
    } else if (target.kind === "settingsSection") {
      await navigate({
        params: { section: target.section },
        search: { item: undefined },
        to: "/workspace/settings/$section",
      });
    } else if (target.kind === "memory") {
      await navigate({
        params: { section: "memory" },
        search: { item: target.item },
        to: "/workspace/settings/$section",
      });
    } else if (target.item) {
      await navigate({
        params: { item: target.item, view: target.view },
        to: "/workspace/skills/$view/$item",
      });
    } else {
      await navigate({ search: { item: undefined, view: target.view }, to: "/workspace/skills" });
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        flatResults.length ? Math.min(current + 1, flatResults.length - 1) : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      void choose(flatResults[activeIndex].target);
    }
  }

  return (
    <>
      <button
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Search"
        className="flex h-9 items-center gap-2 rounded-full px-2.5 text-[#a5b8b4] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 min-[900px]:px-3"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Search aria-hidden="true" className="size-[17px]" />
        <span className="hidden text-xs min-[900px]:inline">Search</span>
        <span className="hidden items-center gap-0.5 min-[1100px]:flex">
          {keycaps("mod+k", mac).map((keycap) => (
            <Kbd key={keycap} size="sm">
              {keycap}
            </Kbd>
          ))}
        </span>
      </button>

      {open && (
        <div
          aria-labelledby="global-search-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[max(4rem,12dvh)] backdrop-blur-[2px]"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl">
            <h2 className="sr-only" id="global-search-title">
              Search Mecatl
            </h2>
            <div className="flex items-center gap-3 border-b px-4">
              {loading ? (
                <LoaderCircle
                  aria-label="Loading searchable items"
                  className="size-5 shrink-0 animate-spin text-muted-foreground"
                />
              ) : (
                <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              )}
              <input
                aria-activedescendant={
                  results[activeIndex] ? `global-search-result-${activeIndex}` : undefined
                }
                aria-controls="global-search-results"
                aria-label="Search chats, schedules, skills, and memory"
                autoComplete="off"
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search chats, schedules, skills, and memory…"
                ref={inputRef}
                type="search"
                value={query}
              />
              <button
                aria-label="Close search"
                className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div
              className="max-h-[min(28rem,65dvh)] overflow-y-auto p-2"
              id="global-search-results"
            >
              {!query.trim() ? (
                <SearchPrompt />
              ) : flatResults.length === 0 && !loading ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No results for “{query.trim()}”
                </p>
              ) : (
                (() => {
                  let resultIndex = -1;
                  return groups.map((group) => (
                    <div className="mb-1 last:mb-0" key={group.section}>
                      <p className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {group.section}
                      </p>
                      {group.items.map((result) => {
                        resultIndex += 1;
                        const index = resultIndex;
                        return (
                          <SearchResult
                            active={index === activeIndex}
                            id={`global-search-result-${index}`}
                            item={result}
                            key={result.id}
                            onChoose={() => void choose(result.target)}
                            onFocus={() => setActiveIndex(index)}
                          />
                        );
                      })}
                    </div>
                  ));
                })()
              )}
            </div>

            <div className="flex min-h-9 items-center justify-between gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
              <span>
                {partialError
                  ? "Some inventories could not be searched"
                  : query.trim() && !loading
                    ? `${flatResults.length} result${flatResults.length === 1 ? "" : "s"}`
                    : "Results stay in this browser"}
              </span>
              <span className="hidden sm:inline">↑↓ select · Enter open · Esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchPrompt() {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium">Find anything in your workspace</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Search titles, descriptions, prompts, owners, models, and statuses.
      </p>
    </div>
  );
}

function SearchResult({
  active,
  id,
  item,
  onChoose,
  onFocus,
}: {
  active: boolean;
  id: string;
  item: GlobalSearchItem;
  onChoose: () => void;
  onFocus: () => void;
}) {
  const Icon =
    item.target.kind === "chat"
      ? MessageCircle
      : item.target.kind === "schedule"
        ? CalendarClock
        : item.target.kind === "memory"
          ? Brain
          : item.target.kind === "page" || item.target.kind === "settingsSection"
            ? Compass
            : GraduationCap;
  return (
    <button
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
      id={id}
      onClick={onChoose}
      onFocus={onFocus}
      onMouseEnter={onFocus}
      type="button"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{item.title}</span>
        {item.description && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.description}
          </span>
        )}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      />
    </button>
  );
}
