"use client";

import { Loader2, PanelLeft, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AgentSession,
  useAgentChat,
  useAgentSessions,
} from "@/features/agent";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsCompact, useIsMobile } from "@/hooks/use-mobile";
import { useNavReopenSidebar } from "@/hooks/use-nav-reopen-sidebar";
import { usePrompt } from "@/hooks/use-prompt";
import { useSidebarWidth } from "@/hooks/use-sidebar-width";
import { useAgentDisplayName } from "@/lib/profile-preferences";
import { useShortcut } from "@/lib/shortcuts/use-shortcuts";
import { ChatInput } from "../../_components/chat-input";
import { ResizeHandle } from "../../_components/resize-handle";
import { ChatView } from "./chat-view";
import {
  type SessionActions,
  SessionList,
  SidebarGroup,
} from "./session-sidebar";

/** Route for a chat, or the base (a new draft) when none is selected. */
const chatHref = (id?: string) =>
  id ? `/workspace/chat/${id}` : "/workspace/chat";

/** One-click prompts on the draft state, to seed the first message. */
const STARTER_PROMPTS = [
  "Summarise what changed in the repo this week",
  "Draft a plan for a new feature",
  "Review my open pull requests",
  "Find and explain a bug in the codebase",
] as const;

const DAY_MS = 86_400_000;

/**
 * Bucket recency-sorted sessions into Today / This week / Earlier for the
 * flat sidebar list. Empty buckets are dropped.
 */
function groupSessionsByRecency(
  sessions: AgentSession[],
): { label: string; sessions: AgentSession[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  const order = ["Today", "This week", "Earlier"] as const;
  const buckets: Record<(typeof order)[number], AgentSession[]> = {
    Today: [],
    "This week": [],
    Earlier: [],
  };
  for (const s of sessions) {
    const ts = s.updatedAt ?? 0;
    const label =
      ts >= t0 ? "Today" : ts >= t0 - 7 * DAY_MS ? "This week" : "Earlier";
    buckets[label].push(s);
  }
  return order
    .filter((l) => buckets[l].length > 0)
    .map((l) => ({ label: l, sessions: buckets[l] }));
}

function SidebarContent({
  onNewChat,
  isLoading,
  error,
  groups,
  selectedId,
  onSelect,
  actions,
}: {
  onNewChat: () => void;
  isLoading: boolean;
  error: string | null;
  groups: { label: string; sessions: AgentSession[] }[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions: SessionActions;
}) {
  return (
    <>
      <div className="flex h-[60px] lg:h-[65px] shrink-0 items-center gap-0.5 border-b border-border px-3 lg:px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Chats</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              onClick={onNewChat}
              aria-label="New chat"
            >
              <SquarePen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {error && (
          <p className="px-4 pb-2 text-xs text-destructive break-words">
            {error}
          </p>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <SidebarGroup key={group.label} label={group.label}>
                <SessionList
                  sessions={group.sessions}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  actions={actions}
                />
              </SidebarGroup>
            ))}
          </div>
        ) : (
          !error && (
            <p className="text-center text-sm text-muted-foreground/50 py-8">
              No chats yet
            </p>
          )
        )}
      </div>
    </>
  );
}

/** Centered composer for a draft chat (no daemon session yet). */
function DraftView({
  onSend,
  seed,
  onSeedConsumed,
  onPickSeed,
  error,
  showSidebarButton,
  onShowSidebar,
}: {
  onSend: (content: string) => void;
  seed: string | null;
  onSeedConsumed: () => void;
  onPickSeed: (text: string) => void;
  error: string | null;
  showSidebarButton: boolean;
  onShowSidebar: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-4 lg:px-8">
      {showSidebarButton && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground absolute top-3 left-3"
          onClick={onShowSidebar}
          aria-label="Show sidebar"
        >
          <PanelLeft className="size-4" />
        </Button>
      )}
      <div className="w-full max-w-xl space-y-4">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold">What can I help you with?</h1>
          <p className="text-sm text-muted-foreground">
            Start a new chat, or pick a starting point below.
          </p>
        </div>
        <div className="space-y-1.5">
          <ChatInput
            rows={3}
            onSend={onSend}
            initialText={seed}
            onInitialTextConsumed={onSeedConsumed}
            placeholder="Start a new chat..."
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPickSeed(p)}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
      </div>
    </div>
  );
}

