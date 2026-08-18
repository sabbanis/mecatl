"use client";

import {
  Bot,
  Ellipsis,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Pencil,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentProject, AgentRoster, AgentSession } from "@/features/agent";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SessionActions {
  onRename: (id: string) => void;
  onMove: (sessionId: string, projectId: string | null) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  projects: AgentProject[];
}

export interface ProjectActions {
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onNewSubProject: () => void;
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
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="w-48"
      >
        <DropdownMenuItem onClick={() => actions.onRename(session.id)}>
          <Pencil className="size-4 mr-2 text-muted-foreground" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderClosed className="size-4 mr-2 text-muted-foreground" />
            Move to project
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-52">
            <DropdownMenuItem onClick={() => actions.onMove(session.id, null)}>
              <FolderClosed className="size-3.5 shrink-0 mr-1.5 text-muted-foreground" />
              <span className={cn(!session.projectId && "font-semibold")}>
                Chats
              </span>
            </DropdownMenuItem>
            {actions.projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => actions.onMove(session.id, p.id)}
              >
                <FolderClosed className="size-3.5 shrink-0 mr-1.5 text-muted-foreground" />
                <span
                  className={cn(p.id === session.projectId && "font-semibold")}
                >
                  {p.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => actions.onDelete(session.id)}
          className=""
        >
          <Trash2 className="size-4 mr-2" />
          Delete conversation
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
  indent = false,
  context,
}: {
  session: AgentSession;
  isSelected: boolean;
  onSelect: (id: string) => void;
  actions: SessionActions;
  indent?: boolean;
  /** Optional parent label (project or agent) shown under the title — used by
      the flat "Recent" list where chats aren't grouped under their owner. */
  context?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center border-l-[3px] border-transparent py-2 pr-3 lg:pr-2 transition-colors",
        indent ? "pl-7" : "pl-6",
        isSelected ? "border-brand-ink bg-accent" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        onDoubleClick={() => actions.onRename(session.id)}
        aria-current={isSelected ? "true" : undefined}
        aria-label={`Open chat: ${session.title || "Untitled"}${
          session.unread && !isSelected ? " (unread)" : ""
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
        {context && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-[0.7rem] text-muted-foreground/70">
            <context.icon className="size-3 shrink-0" />
            <span className="truncate">{context.label}</span>
          </span>
        )}
      </button>
      <div className="shrink-0 ml-2 grid w-8 items-center justify-items-center [grid-template-areas:'slot']">
        {session.unread && !isSelected ? (
          <div
            className={cn(
              "[grid-area:slot] size-2 rounded-full bg-brand",
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
  contextFor,
}: {
  sessions: AgentSession[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions: SessionActions;
  /** Resolves a chat's parent (project/agent) label + icon for the flat list. */
  contextFor?: (
    session: AgentSession,
  ) =>
    | { label: string; icon: React.ComponentType<{ className?: string }> }
    | undefined;
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
          context={contextFor?.(session)}
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

function ProjectContextMenu({
  project,
  actions,
  children,
  onOpenChange,
}: {
  project: AgentProject;
  actions: ProjectActions;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-52"
      >
        <DropdownMenuItem onClick={() => actions.onRename(project.id)}>
          <Pencil className="size-4 mr-2 text-muted-foreground" />
          <p className="font-medium">Rename project</p>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={actions.onNewSubProject}>
          <FolderPlus className="size-4 mr-2 text-muted-foreground" />
          <p className="font-medium">New sub-project</p>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => actions.onDelete(project.id)}
          className=""
        >
          <Trash2 className="size-4 mr-2" />
          <p className="font-medium">Delete project</p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Remembers each project's expanded/collapsed state by id, module-wide.
 * Selecting a chat remounts the chat workspace (Next re-keys the route), which
 * would otherwise reset every ProjectItem's local `open` state and collapse the
 * folders the user had opened. Seeding from — and writing back to — this store
 * keeps them as the user left them across the remount.
 */
const projectOpenStore = new Map<string, boolean>();

export function ProjectItem({
  project,
  sessions,
  selectedId,
  selectedProjectId,
  onSelectSession,
  onSelectProject,
  onNewChat,
  sessionActions,
  projectActions,
}: {
  project: AgentProject;
  sessions: AgentSession[];
  selectedId: string;
  selectedProjectId: string | null;
  onSelectSession: (id: string) => void;
  onSelectProject: (id: string) => void;
  onNewChat: (projectId: string) => void;
  sessionActions: SessionActions;
  projectActions: ProjectActions;
}) {
  const isProjectSelected = project.id === selectedProjectId;
  const hasSelectedChat = sessions.some((s) => s.id === selectedId);
  const [open, setOpenState] = useState(
    () =>
      projectOpenStore.get(project.id) ??
      (isProjectSelected || hasSelectedChat),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Persist expand/collapse to the module store so it survives the remount.
  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        projectOpenStore.set(project.id, next);
        return next;
      });
    },
    [project.id],
  );

  // Auto-expand when this project — or a chat inside it — becomes active, so
  // the active conversation is always visible in the list. The user can still
  // collapse it manually afterwards (this only forces open, never closed).
  useEffect(() => {
    if (isProjectSelected || hasSelectedChat) setOpen(true);
  }, [isProjectSelected, hasSelectedChat, setOpen]);

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "group flex items-center gap-1 border-l-[3px] border-transparent pl-3 pr-2 py-2 transition-colors hover:bg-accent",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} project: ${project.name}`}
          className="flex shrink-0 items-center justify-center size-5"
        >
          {open ? (
            <FolderOpen className="size-3 text-muted-foreground" />
          ) : (
            <FolderClosed className="size-3 text-muted-foreground" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            // Closed → open the folder and jump into its first chat.
            // Open → collapse it (leaving the current chat as-is).
            if (open) {
              setOpen(false);
            } else {
              setOpen(true);
              onSelectProject(project.id);
            }
          }}
          aria-label={
            open
              ? `Collapse project: ${project.name}`
              : `Open project: ${project.name}`
          }
          className="flex-1 min-w-0 text-left"
        >
          <span
            className={cn(
              "text-[0.85rem] font-medium truncate block select-none",
              "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {project.name}
          </span>
        </button>
        <div
          className={cn(
            "shrink-0 flex items-center gap-0.5 transition-opacity",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNewChat(project.id);
            }}
            className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground"
            aria-label={`New chat in ${project.name}`}
          >
            <SquarePen className="size-3.5" />
          </button>
          <ProjectContextMenu
            project={project}
            actions={projectActions}
            onOpenChange={setMenuOpen}
          >
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground"
            >
              <Ellipsis className="size-4" />
            </button>
          </ProjectContextMenu>
        </div>
      </div>
      {open && sessions.length > 0 && (
        <div className="flex flex-col pb-3">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isSelected={session.id === selectedId}
              onSelect={onSelectSession}
              actions={sessionActions}
              indent
            />
          ))}
        </div>
      )}
      {open && sessions.length === 0 && (
        <p className="pl-6 py-2 text-xs text-muted-foreground/40">
          No conversations yet
        </p>
      )}
    </div>
  );
}

