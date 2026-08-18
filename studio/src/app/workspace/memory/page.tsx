"use client";

import { Brain, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type MemoryEntry, useAgentMemory } from "@/features/agent";
import { pageTitleClass } from "@/lib/typography";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkspaceMemoryPage() {
  const memory = useAgentMemory();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const entries = useMemo(
    () => [...memory.entries].sort((a, b) => a.title.localeCompare(b.title)),
    [memory.entries],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await memory.refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <h1
            className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}
          >
            Memory
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleRefresh}
            disabled={isRefreshing || memory.isLoading}
          >
            <RefreshCw
              className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            />
            Refresh
          </Button>
        </div>

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

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Read-only by design: the agent curates memory through
            injection-scanned tool calls. Ask it in chat to remember or forget
            something.
          </p>
          {memory.isSupported && !memory.isLoading && memory.store.sha256 && (
            <p className="font-mono text-xs text-muted-foreground/70">
              Store: {formatBytes(memory.store.sizeBytes)} ·{" "}
              {memory.store.sha256.slice(0, 12)}
            </p>
          )}
        </div>
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
