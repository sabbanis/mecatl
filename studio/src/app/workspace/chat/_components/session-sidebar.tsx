"use client";

import { Ellipsis, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentSession } from "@/features/agent";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SessionActions {
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col pb-3">
      <span className="mb-1 truncate px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function SessionContextMenu({
  session,
  actions,
  children,
  onOpenChange,
}: {
  session: AgentSession;
  actions: SessionActions;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  // Eligibility comes from the daemon row's capabilities; an omitted
  // capability is a denial. A disabled item shows the daemon's reason inline
  // (disabled menu items swallow pointer events, so a tooltip can't open).
  const canRename = session.canRename === true;
  const canDelete = session.canDelete === true;

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="w-56"
      >
        <DropdownMenuItem
          disabled={!canRename}
          onClick={() => actions.onRename(session.id)}
          title={!canRename ? session.renameReason : undefined}
        >
          <Pencil className="size-4 mr-2 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            Rename
            {!canRename && session.renameReason && (
              <span className="block truncate text-xs text-muted-foreground">
                {session.renameReason}
              </span>
            )}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canDelete}
          onClick={() => actions.onDelete(session.id)}
          title={!canDelete ? session.deleteReason : undefined}
        >
          <Trash2 className="size-4 mr-2 shrink-0" />
          <span className="min-w-0">
            Delete chat
            {!canDelete && session.deleteReason && (
              <span className="block truncate text-xs text-muted-foreground">
                {session.deleteReason}
              </span>
            )}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SessionRow({
  session,
  isSelected,
  onSelect,
  actions,
}: {
  session: AgentSession;
  isSelected: boolean;
  onSelect: (id: string) => void;
  actions: SessionActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center border-l-[3px] border-transparent py-2 pr-3 lg:pr-2 pl-6 transition-colors",
        isSelected ? "border-brand-ink bg-accent" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        onDoubleClick={
          session.canRename === true
            ? () => actions.onRename(session.id)
            : undefined
        }
        aria-current={isSelected ? "true" : undefined}
        aria-label={`Open chat: ${session.title || "Untitled"}${
          session.isStreaming ? " (running)" : ""
        }`}
        className="flex-1 min-w-0 text-left"
      >
        <span
          className={cn(
            "truncate text-[0.85rem] block select-none",
            isSelected
              ? "font-medium text-brand-ink"
              : "font-medium text-muted-foreground group-hover:text-foreground",
          )}
        >
          {session.title || "Untitled"}
        </span>
      </button>
      <div className="shrink-0 ml-2 grid w-8 items-center justify-items-center [grid-template-areas:'slot']">
        {session.isStreaming ? (
          <Loader2
            aria-label="Running"
            className={cn(
              "[grid-area:slot] size-3.5 animate-spin text-brand",
              menuOpen ? "lg:invisible" : "lg:group-hover:invisible",
            )}
          />
        ) : (
          <span
            suppressHydrationWarning
            className={cn(
              "[grid-area:slot] text-xs text-muted-foreground/50 tabular-nums",
              menuOpen ? "lg:invisible" : "lg:group-hover:invisible",
            )}
          >
            {formatRelativeTime(session.updatedAt)}
          </span>
        )}
        <SessionContextMenu
          session={session}
          actions={actions}
          onOpenChange={setMenuOpen}
        >
          <button
            type="button"
            aria-label="Chat options"
            className={cn(
              "[grid-area:slot] flex items-center justify-center w-7 rounded text-muted-foreground hover:text-foreground",
              menuOpen
                ? "opacity-100"
                : "opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Ellipsis className="size-4" />
          </button>
        </SessionContextMenu>
      </div>
    </div>
  );
}

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  actions,
}: {
  sessions: AgentSession[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions: SessionActions;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, 8);

  return (
    <div className="flex flex-col">
      {visible.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          isSelected={session.id === selectedId}
          onSelect={onSelect}
          actions={actions}
        />
      ))}
      {sessions.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="pl-6 pr-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          {showAll ? "Show less" : `Show ${sessions.length - 8} more`}
        </button>
      )}
    </div>
  );
}
