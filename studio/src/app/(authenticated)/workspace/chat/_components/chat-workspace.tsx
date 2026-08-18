"use client";

import {
  Bell,
  Bot,
  FolderClosed,
  FolderPlus,
  Loader2,
  PanelLeft,
  SquarePen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AgentMessage,
  type AgentSession,
  type ApprovalChoice,
  type ClarificationRequest,
  useAgentChat,
  useAgentProjects,
  useAgentRoster,
  useAgentSessions,
} from "@/features/agent";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsCompact, useIsMobile } from "@/hooks/use-mobile";
import { useNavReopenSidebar } from "@/hooks/use-nav-reopen-sidebar";
import { usePrompt } from "@/hooks/use-prompt";
import { useSidebarWidth } from "@/hooks/use-sidebar-width";
import { useShortcut } from "@/lib/shortcuts/use-shortcuts";
import { cn } from "@/lib/utils";
import { ChatInput } from "../../_components/chat-input";
import { ResizeHandle } from "../../_components/resize-handle";
import { ChatView } from "./chat-view";
import {
  AgentItem,
  type ProjectActions,
  ProjectItem,
  type SessionActions,
  SessionList,
  SidebarGroup,
} from "./session-sidebar";

/** Route for a chat, or the base when none is selected. */
const chatHref = (id?: string) =>
  id ? `/workspace/chat/${id}` : "/workspace/chat";

/** One-click prompts on the blank-workspace state, to seed the first message. */
const STARTER_PROMPTS = [
  "Summarise what changed in the repo this week",
  "Draft a plan for a new feature",
  "Review my open pull requests",
  "Find and explain a bug in the codebase",
] as const;

const DAY_MS = 86_400_000;

/**
 * Bucket recency-sorted sessions into relative day groups (Today, Yesterday,
 * Previous 7 days, Older) for the flat "Recent" list. Empty buckets are
 * dropped, and the order is preserved.
 */
