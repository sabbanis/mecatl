"use client";

import { BookOpen, Brain, Scale, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { type MemoryEntry, useAgentMemory } from "@/features/agent";
import { formatRelativeTime } from "@/lib/formatters";
import { pageTitleClass } from "@/lib/typography";

const SECTION_ICON: Record<string, typeof Brain> = {
  preferences: SlidersHorizontal,
  context: BookOpen,
  rules: Scale,
};

function sectionIcon(section: string): typeof Brain {
  return SECTION_ICON[section] ?? Brain;
}

export default function WorkspaceMemoryPage() {
  const memory = useAgentMemory();

  // Everything the agent remembers, newest first — each card already carries a
  // section badge, so no per-section grouping is needed.
  const entries = useMemo(
    () => [...memory.entries].sort((a, b) => b.updatedAt - a.updatedAt),
    [memory.entries],
  );

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1
            className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}
          >
            Memory
          </h1>
        </div>

        {memory.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Nothing remembered yet — the agent writes here when it learns
            something durable about you.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {entries.map((entry) => (
              <MemoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {!memory.canWrite && (
          <p className="text-xs text-muted-foreground">
            Read-only by design: the agent decides what to remember as you work
            with it. Ask it in chat to remember or forget something.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Memory card, mirroring the connector/skill catalog card: a section icon,
 * title, last-updated line, a section badge, and the remembered fact.
 */
function MemoryCard({ entry }: { entry: MemoryEntry }) {
  const Icon = sectionIcon(entry.section);
  return (
    <Link
      href={`/workspace/memory/${entry.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Icon className="size-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{entry.title}</h3>
            <p
              suppressHydrationWarning
              className="mt-0.5 truncate text-xs text-muted-foreground"
            >
              Updated {formatRelativeTime(entry.updatedAt)} ago
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 capitalize">
          {entry.section}
        </Badge>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {entry.content || "No description recorded."}
      </p>
    </Link>
  );
}
