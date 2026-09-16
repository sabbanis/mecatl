"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  CirclePlus,
  Ellipsis,
  FileText,
  FoldVertical,
  Loader2,
  MessageCircle,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AgentMessage,
  type AgentSession,
  type ApprovalChoice,
  type ApprovalRequest,
  type Artifact,
  type Attachment,
  type AuthorizationRequest,
  type ClarificationRequest,
  type ToolCallInfo,
  useAgentChat,
} from "@/features/agent";
import type { StudioBuiltinCommand } from "@/features/agent/composer-capabilities";
import {
  mergeQueued,
  type PendingSteer,
  type QueuedMessage,
  type QueuePause,
} from "@/features/agent/hooks/use-agent-chat";
import { isMockTourSession } from "@/features/agent/mock-tour";
import { cacheHitRate, formatPercent } from "@/features/agent/turn-stats";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTokens } from "@/lib/formatters";
import {
  createThreadHarnessSession,
  ThreadSourceBusyError,
} from "@/lib/harness/client";
import {
  type SessionListSide,
  useEnterSendBehavior,
  useShowToolCalls,
} from "@/lib/profile-preferences";
import type { SessionPermissionMode } from "@/lib/protocol";
import { useShortcut } from "@/lib/shortcuts/use-shortcuts";
import {
  composeThreadPrompt,
  getThreadSession,
  registerThreadSession,
  sliceThreadReplies,
  stripRootQuote,
  syncThreadActivity,
  threadKeyForMessage,
  threadTitleFromRoot,
  unregisterThreadSession,
  useThreadMap,
} from "@/lib/thread-map";
import { cn } from "@/lib/utils";
import {
  ChatInput,
  type ComposerModelOption,
} from "../../_components/chat-input";
import { ApprovalPanel } from "./approval-panel";
import { AuthorizationPanel } from "./authorization-panel";
import { ClarificationPanel } from "./clarification-panel";
import { ContextMeter } from "./context-meter";
import { FilePreview } from "./file-preview";
import { HelpMenuItem, HelpSheetItem } from "./help-menu-item";
import { MarkdownCanvasPanel } from "./markdown-canvas-panel";
import { MessageBubble } from "./message-bubble";
import { MockProviderNotice } from "./mock-provider-notice";
import { QueuedMessageStrip } from "./queued-message-strip";
import { SidePanel } from "./side-panel";
import { ToolCallPanel } from "./tool-call-panel";

/** The authorization card's fallback when a caller wires no handler. */
const noAuthorizationAction = async () => {};

/** The single right-hand panel: exactly one kind is open at a time, or none. */
type ActivePanel =
  | { kind: "artifact"; artifact: Artifact }
  | { kind: "attachment"; attachment: Attachment }
  | { kind: "thread"; message: AgentMessage }
  | { kind: "toolcall"; call: ToolCallInfo };

/**
 * Bottom-of-transcript activity line while a turn is running: three
 * staggered pulsing dots, a phase label derived from the streaming
 * assistant message (thinking / running tools / writing), and elapsed time.
 */
