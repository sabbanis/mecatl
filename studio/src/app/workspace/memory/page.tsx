"use client";

import { Brain } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { type MemoryEntry, useAgentMemory } from "@/features/agent";
import { pageTitleClass } from "@/lib/typography";

export default function WorkspaceMemoryPage() {
  const memory = useAgentMemory();

  const entries = useMemo(
    () => [...memory.entries].sort((a, b) => a.title.localeCompare(b.title)),
    [memory.entries],
  );

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <h1 className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}>
          Memory
        </h1>

        {!memory.isSupported ? (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                <Brain className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold">
                  Memory is disabled on this daemon
                </h2>
                <p className="text-sm text-muted-foreground">
                  The daemon is running without a user model (e.g. started with
                  --no-user-model), so there are no remembered facts to show.
                </p>
                {memory.disabledReason && (
                  <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                    {memory.disabledReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : memory.isLoading ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Loading memory…
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            The agent hasn&apos;t stored any facts yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {entries.map((entry) => (
              <MemoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Memory card: the entry key and its one-line description from the index. */
function MemoryCard({ entry }: { entry: MemoryEntry }) {
  return (
    <Link
      href={`/workspace/memory/${encodeURIComponent(entry.id)}`}
      className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
          <Brain className="size-5 text-foreground" />
        </div>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {entry.title}
        </h3>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {entry.content || "No description recorded."}
      </p>
    </Link>
  );
}
