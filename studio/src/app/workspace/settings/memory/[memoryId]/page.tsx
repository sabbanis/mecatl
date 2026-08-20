"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAgentMemory } from "@/features/agent";
import { pageTitleClass } from "@/lib/typography";

export default function MemoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ memoryId: string }>();
  const memory = useAgentMemory();
  // The route segment arrives URL-encoded; entry ids are the raw store keys.
  const key = decodeURIComponent(params.memoryId);
  const entry = memory.entries.find((e) => e.id === key);

  if (!entry) {
    if (memory.isLoading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    if (!memory.isSupported) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium">
            Memory is disabled on this daemon
          </p>
          {memory.disabledReason && (
            <p className="text-sm text-muted-foreground">
              {memory.disabledReason}
            </p>
          )}
        </div>
      );
    }
    return notFound();
  }

  return (
    <div className="space-y-5">
      {/* On mobile the settings back-bar already leads to the Memory list. */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-fit gap-1 self-start rounded-full px-4 max-[499px]:hidden"
        onClick={() => router.push("/workspace/settings/memory")}
      >
        <span aria-hidden="true">‹</span>
        Back
      </Button>

      <h1
        className={pageTitleClass(
          "break-all text-3xl leading-tight max-[499px]:text-2xl",
        )}
      >
        {entry.title}
      </h1>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="flex w-full max-w-[465px] flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              What the agent remembers
            </h2>
            <p className="text-sm leading-relaxed text-foreground">
              {entry.content || "No description recorded."}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Details
          </h2>
          <div className="divide-y divide-border/60 rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted-foreground">Key</span>
              <span className="break-all text-right text-sm font-medium font-mono">
                {entry.id}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
