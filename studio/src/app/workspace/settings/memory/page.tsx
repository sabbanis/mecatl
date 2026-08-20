"use client";

import { Brain } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  directed,
  SortableHead,
  useTableSort,
} from "@/components/sortable-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type MemoryEntry, useAgentMemory } from "@/features/agent";

/** The agent's remembered facts, read-only — a settings subpage. */
export default function MemorySettingsPage() {
  const memory = useAgentMemory();
  const sort = useTableSort<"name" | "remembers">("name");

  const entries = useMemo(() => {
    const byName = (a: MemoryEntry, b: MemoryEntry) =>
      a.title.localeCompare(b.title);
    const primary = (a: MemoryEntry, b: MemoryEntry) =>
      sort.key === "remembers"
        ? (a.content || "").localeCompare(b.content || "")
        : byName(a, b);
    return [...memory.entries].sort(
      (a, b) => directed(sort.dir, primary(a, b)) || byName(a, b),
    );
  }, [memory.entries, sort.key, sort.dir]);

  if (!memory.isSupported) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
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
    );
  }

  if (memory.isLoading) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        Loading memory…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        The agent hasn&apos;t stored any facts yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="max-[499px]:hidden">
          <TableRow className="hover:bg-transparent">
            <SortableHead
              label="Name"
              sortKey="name"
              sort={sort}
              className="w-[280px] lg:w-[320px]"
            />
            <SortableHead label="Remembers" sortKey="remembers" sort={sort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <MemoryRow key={entry.id} entry={entry} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** One fact per row; the whole row opens the dedicated detail page. */
function MemoryRow({ entry }: { entry: MemoryEntry }) {
  const router = useRouter();
  const href = `/workspace/memory/${encodeURIComponent(entry.id)}`;

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="max-w-0 max-[499px]:w-full">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="block truncate text-sm font-medium hover:underline"
        >
          {entry.title}
        </Link>
        {/* Mobile collapses to a single stacked cell, like the other tables. */}
        <p className="line-clamp-2 text-xs text-muted-foreground min-[500px]:hidden">
          {entry.content || "No description recorded."}
        </p>
      </TableCell>
      <TableCell className="max-w-0 max-[499px]:hidden">
        <p className="line-clamp-1 text-xs whitespace-normal text-muted-foreground">
          {entry.content || "No description recorded."}
        </p>
      </TableCell>
    </TableRow>
  );
}