function groupSessionsByDay(
  sessions: AgentSession[],
): { label: string; sessions: AgentSession[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  const order = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
  const buckets: Record<(typeof order)[number], AgentSession[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  for (const s of sessions) {
    const ts = s.updatedAt ?? 0;
    const label =
      ts >= t0
        ? "Today"
        : ts >= t0 - DAY_MS
          ? "Yesterday"
          : ts >= t0 - 7 * DAY_MS
            ? "Previous 7 days"
            : "Older";
    buckets[label].push(s);
  }
  return order
    .filter((l) => buckets[l].length > 0)
    .map((l) => ({ label: l, sessions: buckets[l] }));
}

function SidebarContent({
  handleNewChat,
  handleNewProject,
  sessionsLoading,
  filteredProjects,
  filteredAgents,
  selectedId,
  handleSelectSession,
  selectedProjectId,
  handleSelectProject,
  handleNewChatInProject,
  handleNewChatWithAgent,
  sessionActions,
  makeProjectActions,
  recentView,
  onToggleRecentView,
  recentGroups,
  recentContextFor,
}: {
  handleNewChat: () => void;
  handleNewProject: () => void;
  sessionsLoading: boolean;
  filteredProjects: Array<{
    project: ReturnType<typeof useAgentProjects>["projects"][0];
    sessions: ReturnType<typeof useAgentSessions>["sessions"];
  }>;
  filteredAgents: Array<{
    agent: ReturnType<typeof useAgentRoster>["agents"][0];
    sessions: ReturnType<typeof useAgentSessions>["sessions"];
  }>;
  selectedId: string;
  handleSelectSession: (id: string) => void;
  selectedProjectId: string | null;
  handleSelectProject: (id: string) => void;
  handleNewChatInProject: (projectId: string, seed?: string) => void;
  handleNewChatWithAgent: (agentId: string, seed?: string) => void;
  sessionActions: SessionActions;
  makeProjectActions: (id: string) => ProjectActions;
  /** When on, the grouped Projects/Agents view is replaced by a flat,
      most-recent-first list of every conversation. */
  recentView: boolean;
  onToggleRecentView: () => void;
  recentGroups: { label: string; sessions: AgentSession[] }[];
  recentContextFor: (
    session: ReturnType<typeof useAgentSessions>["sessions"][number],
  ) =>
    | { label: string; icon: React.ComponentType<{ className?: string }> }
    | undefined;
}) {
  return (
    <>
      {/* Section-title header: the panel title, with New chat / New project as
          icon buttons on the right — styled like the chat conversation header. */}
      <div className="flex h-[60px] lg:h-[65px] shrink-0 items-center gap-0.5 border-b border-border px-3 lg:px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Chats</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              onClick={handleNewChat}
              aria-label="New chat"
            >
              <SquarePen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              onClick={handleNewProject}
              aria-label="New project"
            >
              <FolderPlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New project</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                recentView
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground",
              )}
              onClick={onToggleRecentView}
              aria-label="Recent conversations"
              aria-pressed={recentView}
            >
              <Bell className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {recentView ? "Grouped view" : "Recent conversations"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentView ? (
          <div className="flex flex-col gap-3">
            {recentGroups.length > 0 ? (
              recentGroups.map((group) => (
                <SidebarGroup key={group.label} label={group.label}>
                  <SessionList
                    sessions={group.sessions}
                    selectedId={selectedId}
                    onSelect={handleSelectSession}
                    actions={sessionActions}
                    contextFor={recentContextFor}
                  />
                </SidebarGroup>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground/50 py-8">
                No conversations yet
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProjects.length > 0 && (
              <SidebarGroup label="Projects">
                {filteredProjects.map((pw) => (
                  <ProjectItem
                    key={pw.project.id}
                    project={pw.project}
                    sessions={pw.sessions}
                    selectedId={selectedId}
                    selectedProjectId={selectedProjectId}
                    onSelectSession={handleSelectSession}
                    onSelectProject={handleSelectProject}
                    onNewChat={handleNewChatInProject}
                    sessionActions={sessionActions}
                    projectActions={makeProjectActions(pw.project.id)}
                  />
                ))}
              </SidebarGroup>
            )}
            {filteredAgents.length > 0 && (
              <SidebarGroup label="Agents">
                {filteredAgents.map((aw) => (
                  <AgentItem
                    key={aw.agent.id}
                    agent={aw.agent}
                    sessions={aw.sessions}
                    selectedId={selectedId}
                    onSelectSession={handleSelectSession}
                    onNewChat={handleNewChatWithAgent}
                    sessionActions={sessionActions}
                  />
                ))}
              </SidebarGroup>
            )}
            {filteredProjects.length === 0 && filteredAgents.length === 0 && (
              <p className="text-center text-sm text-muted-foreground/50 py-8">
                No conversations yet
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Module mirror of the open project overview. Unlike the conversation it isn't
 * URL-driven, so the chat-workspace remount on navigation (Next re-keys the
 * optional-catch-all route) would reset it to null — and the default-select
 * would then re-pick the first project, making a just-selected project "jump"
 * to Platform Engineering. Seeding from / writing back to this mirror keeps the
 * selection across the remount. Resets on a full page reload.
 */
let selectedProjectStore: string | null = null;

/**
 * A "next step" chip on a project overview starts a new chat *and* pre-fills its
 * composer with the suggested prompt (without sending it). Starting the chat
 * navigates, and Next remounts the workspace across that navigation, so the seed
 * can't live in component state. It rides this module mirror, keyed by the new
 * session's id: whichever workspace instance ends up showing that session reads
 * the seed at render time (never a lifecycle callback, which would let the
 * short-lived pre-navigation instance consume it first). It is cleared when the
 * user actually sends, so it can't leak into a later conversation.
 */
let pendingSeed: { sessionId: string; text: string } | null = null;

/**
 * Whether the sidebar shows the flat "Recent" list instead of the grouped
 * Projects/Agents view. Mirrored at module scope so the choice survives the
 * navigation remount (like the other sidebar stores). Resets on a full reload.
 */
let recentViewStore = false;

/**
 * The chat workspace. The selected conversation is driven by the URL
 * (`/workspace/chat/<sessionId>`, passed in as `sessionId`), so deep-links,
 * back/forward, and hard reloads all resolve to the same conversation without a
 * separate selection effect. The open project overview is not URL-driven, so it
 * is mirrored in `selectedProjectStore` to survive the navigation remount.
 */
export function ChatWorkspace({ sessionId }: { sessionId?: string }) {
  const {
    sessions,
    isLoading: sessionsLoading,
    createSession,
    deleteSession,
    renameSession,
    pinSession,
    archiveSession,
  } = useAgentSessions();
  const { projects, createProject, deleteProject, assignSessionToProject } =
    useAgentProjects();
  const { agents } = useAgentRoster();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isCompact = useIsCompact();
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();

  // Selection is URL-driven; the state mirror keeps it in sync while also
  // allowing an optimistic update before the client navigation settles.
  const [selectedId, setSelectedIdState] = useState(sessionId ?? "");
  useEffect(() => {
    setSelectedIdState(sessionId ?? "");
  }, [sessionId]);

  /** Select a conversation: optimistic state + a route push so the URL leads. */
  const selectId = useCallback(
    (id: string) => {
      setSelectedIdState(id);
      router.push(chatHref(id));
    },
    [router],
  );

  const [selectedProjectId, setSelectedProjectIdState] = useState<
    string | null
  >(() => selectedProjectStore);
  const setSelectedProjectId = useCallback((value: string | null) => {
    selectedProjectStore = value;
    setSelectedProjectIdState(value);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile && !isCompact);
  const wasCompactRef = useRef(isCompact);
  const didAutoSelectRef = useRef(false);
  // Mirrors `sidebarOpen` for reads inside the stable side-panel handler.
  const sidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);
  // Remembers whether the chat list was open before a side panel forced it
  // closed, so closing the panel restores the user's prior choice.
  const sidebarBeforeSidePanelRef = useRef<boolean | null>(null);

  const handleSidePanelOpenChange = useCallback((open: boolean) => {
    if (open) {
      if (sidebarBeforeSidePanelRef.current === null) {
        sidebarBeforeSidePanelRef.current = sidebarOpenRef.current;
        setSidebarOpen(false);
      }
    } else if (sidebarBeforeSidePanelRef.current !== null) {
      setSidebarOpen(sidebarBeforeSidePanelRef.current);
      sidebarBeforeSidePanelRef.current = null;
    }
  }, []);

  // On first load with no chat in the URL, open the first project's first chat
  // so the workspace lands directly in a conversation. If that project has no
  // chats, fall back to the first non-archived chat anywhere. A chat already in
  // the URL seeds the selection directly.
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (sessionsLoading) return;
    if (sessionId) {
      didAutoSelectRef.current = true;
      return;
    }
    // Open into a chat: the persisted project's first chat if one is selected,
    // else the first project's. Falls back to the most recent chat anywhere.
    const targetProjectId = selectedProjectId ?? projects[0]?.id;
    const firstProjectChat = targetProjectId
      ? sessions.find((s) => s.projectId === targetProjectId && !s.archived)
      : undefined;
    if (firstProjectChat) {
      didAutoSelectRef.current = true;
      if (targetProjectId) setSelectedProjectId(targetProjectId);
      selectId(firstProjectChat.id);
      return;
    }
    const candidates = sessions.filter((s) => !s.archived);
    if (candidates.length === 0) return;
    didAutoSelectRef.current = true;
    selectId(candidates[0].id);
  }, [
    sessions,
    projects,
    sessionsLoading,
    sessionId,
    selectedProjectId,
    selectId,
    setSelectedProjectId,
  ]);

  // Sync sidebar visibility with viewport transitions (see original notes):
  // entering compact closes it; leaving compact reopens it.
  useEffect(() => {
    const wasCompact = wasCompactRef.current;
    if (!wasCompact && isCompact) {
      setSidebarOpen(false);
    } else if (wasCompact && !isCompact) {
      setSidebarOpen(true);
    }
    wasCompactRef.current = isCompact;
  }, [isCompact]);
  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const pendingMessageRef = useRef<string | null>(null);
  // Seed for the blank-workspace composer, set when a starter prompt is picked.
  const [emptySeed, setEmptySeed] = useState<string | null>(null);
  const clearEmptySeed = useCallback(() => setEmptySeed(null), []);

  const {
    messages,
    isStreaming,
    sendMessage,
    pendingApproval,
    respondToApproval,
    pendingClarification,
    respondToClarification,
    error: chatError,
    harnessLive,
    usage: liveUsage,
  } = useAgentChat(selectedId || null);

  // Decision transcript lines and a reachable elicitation demo are layered on
  // top of the agent hook. A pending clarification is seeded on the "Write API
  // documentation" demo session so the elicitation panel is reachable.
  const [echoes, setEchoes] = useState<Record<string, AgentMessage[]>>({});
  const [clarifyResolved, setClarifyResolved] = useState(false);

  const localClarification: ClarificationRequest | null =
    selectedId === "s3" && !clarifyResolved
      ? {
          clarifyId: "clar-demo-1",
          sessionId: "s3",
          question:
            "Before I generate the API documentation, which format should I produce?\n1. OpenAPI (Swagger) spec\n2. Markdown reference pages\n3. Both",
        }
      : null;

  const effectiveClarification = pendingClarification ?? localClarification;
  const displayedMessages = selectedId
    ? [...messages, ...(echoes[selectedId] ?? [])]
    : messages;

  const pushEcho = useCallback(
    (sid: string, content: string, role: AgentMessage["role"]) => {
      setEchoes((prev) => ({
        ...prev,
        [sid]: [
          ...(prev[sid] ?? []),
          {
            id: `echo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            content,
            timestamp: Date.now(),
          },
        ],
      }));
    },
    [],
  );

  const handleRespondApproval = useCallback(
    (choice: ApprovalChoice) => {
      respondToApproval(choice);
      if (!selectedId) return;
      const label =
        choice === "deny"
          ? "Denied — the agent will not run those actions."
          : choice === "once"
            ? "Allowed once."
            : choice === "session"
              ? "Allowed for this session."
              : "Always allowed.";
      pushEcho(selectedId, `Permission decision: ${label}`, "assistant");
    },
    [respondToApproval, selectedId, pushEcho],
  );

  const handleRespondClarification = useCallback(
    (response: string) => {
      const isLocal = pendingClarification === null && localClarification;
      const sid = selectedId ?? "";
      const choiceLabels = [
        "OpenAPI (Swagger) spec",
        "Markdown reference pages",
        "Both",
      ];
      const answer =
        isLocal && /^\d+$/.test(response)
          ? (choiceLabels[Number(response) - 1] ?? response)
          : response;
      if (isLocal) {
        setClarifyResolved(true);
        pushEcho(sid, answer, "user");
        pushEcho(
          sid,
          `Thanks — generating the API documentation as ${answer}.`,
          "assistant",
        );
      } else {
        respondToClarification(response);
        if (sid) pushEcho(sid, answer, "user");
      }
    },
    [
      pendingClarification,
      localClarification,
      selectedId,
      respondToClarification,
      pushEcho,
    ],
  );

  useEffect(() => {
    if (selectedId && pendingMessageRef.current) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage(msg);
    }
  }, [selectedId, sendMessage]);

  useNavReopenSidebar(setSidebarOpen);

  const filteredProjects = projects.map((p) => ({
    project: p,
    sessions: sessions.filter((s) => s.projectId === p.id),
  }));

  const filteredAgents = agents
    .filter((a) => a.enabled)
    .map((a) => ({
      agent: a,
      sessions: sessions.filter((s) => s.agentId === a.id),
    }));

  const selectedSession = sessions.find((s) => s.id === selectedId);
  // The assistant reflects the agent handling this chat (agent-scoped chats
  // are answered by that agent); everything else is the default assistant.
  const activeAgent = selectedSession?.agentId
    ? agents.find((a) => a.id === selectedSession.agentId)
    : undefined;
  const botName = activeAgent?.name ?? "Asta";
  // A project is "active" only when selected with no chat open. Projects now
  // always open their first chat, so this stays null in normal use — kept for
  // the mobile list's layout rule below.
  const activeProject =
    selectedProjectId && !selectedSession
      ? projects.find((p) => p.id === selectedProjectId)
      : null;

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedProjectId(null);
      selectId(id);
      if (isMobile || isCompact) setSidebarOpen(false);
    },
    [selectId, isMobile, isCompact, setSelectedProjectId],
  );

  // Selecting a project opens its first chat rather than a project overview.
  // Empty projects get a fresh chat created on the spot.
  const handleSelectProject = useCallback(
    async (id: string) => {
      const firstChat = sessions.find((s) => s.projectId === id && !s.archived);
      const target = firstChat ?? (await createSession({ projectId: id }));
      setSelectedProjectId(id);
      selectId(target.id);
      if (isMobile || isCompact) setSidebarOpen(false);
    },
    [
      sessions,
      createSession,
      selectId,
      isMobile,
      isCompact,
      setSelectedProjectId,
    ],
  );

  // The plain "New chat" lands the conversation under the Personal Assistant
  // (a0) folder rather than in an orphaned "Chats" group, which no longer
  // exists — every chat now belongs to a project or an agent.
  const handleNewChat = useCallback(async () => {
    const session = await createSession({ agentId: "a0" });
    setSelectedProjectId(null);
    selectId(session.id);
    if (isMobile || isCompact) setSidebarOpen(false);
  }, [createSession, selectId, isMobile, isCompact, setSelectedProjectId]);

  const handleNewChatInProject = useCallback(
    async (projectId: string, seed?: string) => {
      const session = await createSession({ projectId });
      pendingSeed = seed ? { sessionId: session.id, text: seed } : null;
      setSelectedProjectId(projectId);
      selectId(session.id);
      if (isMobile || isCompact) setSidebarOpen(false);
    },
    [createSession, selectId, isMobile, isCompact, setSelectedProjectId],
  );

  const handleNewChatWithAgent = useCallback(
    async (agentId: string, seed?: string) => {
      const session = await createSession({ agentId });
      pendingSeed = seed ? { sessionId: session.id, text: seed } : null;
      setSelectedProjectId(null);
      selectId(session.id);
      if (isMobile || isCompact) setSidebarOpen(false);
    },
    [createSession, selectId, isMobile, isCompact, setSelectedProjectId],
  );

  const handleNewProject = useCallback(async () => {
    const name = await prompt({
      title: "New project",
      description:
        "Give your project a name to organize related conversations.",
      placeholder: "Project name",
      confirmText: "Create project",
    });
    if (!name) return;
    const project = await createProject(name);
    const session = await createSession({ projectId: project.id });
    setSelectedProjectId(project.id);
    selectId(session.id);
    if (isMobile || isCompact) setSidebarOpen(false);
  }, [
    createProject,
    createSession,
    selectId,
    isMobile,
    isCompact,
    prompt,
    setSelectedProjectId,
  ]);

  const handleSend = useCallback(
    (content: string) => {
      // Once the user sends, the pre-filled prompt has served its purpose.
      pendingSeed = null;
      sendMessage(content);
    },
    [sendMessage],
  );

  // The composer seed only applies to the conversation it was created for, read
  // at render so the surviving post-navigation instance is the one that gets it.
  const draftForSelected =
    pendingSeed && pendingSeed.sessionId === selectedId
      ? pendingSeed.text
      : null;

  const deselectIfActive = useCallback(
    (id: string) => {
      if (id === selectedId) {
        setSelectedIdState("");
        router.push(chatHref());
      }
    },
    [selectedId, router],
  );

  const sessionActions: SessionActions = useMemo(
    () => ({
      projects,
      onRename: async (id: string) => {
        const s = sessions.find((x) => x.id === id);
        const name = await prompt({
          title: "Rename conversation",
          placeholder: "Conversation name",
          defaultValue: s?.title ?? "",
          confirmText: "Rename",
        });
        if (name) await renameSession(id, name);
      },
      onMove: async (sid: string, projectId: string | null) => {
        await assignSessionToProject(sid, projectId);
      },
      onArchive: async (id: string) => {
        await archiveSession(id, true);
        deselectIfActive(id);
      },
      onDelete: async (id: string) => {
        const ok = await confirm({
          title: "Delete conversation",
          description:
            "This conversation and its messages will be permanently deleted.",
          confirmText: "Delete",
          destructive: true,
        });
        if (!ok) return;
        await deleteSession(id);
        deselectIfActive(id);
      },
      onPin: async (id: string) => {
        const s = sessions.find((x) => x.id === id);
        if (s) await pinSession(id, !s.pinned);
      },
    }),
    [
      projects,
      renameSession,
      archiveSession,
      deleteSession,
      pinSession,
      sessions,
      assignSessionToProject,
      confirm,
      prompt,
      deselectIfActive,
    ],
  );

  const makeProjectActions = useCallback(
    (_projectId: string): ProjectActions => ({
      onRename: async (_id: string) => {
        await prompt({
          title: "Rename project",
          placeholder: "Project name",
          confirmText: "Rename",
        });
      },
      onDelete: async (id: string) => {
        const ok = await confirm({
          title: "Delete project",
          description:
            "This project and all its conversations will be permanently deleted.",
          confirmText: "Delete",
          destructive: true,
        });
        if (!ok) return;
        await deleteProject(id);
        if (selectedProjectId === id) setSelectedProjectId(null);
      },
      onNewSubProject: async () => {
        const name = await prompt({
          title: "New sub-project",
          description:
            "Create a sub-project to further organize conversations.",
          placeholder: "Sub-project name",
          confirmText: "Create",
        });
        if (!name) return;
        const project = await createProject(name);
        const session = await createSession({ projectId: project.id });
        setSelectedProjectId(project.id);
        selectId(session.id);
      },
    }),
    [
      deleteProject,
      createProject,
      createSession,
      selectId,
      selectedProjectId,
      confirm,
      prompt,
      setSelectedProjectId,
    ],
  );

  // Flattened, in-display-order list of chat ids for keyboard navigation:
  // projects first, then each agent's chats (matching the sidebar order).
  const navOrder = useMemo(() => {
    const ids: string[] = [];
    for (const pw of filteredProjects) {
      for (const s of pw.sessions) ids.push(s.id);
    }
    for (const aw of filteredAgents) {
      for (const s of aw.sessions) ids.push(s.id);
    }
    return ids;
  }, [filteredProjects, filteredAgents]);

  // Chat-surface shortcuts, wired through the central dispatcher (which handles
  // the "don't fire while typing" rule for the non-modifier ones).
  const navigateBy = useCallback(
    (forward: boolean) => {
      if (navOrder.length === 0) return;
      const cur = navOrder.indexOf(selectedId);
      const idx =
        cur === -1
          ? forward
            ? 0
            : navOrder.length - 1
          : forward
            ? Math.min(cur + 1, navOrder.length - 1)
            : Math.max(cur - 1, 0);
      handleSelectSession(navOrder[idx]);
    },
    [navOrder, selectedId, handleSelectSession],
  );

  useShortcut("chat.new", () => void handleNewChat());
  useShortcut("chat.toggleList", () => setSidebarOpen((o) => !o));
  useShortcut("chat.next", () => navigateBy(true));
  useShortcut("chat.next.vim", () => navigateBy(true));
  useShortcut("chat.prev", () => navigateBy(false));
  useShortcut("chat.prev.vim", () => navigateBy(false));

  // "Recent" view: a flat, most-recent-first list of every non-archived
  // conversation, toggled by the bell in the sidebar header.
  const [recentView, setRecentViewState] = useState(() => recentViewStore);
  const toggleRecentView = useCallback(() => {
    recentViewStore = !recentViewStore;
    setRecentViewState(recentViewStore);
  }, []);
  const recentSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => !s.archived)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );
  const recentGroups = useMemo(
    () => groupSessionsByDay(recentSessions),
    [recentSessions],
  );
  // In the flat recent list a chat isn't under its owner, so label each with
  // its project (or the agent, when it's an agent chat).
  const recentContextFor = useCallback(
    (session: (typeof sessions)[number]) => {
      if (session.projectId) {
        const p = projects.find((x) => x.id === session.projectId);
        if (p) return { label: p.name, icon: FolderClosed };
      }
      if (session.agentId) {
        const a = agents.find((x) => x.id === session.agentId);
        if (a) return { label: a.name, icon: Bot };
      }
      return undefined;
    },
    [projects, agents],
  );

  const sidebarContentProps = {
    handleNewChat,
    handleNewProject,
    sessionsLoading,
    filteredProjects,
    filteredAgents,
    selectedId,
    handleSelectSession,
    selectedProjectId,
    handleSelectProject,
    handleNewChatInProject,
    handleNewChatWithAgent,
    sessionActions,
    makeProjectActions,
    recentView,
    onToggleRecentView: toggleRecentView,
    recentGroups,
    recentContextFor,
  };

  const showMobileList =
    isMobile && ((!selectedSession && !activeProject) || sidebarOpen);

  const dialogs = (
    <>
      {ConfirmDialog}
      {PromptDialog}
    </>
  );

  const startNewFromComposer = async (content: string) => {
    pendingMessageRef.current = content;
    // Land the new chat under the Personal Assistant folder so it stays visible
    // in the sidebar (there is no longer a catch-all "Chats" group).
    const session = await createSession({ agentId: "a0" });
    selectId(session.id);
  };

  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        {dialogs}
        {showMobileList ? (
          <div className="flex h-full flex-col bg-background">
            <SidebarContent {...sidebarContentProps} />
          </div>
        ) : selectedSession ? (
          <ChatView
            session={selectedSession}
            messages={displayedMessages}
            isStreaming={isStreaming}
            live={harnessLive}
            liveUsage={liveUsage}
            onSend={handleSend}
            botName={botName}
            sidebarOpen={false}
            onToggleSidebar={() => setSidebarOpen(true)}
            pendingApproval={pendingApproval}
            onRespondApproval={handleRespondApproval}
            pendingClarification={effectiveClarification}
            onRespondClarification={handleRespondClarification}
            onRename={() => sessionActions.onRename(selectedSession.id)}
            onDelete={() => sessionActions.onDelete(selectedSession.id)}
            onMove={(projectId) =>
              sessionActions.onMove(selectedSession.id, projectId)
            }
            projects={projects}
            initialDraft={draftForSelected}
          />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center gap-6 px-4">
            <div className="w-full max-w-xl space-y-4">
              <div className="space-y-1.5 text-center">
                <h1 className="text-2xl font-semibold">
                  What can {botName} help you with?
                </h1>
                <p className="text-sm text-muted-foreground">
                  Start a new conversation, or pick a starting point below.
                </p>
              </div>
              <div className="space-y-1.5">
                <ChatInput
                  rows={3}
                  onSend={startNewFromComposer}
                  initialText={emptySeed}
                  onInitialTextConsumed={clearEmptySeed}
                  placeholder="Start a new conversation..."
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEmptySeed(p)}
                    className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
              {chatError && (
                <p className="text-sm text-destructive px-1">{chatError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      {dialogs}
      {sidebarOpen &&
        (isCompact ? (
          <>
            {/* Backdrop closes the overlay sidebar on outside click */}
            <button
              type="button"
              aria-label="Close sidebar"
              className="absolute inset-0 z-30 bg-black/20"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="absolute inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-background shadow-lg"
              style={{ width: sidebarWidth }}
            >
              <ResizeHandle
                width={sidebarWidth}
                onWidthChange={setSidebarWidth}
              />
              <SidebarContent {...sidebarContentProps} />
            </div>
          </>
        ) : (
          <div
            className="relative flex shrink-0 flex-col border-r border-border bg-background"
            style={{ width: sidebarWidth }}
          >
            <ResizeHandle
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
            />
            <SidebarContent {...sidebarContentProps} />
          </div>
        ))}

      <div className="flex-1 overflow-hidden">
        {selectedSession ? (
          <ChatView
            session={selectedSession}
            messages={displayedMessages}
            isStreaming={isStreaming}
            live={harnessLive}
            liveUsage={liveUsage}
            onSend={handleSend}
            botName={botName}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            pendingApproval={pendingApproval}
            onRespondApproval={handleRespondApproval}
            pendingClarification={effectiveClarification}
            onRespondClarification={handleRespondClarification}
            onRename={() => sessionActions.onRename(selectedSession.id)}
            onDelete={() => sessionActions.onDelete(selectedSession.id)}
            onMove={(projectId) =>
              sessionActions.onMove(selectedSession.id, projectId)
            }
            projects={projects}
            onSidePanelOpenChange={handleSidePanelOpenChange}
            initialDraft={draftForSelected}
          />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground absolute top-3 left-3"
                onClick={() => setSidebarOpen(true)}
                aria-label="Show sidebar"
              >
                <PanelLeft className="size-4" />
              </Button>
            )}
            <div className="w-full max-w-xl space-y-4">
              <div className="space-y-1.5 text-center">
                <h1 className="text-2xl font-semibold">
                  What can {botName} help you with?
                </h1>
                <p className="text-sm text-muted-foreground">
                  Start a new conversation, or pick a starting point below.
                </p>
              </div>
              <div className="space-y-1.5">
                <ChatInput
                  rows={3}
                  onSend={startNewFromComposer}
                  initialText={emptySeed}
                  onInitialTextConsumed={clearEmptySeed}
                  placeholder="Start a new conversation..."
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEmptySeed(p)}
                    className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
              {chatError && (
                <p className="text-sm text-destructive px-1">{chatError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