function StreamingIndicator({ message }: { message?: AgentMessage }) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = message?.timestamp;
  useEffect(() => {
    if (!startedAt) return;
    const tick = () =>
      setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const runningTool = message?.toolCalls?.some(
    (call) => call.status === "running",
  );
  const phase = runningTool
    ? "Running tools"
    : message?.content
      ? "Writing"
      : "Thinking";
  const time =
    elapsed >= 60
      ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
      : `${elapsed}s`;

  return (
    // Mirrors the message-row geometry (avatar column + gap) so the label
    // lines up with message text; the dots sit centered in the avatar slot.
    <div className="flex items-center gap-2 py-2 lg:gap-3">
      <span
        className="flex w-7 shrink-0 items-center justify-center gap-0.5 lg:w-9"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 animate-[thinking-bounce_0.9s_infinite] rounded-full bg-brand"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-sm text-muted-foreground lg:text-[15px]">
        {phase}
        <span className="mx-1.5 text-muted-foreground/50">·</span>
        <span className="tabular-nums text-muted-foreground/70">{time}</span>
      </span>
    </div>
  );
}

/** The session's token figures the menus and the context strip render. */
type UsageFigures = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

/**
 * Token counts as a read-only info row inside the chat context menus: every
 * non-zero facet (input, output, cache read, cache write, reasoning) plus
 * the cache-hit rate once anything was read from cache.
 */
function UsageMenuRow({ usage }: { usage?: UsageFigures | null }) {
  if (!usage || usage.inputTokens + usage.outputTokens <= 0) return null;
  const facets: [string, number][] = [
    ["input", usage.inputTokens],
    ["output", usage.outputTokens],
    ["cache read", usage.cacheReadTokens ?? 0],
    ["cache write", usage.cacheWriteTokens ?? 0],
    ["reasoning", usage.reasoningTokens ?? 0],
  ];
  const hitRate = cacheHitRate(usage);
  return (
    <div className="mb-1 border-b border-border/60 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">Token usage</p>
      <div className="mt-1">
        {facets
          .filter(([, count]) => count > 0)
          .map(([label, count]) => (
            <p key={label} className="text-sm tabular-nums">
              {formatTokens(count)} {label}
            </p>
          ))}
        {hitRate > 0 && (
          <p className="text-sm tabular-nums">
            {formatPercent(hitRate)} cache hit rate
          </p>
        )}
      </div>
    </div>
  );
}

/** A composer re-seed: text plus the staged files that travel with it. */
type ComposerSeed = { text: string; files?: File[] };

function MobileChatMenu({
  showActivity,
  onToggleActivity,
  onRename,
  onDelete,
  onCompact,
  compactDisabled,
  usage,
}: {
  showActivity: boolean;
  onToggleActivity: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  /** Manual compaction (B1.2): present only when the daemon supports it. */
  onCompact?: () => void;
  /** True while a run streams — the daemon 412s a mid-run compact. */
  compactDisabled?: boolean;
  usage?: UsageFigures | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Ellipsis className="size-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="p-0">
          <SheetTitle className="sr-only">Chat options</SheetTitle>
          <div className="py-2">
            <UsageMenuRow usage={usage} />
            <button
              type="button"
              onClick={() => {
                onToggleActivity();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <Wrench className="size-4 text-muted-foreground" />
              {showActivity ? "Hide Tools" : "Show Tools"}
            </button>
            {onCompact && (
              <button
                type="button"
                disabled={compactDisabled}
                onClick={() => {
                  onCompact();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <FoldVertical className="size-4 text-muted-foreground" />
                Compact conversation
              </button>
            )}
            <HelpSheetItem onSelect={() => setOpen(false)} />
            {onRename && (
              <button
                type="button"
                onClick={() => {
                  onRename();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <Pencil className="size-4 text-muted-foreground" />
                Rename
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AttachmentPanel({
  attachment,
  onClose,
  maximized,
  onToggleMaximize,
  windowControls,
}: {
  attachment: Attachment;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  windowControls?: boolean;
}) {
  return (
    <SidePanel
      icon={FileText}
      title={attachment.name}
      closeLabel="Close file"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      windowControls={windowControls}
    >
      <div className="flex-1 overflow-auto">
        <FilePreview
          name={attachment.name}
          content={attachment.content}
          url={attachment.url}
        />
      </div>
    </SidePanel>
  );
}

/**
 * A side-panel thread branched off a single message, backed by a REAL daemon
 * session seeded with the parent conversation (source_session_id carryover).
 * The root message is shown read-only at the top; replies genuinely converse
 * with the agent, streaming through the same chat hook as the main view. The
 * thread session is minted lazily on the first send, renamed "Thread: …",
 * and remembered in the browser-local thread map so reopening the thread
 * rehydrates its transcript. It also shows up in the sidebar under that
 * name, which is the escape hatch for anything the panel keeps minimal.
 */
function ThreadPanel({
  parentSessionId,
  rootMessage,
  botName,
  onClose,
  onConvertToChat,
  maximized,
  onToggleMaximize,
  windowControls,
}: {
  parentSessionId: string;
  rootMessage: AgentMessage;
  botName: string;
  onClose: () => void;
  /** Detach the thread and open its session as an ordinary chat. */
  onConvertToChat?: (threadSessionId: string) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  windowControls?: boolean;
}) {
  // The global Show Tools preference — shared with the chat's ··· menu.
  const { showToolCalls: showTools, setShowToolCalls } = useShowToolCalls();
  const rootKey = threadKeyForMessage(rootMessage);
  // The persisted thread session, when this root message already has one —
  // the hook rehydrates its transcript. A session minted DURING this panel's
  // lifetime deliberately does NOT re-key the hook: it is adopted via
  // adoptSession instead (the draft-minting pattern), because re-keying
  // would refetch the transcript mid-stream and wipe the optimistic messages.
  const [initialThreadId] = useState<string | null>(() =>
    getThreadSession(parentSessionId, rootKey),
  );
  const threadIdRef = useRef<string | null>(initialThreadId);
  // The parent was mid-run (daemon 412): the seeded fork has to wait.
  const [sourceBusy, setSourceBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Re-seeds the composer after a refused first send (keep the text) or a
  // queued-message edit (text AND its staged files come back).
  const [seedText, setSeedText] = useState<string | null>(null);
  const [seedFiles, setSeedFiles] = useState<File[] | undefined>(undefined);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    status,
    error,
    sendMessage,
    adoptSession,
    queuedMessages,
    queueMessage,
    deleteQueued,
    takeQueued,
    steerQueued,
    pendingApproval,
    respondToApproval,
    pendingAuthorization,
    openAuthorization,
    copyAuthorizationLink,
    recheckAuthorization,
    cancelAuthorization,
  } = useAgentChat(initialThreadId);

  // The thread session's history starts with the seeded parent conversation;
  // only the thread's own exchange (from the quoted first message) renders.
  const replies = useMemo(
    () =>
      stripRootQuote(
        sliceThreadReplies(messages, rootMessage.content),
        rootMessage.content,
      ),
    [messages, rootMessage.content],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: the scroll follows every new reply by design
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  // Mirror the thread's activity into the persisted map so the parent
  // transcript's reply indicator stays live (count + last-reply time).
  useEffect(() => {
    if (!threadIdRef.current || replies.length === 0) return;
    const countable = replies.filter(
      (reply) =>
        reply.role === "user" ||
        Boolean(reply.content.trim()) ||
        Boolean(reply.failed),
    );
    if (countable.length === 0) return;
    let lastAt = 0;
    for (const reply of countable) {
      if (reply.timestamp > lastAt) lastAt = reply.timestamp;
    }
    syncThreadActivity(parentSessionId, rootKey, countable.length, lastAt);
  }, [replies, parentSessionId, rootKey]);

  const handleSend = useCallback(
    async (content: string, files?: File[]) => {
      // Defense in depth: a mock session id must never mint a daemon thread
      // session (the panel router already sends mock threads elsewhere).
      if (isMockTourSession(parentSessionId)) return;
      setSourceBusy(false);
      setCreateError(null);
      if (threadIdRef.current) {
        void sendMessage(content, files);
        return;
      }
      // First send: mint the seeded thread session up front — the hook's own
      // lazy mint would create an UNSEEDED session with no parent context.
      try {
        const threadId = await createThreadHarnessSession(
          parentSessionId,
          threadTitleFromRoot(rootMessage.content),
        );
        threadIdRef.current = threadId;
        adoptSession(threadId);
        registerThreadSession(parentSessionId, rootKey, threadId);
      } catch (caught) {
        // A refused first send keeps the text: re-seed the composer with it.
        setSeedText(content);
        if (caught instanceof ThreadSourceBusyError) {
          setSourceBusy(true);
        } else {
          setCreateError(
            caught instanceof Error ? caught.message : String(caught),
          );
        }
        return;
      }
      void sendMessage(
        composeThreadPrompt(rootMessage.content, content),
        files,
      );
    },
    [parentSessionId, rootKey, rootMessage.content, sendMessage, adoptSession],
  );

  // Editing a queued reply pulls it out of the queue into the composer,
  // attachments included.
  const handleEditQueued = (id: string) => {
    const hit = takeQueued(id);
    if (!hit) return;
    setSeedText(hit.text || null);
    setSeedFiles(hit.files);
  };

  return (
    <SidePanel
      icon={MessageSquareText}
      title="Thread"
      closeLabel="Close thread"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      minWidth={340}
      windowControls={windowControls}
      headerExtra={
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label="Thread options"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowToolCalls(!showTools)}>
              {showTools ? "Hide Tools" : "Show Tools"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onConvertToChat}
              onClick={() => {
                const threadId = threadIdRef.current;
                if (!threadId || !onConvertToChat) return;
                unregisterThreadSession(parentSessionId, threadId);
                onConvertToChat(threadId);
              }}
            >
              Open as full chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Body: root message, live replies, composer */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={threadScrollRef}
          className="h-full overflow-y-auto px-3 pt-3 pb-40 max-[499px]:pb-24 lg:px-4"
        >
          <div className="rounded-lg border border-dashed border-border/70 px-1 py-1">
            <MessageBubble message={rootMessage} botName={botName} />
          </div>
          {replies.length > 0 && (
            <div className="my-2 flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              <span className="h-px flex-1 bg-border" />
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          {replies.map((reply) => (
            <MessageBubble
              key={reply.id}
              message={reply}
              botName={botName}
              showActivity={showTools}
            />
          ))}
          {pendingApproval && (
            <ApprovalPanel
              approval={pendingApproval}
              onRespond={respondToApproval}
            />
          )}
          {pendingAuthorization && (
            <AuthorizationPanel
              authorization={pendingAuthorization}
              onOpen={openAuthorization}
              onCopyLink={copyAuthorizationLink}
              onRecheck={recheckAuthorization}
              onCancel={cancelAuthorization}
            />
          )}
          {isStreaming && !pendingAuthorization && (
            <StreamingIndicator
              message={
                replies[replies.length - 1]?.role === "assistant"
                  ? replies[replies.length - 1]
                  : undefined
              }
            />
          )}
          <div ref={endRef} />
        </div>
        <TextSelectionToolbar
          containerRef={threadScrollRef}
          onAddToChat={(text) =>
            setSeedText((prev) => {
              const quoted = `${text
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n")}\n\n`;
              return prev ? prev + quoted : quoted;
            })
          }
          addLabel="Add to thread"
        />
        <div className="absolute bottom-0 left-0 right-0 px-3 lg:px-4 pb-4 max-[499px]:px-0 max-[499px]:pb-0">
          <div className="space-y-1.5">
            <QueuedMessageStrip
              queued={queuedMessages}
              isStreaming={isStreaming}
              onSteer={steerQueued}
              onEdit={handleEditQueued}
              onDelete={deleteQueued}
            />
            {sourceBusy && (
              <p className="px-2 text-xs text-muted-foreground">
                Wait for the current response to finish before starting a
                thread.
              </p>
            )}
            {createError && (
              <p className="px-2 text-xs text-destructive break-words">
                {createError}
              </p>
            )}
            {status === "error" && error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-background bg-gradient-to-b from-destructive/5 to-destructive/5 px-3 py-2">
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <p className="min-w-0 flex-1 text-sm text-destructive break-words">
                  {error}
                </p>
              </div>
            )}
            <MockProviderNotice />
            <ChatInput
              rows={1}
              onSend={handleSend}
              onQueue={queueMessage}
              isStreaming={isStreaming}
              disabled={!!pendingApproval}
              initialText={seedText}
              initialFiles={seedFiles}
              onInitialTextConsumed={() => {
                setSeedText(null);
                setSeedFiles(undefined);
              }}
              onModelChange={() => {}}
              placeholder={isStreaming ? "Queue a reply…" : "Reply in thread…"}
              mobileDocked
            />
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

/**
 * The thread panel for the Labs mock chat: a read-only view of the root
 * message's canned replies. Entirely local — a mock session id must never
 * mint a daemon thread session, so this replaces ThreadPanel outright.
 */
function MockThreadPanel({
  rootMessage,
  botName,
  onClose,
  maximized,
  onToggleMaximize,
  windowControls,
}: {
  rootMessage: AgentMessage;
  botName: string;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  windowControls?: boolean;
}) {
  const replies = rootMessage.replies ?? [];
  return (
    <SidePanel
      icon={MessageSquareText}
      title="Thread"
      closeLabel="Close thread"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      minWidth={340}
      windowControls={windowControls}
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4 lg:px-4">
        <div className="rounded-lg border border-dashed border-border/70 px-1 py-1">
          <MessageBubble message={rootMessage} botName={botName} />
        </div>
        {replies.length > 0 && (
          <div className="my-2 flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            <span className="h-px flex-1 bg-border" />
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        {replies.map((reply) => (
          <MessageBubble key={reply.id} message={reply} botName={botName} />
        ))}
        <p className="px-2 pt-2 text-xs text-muted-foreground">
          Mock thread &mdash; read-only demo content.
        </p>
      </div>
    </SidePanel>
  );
}

function TextSelectionToolbar({
  containerRef,
  onAddToChat,
  onAskInSideChat,
  addLabel = "Add to chat",
  askLabel = "Ask in a chat thread",
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onAddToChat: (text: string) => void;
  /** Omitted = the toolbar offers only the add action (the thread panel). */
  onAskInSideChat?: (text: string) => void;
  addLabel?: string;
  askLabel?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 3) {
          setPos(null);
          return;
        }

        const range = selection?.getRangeAt(0);
        if (!range) return;

        if (!container.contains(range.commonAncestorContainer)) {
          setPos(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setSelectedText(text);
        setPos({
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top - containerRect.top - 8,
        });
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setPos(null);
    };

    container.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef]);

  if (!pos) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-0.5 shadow-lg"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        type="button"
        onClick={() => {
          onAddToChat(selectedText);
          setPos(null);
          window.getSelection()?.removeAllRanges();
        }}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap"
      >
        <MessageCircle className="size-3.5" />
        {addLabel}
      </button>
      {onAskInSideChat && (
        <>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={() => {
              onAskInSideChat(selectedText);
              setPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap"
          >
            <CirclePlus className="size-3.5" />
            {askLabel}
          </button>
        </>
      )}
    </div>
  );
}

export function ChatView({
  session,
  messages,
  isStreaming,
  onSend,
  botName,
  live = false,
  usage,
  contextOccupancy = 0,
  error,
  onRetry,
  sidebarOpen,
  sidebarSide,
  onToggleSidebar,
  pendingApproval,
  onRespondApproval,
  pendingClarification,
  onRespondClarification,
  pendingAuthorization = null,
  onOpenAuthorization,
  onCopyAuthorizationLink,
  onRecheckAuthorization,
  onCancelAuthorization,
  onRename,
  onDelete,
  onSidePanelOpenChange,
  initialDraft,
  onInitialDraftConsumed,
  queuedMessages = [],
  onQueueMessage,
  onOpenSession,
  onSteerQueued,
  onDeleteQueued,
  onTakeQueued,
  onTakeAllQueued,
  onClearQueue,
  queuePaused,
  onResumeQueue,
  pendingSteers,
  onSteerMessage,
  onRetractSteers,
  onCancelRun,
  onCompact,
  contextInfo,
  readOnlyPlaceholder,
  mode,
  onModeChange,
  models,
  autoModelLabel,
  onSwitchModel,
  onLocalCommand,
}: {
  session: AgentSession;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (content: string, files?: File[]) => void;
  botName: string;
  /** True while the daemon connection is up. */
  live?: boolean;
  usage?: UsageFigures;
  /** The last turn failed with this text; rendered as an inline strip. */
  error?: string | null;
  onRetry?: () => void;
  sidebarOpen: boolean;
  sidebarSide: SessionListSide;
  onToggleSidebar: () => void;
  pendingApproval: ApprovalRequest | null;
  onRespondApproval: (choice: ApprovalChoice) => void;
  pendingClarification: ClarificationRequest | null;
  onRespondClarification: (response: string) => void;
  /** The MCP browser authorization the run is parked on: the takeover card
      replaces the composer until the sign-in is confirmed or cancelled. */
  pendingAuthorization?: AuthorizationRequest | null;
  onOpenAuthorization?: () => Promise<unknown>;
  onCopyAuthorizationLink?: () => Promise<unknown>;
  onRecheckAuthorization?: () => Promise<unknown>;
  onCancelAuthorization?: () => Promise<unknown>;
  onRename?: () => void;
  onDelete?: () => void;
  /** Fires when the right-hand side panel (artifact/attachment) opens or
      closes, so the parent can collapse the chat list while it's open. */
  onSidePanelOpenChange?: (open: boolean) => void;
  /** Plain-text prompt to pre-fill the composer with on mount (a "next step"
      chip that seeds the message without sending it). */
  initialDraft?: string | null;
  onInitialDraftConsumed?: () => void;
  /** Messages held while a run is active (see QueuedMessageStrip). */
  queuedMessages?: QueuedMessage[];
  /** Holds a message (text plus its staged files) for the next run. */
  onQueueMessage?: (text: string, files?: File[]) => void;
  /** Open a session as the main chat (thread → full chat conversion). */
  onOpenSession?: (sessionId: string) => void;
  onSteerQueued?: (id: string) => void;
  onDeleteQueued?: (id: string) => void;
  /** Removes a queued message and returns its text and files (the Edit
      action re-seeds both into the composer). */
  onTakeQueued?: (id: string) => ComposerSeed | null;
  /** Pulls the WHOLE queue back as one merged draft (Edit all / ↑ on an
      empty composer); the queue empties. */
  onTakeAllQueued?: () => ComposerSeed | null;
  /** Drops every held message (Clear all / Esc on an empty idle composer). */
  onClearQueue?: () => void;
  /** Non-null while the queue is held after a non-clean stop (cancel, a
      failed turn, a lost connection); the strip shows the reason. */
  queuePaused?: QueuePause | null;
  /** Sends the held queue as one prompt and lifts the pause (Send now /
      Enter on an empty idle composer). */
  onResumeQueue?: () => void;
  /** Steers the daemon accepted but has not yet applied to the run. */
  pendingSteers?: PendingSteer[];
  /** Injects composer text (plus staged image attachments, ADR 0251) into
      the in-flight run at the next step. Absent when the daemon lacks the
      steer capability — mid-run sends then queue. */
  onSteerMessage?: (text: string, files?: File[]) => void;
  /** Retracts the whole pending steer bundle; resolves to the steers that
      never reached the run, so their text can be recomposed. */
  onRetractSteers?: () => Promise<PendingSteer[]>;
  /** Cancels the in-flight run (Esc with no panel open). */
  onCancelRun?: () => void;
  /** Manually compacts the conversation (B1.2); present only when the
      daemon's manual_compaction capability is on. Disabled while streaming. */
  onCompact?: () => void;
  /** The session's effective model + context window (B1.1): feeds the slim
      approximate context meter near the composer. */
  contextInfo?: { modelLabel: string; contextWindow: number } | null;
  /** The latest turn's input tokens (turn.end): the meter's occupancy. */
  contextOccupancy?: number;
  /** Disables the composer and shows this placeholder instead (the Labs
      mock chat is read-only demo content). */
  readOnlyPlaceholder?: string;
  /** The session's current permission mode, for the composer's Mode selector. */
  mode?: SessionPermissionMode;
  /** Renders the composer's Mode selector when provided (the mock tour chat
      omits it — a read-only demo has no permission posture to set). */
  onModeChange?: (mode: SessionPermissionMode) => void;
  /** Live daemon models for the mid-chat switch picker. */
  models?: ComposerModelOption[];
  autoModelLabel?: string;
  /** Picking a model forks this chat onto it (daemon fixes model at create). */
  onSwitchModel?: (option: ComposerModelOption | null) => void;
  /** Answers a Studio-local slash command typed in the composer (`/help`
      opens the shortcuts & features reference) instead of sending it. */
  onLocalCommand?: (command: StudioBuiltinCommand) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Whether the transcript is scrolled to (near) the bottom; when it isn't,
  // a floating control above the composer jumps back down. The ref mirror is
  // what the follow effect reads — it must see the value as of the latest
  // scroll, not the latest render.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // The global Show Tools preference (persisted; shared with thread panels).
  const { showToolCalls: showActivity, setShowToolCalls } = useShowToolCalls();
  // The single right-hand panel — a discriminated union makes "one panel at a
  // time" structural rather than something to coordinate by hand.
  const [panel, setPanel] = useState<ActivePanel | null>(null);
  const [appendText, setAppendText] = useState<string | null>(null);
  // The Enter preference (Settings → Chat) decides the streaming placeholder.
  const { behavior: enterBehavior } = useEnterSendBehavior();
  // Editing a queued message pulls it out of the queue into the composer —
  // text and staged files alike. Edit all merges the whole queue; Retract
  // pulls the never-applied steer bundle back the same way.
  const [editSeed, setEditSeed] = useState<ComposerSeed | null>(null);
  const handleEditQueued = (id: string) => {
    const hit = onTakeQueued?.(id);
    if (hit) setEditSeed(hit);
  };
  const handleEditAllQueued = () => {
    const hit = onTakeAllQueued?.();
    if (hit) setEditSeed(hit);
  };
  const handleRetractSteers = async () => {
    const retracted = await onRetractSteers?.();
    const merged = mergeQueued(retracted ?? []);
    if (merged) setEditSeed(merged);
  };
  // When maximized, the panel fills the pane and the conversation column is
  // hidden. Always reset when the panel is closed.
  const [panelMaximized, setPanelMaximized] = useState(false);
  const isMobile = useIsMobile();
  const handleAppendConsumed = useCallback(() => setAppendText(null), []);
  // Threads branched off this chat's messages (browser-local), for the
  // Slack-style reply indicators under their root messages.
  const threadMap = useThreadMap(session.id);

  const closeSidePanel = useCallback(() => {
    setPanel(null);
    setPanelMaximized(false);
  }, []);
  const toggleMaximize = useCallback(() => setPanelMaximized((v) => !v), []);
  // Previewing a composer attachment opens the canvas on an object URL; the
  // previous URL is revoked when replaced or on unmount so attach/preview
  // cycles never leak blobs.
  const previewUrlRef = useRef<string | null>(null);
  const releasePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);
  useEffect(() => releasePreviewUrl, [releasePreviewUrl]);
  const handlePreviewFile = useCallback(
    (file: File) => {
      releasePreviewUrl();
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPanel({
        kind: "attachment",
        attachment: { name: file.name, type: file.type, url },
      });
    },
    [releasePreviewUrl],
  );

  const handleConvertThread = useCallback(
    (threadSessionId: string) => {
      setPanel(null);
      onOpenSession?.(threadSessionId);
    },
    [onOpenSession],
  );

  const handleStartThread = useCallback(
    (message: AgentMessage) => setPanel({ kind: "thread", message }),
    [],
  );

  // Drill-down from a row in the inline activity list to the call's full
  // untruncated input/output in the side panel.
  const handleOpenToolCall = useCallback(
    (call: ToolCallInfo) => setPanel({ kind: "toolcall", call }),
    [],
  );

  // The tool-call panel tracks the LIVE call: the stream replaces call
  // objects as results land, so re-resolve by callId each render — the
  // clicked snapshot would otherwise read "running" forever.
  const activePanel = useMemo<ActivePanel | null>(() => {
    if (panel?.kind !== "toolcall") return panel;
    for (const msg of messages) {
      const live = msg.toolCalls?.find((c) => c.callId === panel.call.callId);
      if (live) return { kind: "toolcall", call: live };
    }
    return panel;
  }, [panel, messages]);

  // Jump to the latest message whenever the active chat changes so users
  // always land at the bottom (most-recent) of the conversation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolling is intentionally driven by session.id changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    atBottomRef.current = true;
    setAtBottom(true);
  }, [session.id]);

  // Pinned-follow: while the user sits at the bottom, a sent message and the
  // streaming response keep the view pinned there; once they scroll up, their
  // position holds (the floating arrow offers the way back down).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on every transcript update by design
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Esc, layered (close.esc): an open Radix dialog/menu — and the composer's
  // autocomplete — consume their own Escape before the dispatcher sees it
  // (`defaultPrevented`), so by the time this fires nothing transient is
  // open. Close the side panel if one is up; otherwise interrupt a streaming
  // run (the Claude Code convention: Esc cancels). On mobile the panel lives
  // in a Radix Sheet that owns its own Escape, so only the cancel arm fires
  // there.
  useShortcut("close.esc", () => {
    if (panel !== null) {
      closeSidePanel();
      return;
    }
    if (isStreaming) onCancelRun?.();
  });

  // The right-hand panel only renders on non-mobile layouts; let the parent
  // collapse the chat list while it's open so both panels fit side by side.
  const sidePanelOpen = !isMobile && panel !== null;
  useEffect(() => {
    onSidePanelOpenChange?.(sidePanelOpen);
  }, [sidePanelOpen, onSidePanelOpenChange]);

  // The sidebar toggle renders on the header edge nearest the panel it
  // controls: leading when the session list docks left, trailing when right.
  // With the list docked right, an open side panel occupies its slot — the
  // toggle then means "give me the list back": close the panel, and the
  // workspace restores the sidebar to its pre-panel state.
  const panelHoldsSidebarSlot =
    sidebarSide === "right" && activePanel !== null && !isMobile;
  const sidebarToggle = !isMobile && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => {
            if (panelHoldsSidebarSlot) {
              closeSidePanel();
              return;
            }
            onToggleSidebar();
          }}
          aria-label={
            panelHoldsSidebarSlot
              ? "Close preview"
              : sidebarOpen
                ? "Hide sidebar"
                : "Show sidebar"
          }
        >
          {sidebarOpen ? (
            sidebarSide === "left" ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )
          ) : sidebarSide === "left" ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {panelHoldsSidebarSlot
          ? "Close preview"
          : sidebarOpen
            ? "Hide sidebar"
            : "Show sidebar"}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-background",
          panelMaximized && "hidden",
        )}
      >
        <div className="flex h-[60px] items-center gap-2 border-b border-border px-3 max-[499px]:h-14 lg:gap-3 lg:px-6">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={onToggleSidebar}
              aria-label="Back to chats"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          {sidebarSide === "left" && sidebarToggle}
          {isStreaming && (
            <Loader2
              aria-label="Generating a response"
              className="size-4 shrink-0 animate-spin text-brand"
            />
          )}
          <h2
            className="min-w-0 flex-1 truncate text-sm font-semibold select-none"
            onDoubleClick={onRename}
            title={onRename ? "Double-click to rename" : undefined}
          >
            {session.title || "Untitled"}
          </h2>
          {sidebarSide === "right" && sidebarToggle}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                >
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Token usage as the daemon reported it (was a header pill;
                    it lives in the menu now). Hidden until any lands. */}
                <UsageMenuRow usage={usage} />
                <DropdownMenuItem
                  onClick={() => setShowToolCalls(!showActivity)}
                >
                  <Wrench className="size-4 mr-2 text-muted-foreground" />
                  {showActivity ? "Hide Tools" : "Show Tools"}
                </DropdownMenuItem>
                {onCompact && (
                  <DropdownMenuItem disabled={isStreaming} onClick={onCompact}>
                    <FoldVertical className="size-4 mr-2 text-muted-foreground" />
                    Compact conversation
                  </DropdownMenuItem>
                )}
                <HelpMenuItem />
                {onRename && (
                  <DropdownMenuItem onClick={onRename}>
                    <Pencil className="size-4 mr-2 text-muted-foreground" />
                    Rename
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete}>
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isMobile && (
            <MobileChatMenu
              showActivity={showActivity}
              onToggleActivity={() => setShowToolCalls(!showActivity)}
              onRename={onRename}
              onDelete={onDelete}
              onCompact={onCompact}
              compactDisabled={isStreaming}
              usage={usage}
            />
          )}
        </div>

        <div className="relative flex-1 min-h-0">
          <div
            ref={messagesContainerRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              const pinned =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              atBottomRef.current = pinned;
              setAtBottom(pinned);
            }}
            className="h-full overflow-y-auto px-3 pt-1 pb-48 max-[499px]:pb-24 lg:px-6 lg:pt-2 lg:pb-56"
          >
            <TextSelectionToolbar
              containerRef={messagesContainerRef}
              onAddToChat={(text) => setAppendText(text)}
              onAskInSideChat={(text) => setAppendText(text)}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-0 w-full max-w-[768px]">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onOpenArtifact={(artifact) =>
                    setPanel({ kind: "artifact", artifact })
                  }
                  onOpenAttachment={(attachment) =>
                    setPanel({ kind: "attachment", attachment })
                  }
                  onOpenToolCall={handleOpenToolCall}
                  onStartThread={handleStartThread}
                  threadSummary={threadMap[threadKeyForMessage(msg)]}
                  botName={botName}
                  showActivity={showActivity}
                  streaming={isStreaming && msg.id === messages.at(-1)?.id}
                />
              ))}
              {pendingApproval && (
                <ApprovalPanel
                  approval={pendingApproval}
                  onRespond={onRespondApproval}
                />
              )}
              {isStreaming && !pendingAuthorization && (
                <StreamingIndicator
                  message={
                    messages[messages.length - 1]?.role === "assistant"
                      ? messages[messages.length - 1]
                      : undefined
                  }
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-3 lg:px-4 pb-4 max-[499px]:px-0 max-[499px]:pb-0">
            {!atBottom && (
              <div className="pointer-events-none absolute -top-12 left-0 right-0 flex justify-center">
                <Button
                  size="icon"
                  onClick={() =>
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll to bottom"
                  className="pointer-events-auto size-9 rounded-full border border-border bg-background text-muted-foreground shadow-md hover:bg-muted"
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            )}
            <div className="max-w-[768px] space-y-1.5 max-[499px]:max-w-none">
              {/* Effective model + three-band context meter + usage facets.
                  Renders once anything is counted; with an unknown window it
                  shows the bare current size instead of hiding. */}
              <ContextMeter
                modelLabel={contextInfo?.modelLabel ?? ""}
                contextWindow={contextInfo?.contextWindow ?? 0}
                occupancyTokens={contextOccupancy}
                usage={usage}
              />
              <QueuedMessageStrip
                queued={queuedMessages}
                pendingSteers={pendingSteers}
                paused={queuePaused}
                isStreaming={isStreaming}
                onSteer={(id) => onSteerQueued?.(id)}
                onEdit={handleEditQueued}
                onDelete={(id) => onDeleteQueued?.(id)}
                onResume={onResumeQueue}
                onEditAll={onTakeAllQueued ? handleEditAllQueued : undefined}
                onClearAll={onClearQueue}
                onRetractSteers={
                  onRetractSteers ? () => void handleRetractSteers() : undefined
                }
              />
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-background bg-gradient-to-b from-destructive/5 to-destructive/5 px-3 py-2">
                  <AlertCircle className="size-4 shrink-0 text-destructive" />
                  <p className="min-w-0 flex-1 text-sm text-destructive break-words">
                    {error}
                  </p>
                  {onRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={onRetry}
                    >
                      <RotateCcw className="size-3.5" />
                      Retry
                    </Button>
                  )}
                </div>
              )}
              <MockProviderNotice />
              {pendingClarification ? (
                <ClarificationPanel
                  clarification={pendingClarification}
                  onRespond={onRespondClarification}
                />
              ) : pendingAuthorization ? (
                // The run is parked on a browser sign-in: the takeover card
                // owns the composer slot until the sign-in is confirmed
                // (re-check) or abandoned (cancel) through the daemon's
                // AUTHORIZATION controls.
                <AuthorizationPanel
                  authorization={pendingAuthorization}
                  onOpen={onOpenAuthorization ?? noAuthorizationAction}
                  onCopyLink={onCopyAuthorizationLink ?? noAuthorizationAction}
                  onRecheck={onRecheckAuthorization ?? noAuthorizationAction}
                  onCancel={onCancelAuthorization ?? noAuthorizationAction}
                />
              ) : (
                <ChatInput
                  onSend={onSend}
                  onQueue={onQueueMessage}
                  onSteer={onSteerMessage}
                  onLocalCommand={onLocalCommand}
                  onPreviewAttachment={handlePreviewFile}
                  focusKey={session.id}
                  mobileDocked
                  modelLockedLabel={
                    live ? session.model || "Auto-routed" : undefined
                  }
                  onModelChange={() => {}}
                  models={models}
                  autoModelLabel={autoModelLabel}
                  onSwitchModel={live ? onSwitchModel : undefined}
                  currentModelId={session.model ?? ""}
                  mode={mode}
                  onModeChange={onModeChange}
                  isStreaming={isStreaming}
                  disabled={!!pendingApproval || readOnlyPlaceholder != null}
                  appendText={appendText}
                  onAppendConsumed={handleAppendConsumed}
                  initialText={editSeed ? editSeed.text || null : initialDraft}
                  initialFiles={editSeed?.files}
                  onInitialTextConsumed={() => {
                    if (editSeed !== null) setEditSeed(null);
                    else onInitialDraftConsumed?.();
                  }}
                  queuedCount={queuedMessages.length}
                  onResumeQueue={onResumeQueue}
                  onEditAllQueued={
                    onTakeAllQueued ? handleEditAllQueued : undefined
                  }
                  onClearQueue={onClearQueue}
                  placeholder={
                    readOnlyPlaceholder ??
                    (isStreaming
                      ? // "Steer" is only an honest promise while the daemon
                        // actually supports it (C1.2) — absent, sends queue.
                        enterBehavior === "steer" && onSteerMessage
                        ? "Steer the agent..."
                        : "Queue a message..."
                      : "Send a message...")
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {!isMobile && activePanel !== null && (
        <SidePanelForKind
          panel={activePanel}
          parentSessionId={session.id}
          botName={botName}
          onClose={closeSidePanel}
          onConvertToChat={handleConvertThread}
          maximized={panelMaximized}
          onToggleMaximize={toggleMaximize}
        />
      )}
      {/* On mobile the same panels render as a full-height bottom sheet: the
          grab handle owns dismissal (no window controls), and dvh keeps the
          thread composer above the on-screen keyboard. */}
      {isMobile && activePanel !== null && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) closeSidePanel();
          }}
        >
          <SheetContent side="bottom" className="flex h-[94dvh] flex-col p-0">
            <SheetTitle className="sr-only">
              {activePanel.kind === "thread"
                ? "Thread"
                : activePanel.kind === "attachment"
                  ? activePanel.attachment.name
                  : activePanel.kind === "toolcall"
                    ? activePanel.call.name
                    : activePanel.artifact.name}
            </SheetTitle>
            <div className="flex min-h-0 flex-1 flex-col">
              <SidePanelForKind
                panel={activePanel}
                parentSessionId={session.id}
                botName={botName}
                onClose={closeSidePanel}
                onConvertToChat={handleConvertThread}
                maximized
                onToggleMaximize={() => {}}
                windowControls={false}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/** Renders the right-hand panel for the active kind. */
function SidePanelForKind({
  panel,
  parentSessionId,
  botName,
  onClose,
  onConvertToChat,
  maximized,
  onToggleMaximize,
  windowControls,
}: {
  panel: ActivePanel;
  parentSessionId: string;
  botName: string;
  onClose: () => void;
  onConvertToChat?: (threadSessionId: string) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  windowControls?: boolean;
}) {
  const shared = { onClose, maximized, onToggleMaximize, windowControls };
  switch (panel.kind) {
    case "artifact":
      return <MarkdownCanvasPanel artifact={panel.artifact} {...shared} />;
    case "attachment":
      return <AttachmentPanel attachment={panel.attachment} {...shared} />;
    case "toolcall":
      return <ToolCallPanel call={panel.call} {...shared} />;
    case "thread":
      // Mock chat threads stay local: read-only replies, no daemon session.
      if (isMockTourSession(parentSessionId)) {
        return (
          <MockThreadPanel
            rootMessage={panel.message}
            botName={botName}
            {...shared}
          />
        );
      }
      return (
        <ThreadPanel
          // Re-key per root message: switching threads must remount the
          // panel so its chat hook re-binds to the right thread session.
          key={`${parentSessionId}:${panel.message.id}`}
          parentSessionId={parentSessionId}
          rootMessage={panel.message}
          botName={botName}
          onConvertToChat={onConvertToChat}
          {...shared}
        />
      );
  }
}