/**
 * Remembers each agent folder's expanded/collapsed state by id, module-wide.
 * Same rationale as `projectOpenStore`: selecting a chat remounts the workspace,
 * which would otherwise reset every AgentItem's local `open` state.
 */
const agentOpenStore = new Map<string, boolean>();

/**
 * A collapsible folder for one enabled agent, listing its chats below it — the
 * agent-side mirror of {@link ProjectItem}. The header row has no overview page;
 * clicking the name just expands the folder.
 */
export function AgentItem({
  agent,
  sessions,
  selectedId,
  onSelectSession,
  onNewChat,
  sessionActions,
}: {
  agent: AgentRoster;
  sessions: AgentSession[];
  selectedId: string;
  onSelectSession: (id: string) => void;
  onNewChat?: (agentId: string) => void;
  sessionActions: SessionActions;
}) {
  const hasSelectedChat = sessions.some((s) => s.id === selectedId);
  const [open, setOpenState] = useState(
    () => agentOpenStore.get(agent.id) ?? hasSelectedChat,
  );

  // Persist expand/collapse to the module store so it survives the remount.
  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        agentOpenStore.set(agent.id, next);
        return next;
      });
    },
    [agent.id],
  );

  // Auto-expand when a chat inside this agent becomes active, so the active
  // conversation is always visible. Only forces open, never closed.
  useEffect(() => {
    if (hasSelectedChat) setOpen(true);
  }, [hasSelectedChat, setOpen]);

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-1 border-l-[3px] border-transparent pl-3 pr-2 py-2 transition-colors hover:bg-accent">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} agent: ${agent.name}`}
          className="flex shrink-0 items-center justify-center size-5"
        >
          {/* Agents use a single bot glyph regardless of open state; the folder
              icons are reserved for projects. Expand/collapse is by click. */}
          <Bot className="size-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} agent: ${agent.name}`}
          className="flex-1 min-w-0 text-left"
        >
          <span className="text-[0.85rem] font-medium truncate block select-none text-muted-foreground group-hover:text-foreground">
            {agent.name}
          </span>
        </button>
        {onNewChat && (
          <div className="shrink-0 flex items-center gap-0.5 transition-opacity opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNewChat(agent.id);
              }}
              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground"
              aria-label={`New chat with ${agent.name}`}
            >
              <SquarePen className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {open && sessions.length > 0 && (
        <div className="flex flex-col pb-3">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isSelected={session.id === selectedId}
              onSelect={onSelectSession}
              actions={sessionActions}
              indent
            />
          ))}
        </div>
      )}
      {open && sessions.length === 0 && (
        <p className="pl-6 py-2 text-xs text-muted-foreground/40">
          No conversations yet
        </p>
      )}
    </div>
  );
}
