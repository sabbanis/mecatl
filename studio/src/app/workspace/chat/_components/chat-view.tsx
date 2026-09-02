"use client";

import {
  AlertCircle,
  ArrowDown,
  CirclePlus,
  Ellipsis,
  Loader2,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AgentMessage,
  AgentSession,
  ApprovalChoice,
  ApprovalRequest,
  ClarificationRequest,
} from "@/features/agent";
import { formatTokens } from "@/lib/formatters";
import type { SessionListSide } from "@/lib/profile-preferences";
import { ChatInput } from "../../_components/chat-input";
import { ApprovalPanel } from "./approval-panel";
import { ClarificationPanel } from "./clarification-panel";
import { MessageBubble } from "./message-bubble";
import { MockProviderNotice } from "./mock-provider-notice";

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

/** Token counts as a read-only info row inside the chat context menus. */
function UsageMenuRow({
  usage,
}: {
  usage?: { inputTokens: number; outputTokens: number } | null;
}) {
  if (!usage || usage.inputTokens + usage.outputTokens <= 0) return null;
  return (
    <div className="mb-1 border-b border-border/60 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">Token usage</p>
      <p className="mt-1 text-sm tabular-nums">
        {formatTokens(usage.inputTokens)} input
      </p>
      <p className="text-sm tabular-nums">
        {formatTokens(usage.outputTokens)} output
      </p>
    </div>
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
  usage,
  error,
  onRetry,
  sidebarOpen,
  sidebarSide,
  onToggleSidebar,
  pendingApproval,
  onRespondApproval,
  pendingClarification,
  onRespondClarification,
  onRename,
  onDelete,
  initialDraft,
  onInitialDraftConsumed,
}: {
  session: AgentSession;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (content: string, files?: File[]) => void;
  botName: string;
  /** True while the daemon connection is up. */
  live?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
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
  onRename?: () => void;
  onDelete?: () => void;
  /** Fires when the right-hand side panel (artifact/attachment) opens or
      closes, so the parent can collapse the chat list while it's open. */
  onSidePanelOpenChange?: (open: boolean) => void;
  /** Plain-text prompt to pre-fill the composer with on mount (a "next step"
      chip that seeds the message without sending it). */
  initialDraft?: string | null;
  onInitialDraftConsumed?: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Whether the transcript is scrolled to (near) the bottom; when it isn't,
  // a floating control above the composer jumps back down. The ref mirror is
  // what the follow effect reads — it must see the value as of the latest
  // scroll, not the latest render.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [appendText, setAppendText] = useState<string | null>(null);
  const handleAppendConsumed = useCallback(() => setAppendText(null), []);

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

  // The sidebar toggle renders on the header edge nearest the panel it
  // controls: leading when the session list docks left, trailing when right.
  const sidebarToggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
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
        {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex h-[60px] items-center gap-2 border-b border-border px-3 max-[499px]:h-14 lg:gap-3 lg:px-6">
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
              <DropdownMenuItem onClick={() => setShowActivity((v) => !v)}>
                <Wrench className="size-4 mr-2 text-muted-foreground" />
                {showActivity ? "Hide Tools" : "Show Tools"}
              </DropdownMenuItem>
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
            />
            <div className="flex-1 min-w-0 flex flex-col gap-0 w-full max-w-[768px]">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  botName={botName}
                  showActivity={showActivity}
                />
              ))}
              {pendingApproval && (
                <ApprovalPanel
                  approval={pendingApproval}
                  onRespond={onRespondApproval}
                />
              )}
              {isStreaming && (
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
              ) : (
                <ChatInput
                  onSend={onSend}
                  isStreaming={isStreaming}
                  disabled={!!pendingApproval}
                  appendText={appendText}
                  onAppendConsumed={handleAppendConsumed}
                  initialText={initialDraft}
                  onInitialTextConsumed={onInitialDraftConsumed}
                  placeholder="Send a message..."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
