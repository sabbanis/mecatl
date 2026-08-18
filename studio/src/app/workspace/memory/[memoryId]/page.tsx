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
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    if (!memory.isSupported) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
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

      <h1 className={pageTitleClass("break-all text-[44px] leading-[1.05]")}>
        {entry.title}
      </h1>

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
              <span className="text-sm text-muted-foreground">Key</span>
              <span className="break-all text-right text-sm font-medium font-mono">
                {entry.id}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Only the key and description are indexed here. The stored value is
            loaded by the agent itself when it recalls this entry during a turn.
          </p>
          <p className="text-xs text-muted-foreground">
            Read-only by design — the agent curates memory through
            injection-scanned tool calls. Ask it in chat to remember or forget
            something.
          </p>
        </section>
      </div>
    </div>
  );
}
