"use client";

import { ChevronRight, Plug } from "lucide-react";
import { useState } from "react";
import type { ToolCallInfo } from "@/features/agent";
import { cn } from "@/lib/utils";

function formatPreview(output: string | undefined): string {
  if (!output) return "";
  const clean = output.replace(/\n/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean;
}

export function ToolCallList({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const toolNames = toolCalls.map((t) => t.name).join(" · ");
  const count = toolCalls.length;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex items-center gap-2 w-full text-left py-1"
      >
        <ChevronRight
          className={cn(
            "size-3 text-muted-foreground/50 shrink-0 transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium">
            Activity: {count} tool{count !== 1 ? "s" : ""}
          </span>{" "}
          {toolNames}
        </span>
      </button>
      {expanded && (
        <div className="ml-5 mt-1 space-y-1">
          {toolCalls.map((tc) => (
            <div
              key={tc.callId}
              className="flex items-center gap-2 text-xs text-muted-foreground py-0.5"
            >
              <Plug className="size-3 shrink-0" />
              <span className="font-medium text-foreground/70">{tc.name}</span>
              {tc.output && (
                <span className="truncate">{formatPreview(tc.output)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
