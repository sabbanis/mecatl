"use client";

import { Bot, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { AgentSession, RosterAgent } from "@/features/agent";
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

/**
 * Touch long-press detection for a row. Mouse pointers are ignored (desktop
 * has the hover "…" menu); a hold of ~450ms without moving past the slop
 * fires, and the click that follows the release is swallowed by the caller
 * via `firedRef`. Android's native long-press contextmenu is suppressed for
 * touch so the sheet is the one menu.
 */
function useLongPress(onLongPress: () => void) {
  const firedRef = useRef(false);
  const state = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    startX: number;
    startY: number;
    touch: boolean;
  }>({ timer: null, startX: 0, startY: 0, touch: false });

  const clear = () => {
    if (state.current.timer) {
      clearTimeout(state.current.timer);
      state.current.timer = null;
    }
  };

  const handlers = {
    onPointerDown: (event: React.PointerEvent) => {
      state.current.touch = event.pointerType !== "mouse";
      if (!state.current.touch) return;
      firedRef.current = false;
      state.current.startX = event.clientX;
      state.current.startY = event.clientY;
      clear();
      state.current.timer = setTimeout(() => {
        state.current.timer = null;
        firedRef.current = true;
        onLongPress();
      }, 450);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (
        state.current.timer &&
        Math.hypot(
          event.clientX - state.current.startX,
          event.clientY - state.current.startY,
        ) > 10
      ) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (event: React.MouseEvent) => {
      if (state.current.touch) event.preventDefault();
    },
  };

  return { firedRef, handlers };
}

/** The long-press bottom sheet: the same rename/delete actions as the
 *  hover "…" menu, honoring the daemon row's capabilities and reasons. */
function SessionActionsSheet({
  session,
  actions,
  onClose,
}: {
  session: AgentSession;
  actions: SessionActions;
  onClose: () => void;
}) {
  const canRename = session.canRename === true;
  const canDelete = session.canDelete === true;
  const row =
    "flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50 disabled:opacity-50";

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="bottom" className="p-0">
        <SheetTitle className="sr-only">Chat options</SheetTitle>
        <div className="py-2">
          <p className="truncate px-4 pt-1 pb-2 text-sm font-semibold">
            {session.title || "Untitled"}
          </p>
          <button
            type="button"
            className={row}
            disabled={!canRename}
            onClick={() => {
              onClose();
              actions.onRename(session.id);
            }}
          >
            <Pencil className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-left">
              Rename
              {!canRename && session.renameReason && (
                <span className="block truncate text-xs text-muted-foreground">
                  {session.renameReason}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            className={row}
            disabled={!canDelete}
            onClick={() => {
              onClose();
              actions.onDelete(session.id);
            }}
          >
            <Trash2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-left">
              Delete chat
              {!canDelete && session.deleteReason && (
                <span className="block truncate text-xs text-muted-foreground">
                  {session.deleteReason}
                </span>
              )}
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const isRunning = session.isStreaming || session.state === "running";
  const longPress = useLongPress(() => setSheetOpen(true));

  return (
    <div
      className={cn(
        "group flex items-center border-l-[3px] py-2 pr-3 lg:pr-2 pl-3 transition-colors",
        isSelected
          ? "border-brand bg-brand/10"
          : "border-transparent hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={() => {
          // A click that ends a long-press is the release, not a selection.
          if (longPress.firedRef.current) {
            longPress.firedRef.current = false;
            return;
          }
          onSelect(session.id);
        }}
        onDoubleClick={
          session.canRename === true
            ? () => actions.onRename(session.id)
            : undefined
        }
        {...longPress.handlers}
        aria-current={isSelected ? "true" : undefined}
        aria-label={`Open chat: ${session.title || "Untitled"}${
          isRunning ? " (running)" : ""
        }`}
        className="flex-1 min-w-0 select-none text-left [-webkit-touch-callout:none]"
      >
        <span
          className={cn(
            "truncate text-[0.85rem] block select-none font-medium",
            isSelected
              ? "text-brand-ink"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {session.title || "Untitled"}
        </span>
      </button>
      <div className="shrink-0 ml-2 grid w-8 items-center justify-items-center [grid-template-areas:'slot']">
        {isRunning ? (
          <span
            role="img"
            aria-label="Running"
            className={cn(
              "[grid-area:slot] size-2 rounded-full bg-brand animate-pulse",
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
      {sheetOpen && (
        <SessionActionsSheet
          session={session}
          actions={actions}
          onClose={() => setSheetOpen(false)}
        />
      )}
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
          className="pl-[15px] pr-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          {showAll ? "Show less" : `Show ${sessions.length - 8} more`}
        </button>
      )}
    </div>
  );
}

/**
 * The daemon's real agent roster, listed below the chat groups. Agents are
 * not chat containers — selecting one simply starts a new chat draft.
 */
export function AgentList({
  agents,
  onStartChat,
}: {
  agents: RosterAgent[];
  onStartChat: () => void;
}) {
  return (
    <div className="flex flex-col">
      {agents.map((agent) => (
        <button
          key={agent.name}
          type="button"
          onClick={onStartChat}
          title={agent.description || undefined}
          aria-label={`New chat with ${agent.name}`}
          className="group flex items-center gap-2.5 border-l-[3px] border-transparent py-2 pr-3 pl-3 text-left transition-colors hover:bg-accent"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Bot className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-muted-foreground group-hover:text-foreground select-none">
            {agent.name}
          </span>
        </button>
      ))}
    </div>
  );
}