/**
 * The chat workspace: one flat, daemon-backed session list plus the open
 * conversation. Selection is driven by the URL (`/workspace/chat/<sessionId>`),
 * so deep-links, back/forward, and hard reloads resolve to the same chat.
 * `/workspace/chat` with no id is a draft whose daemon session is minted on
 * the first send.
 */
export function ChatWorkspace({ sessionId }: { sessionId?: string }) {
  const {
    sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    deleteSession,
    renameSession,
    refreshSessions,
  } = useAgentSessions();
  const router = useRouter();
  const { name: agentName } = useAgentDisplayName();
  const isMobile = useIsMobile();
  const isCompact = useIsCompact();
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();

  // Selection is URL-driven; the state mirror keeps it in sync while also
  // allowing an optimistic update before the client navigation settles.
  const [selectedId, setSelectedIdState] = useState(sessionId ?? "");
  // The id minted for a draft on first send. While the URL settles on that id
  // the chat hook keeps its draft binding (it already owns the live stream);
  // re-keying it would wipe the in-flight messages with a transcript refetch.
  const draftMintedIdRef = useRef<string | null>(null);
  useEffect(() => {
    setSelectedIdState(sessionId ?? "");
    if (sessionId !== draftMintedIdRef.current) draftMintedIdRef.current = null;
  }, [sessionId]);

  /** Select a chat: optimistic state + a route push so the URL leads. */
  const selectId = useCallback(
    (id: string) => {
      setSelectedIdState(id);
      router.push(chatHref(id));
    },
    [router],
  );

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile && !isCompact);
  const wasCompactRef = useRef(isCompact);
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

  // Sync sidebar visibility with viewport transitions: entering compact
  // closes it; leaving compact reopens it.
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

  const handleSessionCreated = useCallback(
    (id: string) => {
      draftMintedIdRef.current = id;
      setSelectedIdState(id);
      router.replace(chatHref(id));
      void refreshSessions();
    },
    [router, refreshSessions],
  );

  // The draft keeps a null hook id even after its session is minted and the
  // URL updates — the hook already streams against the minted id internally.
  const hookSessionId =
    selectedId && selectedId !== draftMintedIdRef.current ? selectedId : null;

  const {
    messages,
    isStreaming,
    status,
    error: chatError,
    harnessLive,
    sendMessage,
    retryLast,
    pendingApproval,
    respondToApproval,
    pendingClarification,
    respondToClarification,
    usage,
  } = useAgentChat(hookSessionId, { onSessionCreated: handleSessionCreated });

  useNavReopenSidebar(setSidebarOpen);

  // Seed for the draft composer, set when a starter prompt is picked.
  const [draftSeed, setDraftSeed] = useState<string | null>(null);
  const clearDraftSeed = useCallback(() => setDraftSeed(null), []);

  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );
  const groups = useMemo(
    () => groupSessionsByRecency(orderedSessions),
    [orderedSessions],
  );

  const selectedSession = useMemo<AgentSession | undefined>(() => {
    if (!selectedId) return undefined;
    const found = sessions.find((s) => s.id === selectedId);
    if (found) return found;
    // A just-minted draft's row may not have landed in the polled list yet;
    // a stand-in keeps the conversation rendered until the walk catches up.
    return {
      id: selectedId,
      title: "Untitled chat",
      projectId: null,
      model: "",
      createdAt: 0,
      updatedAt: 0,
      pinned: false,
      archived: false,
      messageCount: 0,
      isStreaming: false,
      inputTokens: 0,
      outputTokens: 0,
      unread: false,
      estimatedCost: null,
      contextLength: null,
      lastPromptTokens: null,
      thresholdTokens: null,
    };
  }, [selectedId, sessions]);

  const handleSelectSession = useCallback(
    (id: string) => {
      selectId(id);
      if (isMobile || isCompact) setSidebarOpen(false);
    },
    [selectId, isMobile, isCompact],
  );

  /** "New chat" opens the draft route; the daemon session is minted on send. */
  const handleNewChat = useCallback(() => {
    setSelectedIdState("");
    router.push(chatHref());
    if (isMobile || isCompact) setSidebarOpen(false);
  }, [router, isMobile, isCompact]);

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
      onRename: async (id: string) => {
        const s = sessions.find((x) => x.id === id);
        const name = await prompt({
          title: "Rename chat",
          placeholder: "Chat name",
          defaultValue: s?.title ?? "",
          confirmText: "Rename",
        });
        if (name) await renameSession(id, name);
      },
      onDelete: async (id: string) => {
        const ok = await confirm({
          title: "Delete chat",
          description:
            "This chat and its messages will be permanently deleted.",
          confirmText: "Delete",
          destructive: true,
        });
        if (!ok) return;
        await deleteSession(id);
        deselectIfActive(id);
      },
    }),
    [sessions, prompt, renameSession, confirm, deleteSession, deselectIfActive],
  );

  // Flattened, in-display-order chat ids for keyboard navigation.
  const navOrder = useMemo(
    () => groups.flatMap((g) => g.sessions.map((s) => s.id)),
    [groups],
  );

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

  useShortcut("chat.new", handleNewChat);
  useShortcut("chat.toggleList", () => setSidebarOpen((o) => !o));
  useShortcut("chat.next", () => navigateBy(true));
  useShortcut("chat.next.vim", () => navigateBy(true));
  useShortcut("chat.prev", () => navigateBy(false));
  useShortcut("chat.prev.vim", () => navigateBy(false));

  const sidebarContentProps = {
    onNewChat: handleNewChat,
    isLoading: sessionsLoading,
    error: sessionsError,
    groups,
    selectedId,
    onSelect: handleSelectSession,
    actions: sessionActions,
  };

  const dialogs = (
    <>
      {ConfirmDialog}
      {PromptDialog}
    </>
  );

  const turnError =
    status === "error" ? (chatError ?? "The last turn failed.") : null;

  const chatView = (open: boolean, onToggle: () => void) =>
    selectedSession ? (
      <ChatView
        session={selectedSession}
        messages={messages}
        isStreaming={isStreaming}
        live={harnessLive}
        usage={usage}
        error={turnError}
        onRetry={retryLast}
        onSend={sendMessage}
        botName={agentName}
        sidebarOpen={open}
        onToggleSidebar={onToggle}
        pendingApproval={pendingApproval}
        onRespondApproval={respondToApproval}
        pendingClarification={pendingClarification}
        onRespondClarification={respondToClarification}
        onRename={
          selectedSession.canRename === true
            ? () => sessionActions.onRename(selectedSession.id)
            : undefined
        }
        onDelete={
          selectedSession.canDelete === true
            ? () => sessionActions.onDelete(selectedSession.id)
            : undefined
        }
        onSidePanelOpenChange={isMobile ? undefined : handleSidePanelOpenChange}
      />
    ) : null;

  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        {dialogs}
        {sidebarOpen ? (
          <div className="flex h-full flex-col bg-background">
            <SidebarContent {...sidebarContentProps} />
          </div>
        ) : selectedSession ? (
          chatView(false, () => setSidebarOpen(true))
        ) : (
          <DraftView
            onSend={sendMessage}
            seed={draftSeed}
            onSeedConsumed={clearDraftSeed}
            onPickSeed={setDraftSeed}
            error={turnError}
            showSidebarButton
            onShowSidebar={() => setSidebarOpen(true)}
          />
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
          chatView(sidebarOpen, () => setSidebarOpen((o) => !o))
        ) : (
          <DraftView
            onSend={sendMessage}
            seed={draftSeed}
            onSeedConsumed={clearDraftSeed}
            onPickSeed={setDraftSeed}
            error={turnError}
            showSidebarButton={!sidebarOpen}
            onShowSidebar={() => setSidebarOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
