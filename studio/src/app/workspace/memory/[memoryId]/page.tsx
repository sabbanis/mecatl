"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAgentMemory } from "@/features/agent";
import { formatRelativeTime } from "@/lib/formatters";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";

export default function MemoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ memoryId: string }>();
  const memory = useAgentMemory();
  const entry = memory.entries.find((e) => e.id === params.memoryId);

  if (!entry) {
    if (memory.isLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    return notFound();
  }

  return (
    <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
      <Button
        variant="outline"
        size="sm"
        className="w-fit self-start rounded-full h-9 px-4 gap-1"
        onClick={() => router.push("/workspace/memory")}
      >
        <span aria-hidden="true">‹</span>
        Back
      </Button>

      {/* Title + metadata pills */}
      <div className="space-y-3">
        <h1 className={pageTitleClass("text-[44px] leading-[1.05]")}>
          {entry.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill className="capitalize">{entry.section}</MetaPill>
          <MetaPill suppressHydrationWarning>
            Updated {formatRelativeTime(entry.updatedAt)} ago
          </MetaPill>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <aside className="flex w-full max-w-[465px] flex-col gap-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold">
              What the agent remembers
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {entry.content || "No description recorded."}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-base font-semibold">Details</h2>
          <div className="divide-y rounded-lg border bg-background">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted-foreground">Section</span>
              <span className="text-sm font-medium capitalize">
                {entry.section}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Last updated
              </span>
              <span
                suppressHydrationWarning
                className="text-sm font-medium tabular-nums"
              >
                {formatRelativeTime(entry.updatedAt)} ago
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Read-only — the agent decides what to remember as you work with it.
            Ask it in chat to remember or forget something.
          </p>
        </section>
      </div>
    </div>
  );
}

function MetaPill({
  children,
  className,
  suppressHydrationWarning,
}: {
  children: React.ReactNode;
  className?: string;
  suppressHydrationWarning?: boolean;
}) {
  return (
    <span
      suppressHydrationWarning={suppressHydrationWarning}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
