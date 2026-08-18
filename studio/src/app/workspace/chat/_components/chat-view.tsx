"use client";

import {
  AlertCircle,
  ArrowLeft,
  CirclePlus,
  Ellipsis,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquareText,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  Artifact,
  Attachment,
  ClarificationRequest,
} from "@/features/agent";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ChatInput } from "../../_components/chat-input";
import { ApprovalPanel } from "./approval-panel";
import { ClarificationPanel } from "./clarification-panel";
import { ContextWindowIndicator } from "./context-window-indicator";
import { FilePreview } from "./file-preview";
import { MarkdownCanvasPanel } from "./markdown-canvas-panel";
import { BotAvatar, MessageBubble } from "./message-bubble";
import { SidePanel } from "./side-panel";

/** The single right-hand panel: exactly one kind is open at a time, or none. */
type ActivePanel =
  | { kind: "artifact"; artifact: Artifact }
  | { kind: "attachment"; attachment: Attachment }
  | { kind: "thread"; message: AgentMessage };

function MobileChatMenu({
  showActivity,
  onToggleActivity,
  onRename,
  onDelete,
}: {
  showActivity: boolean;
  onToggleActivity: () => void;
  onRename?: () => void;
  onDelete?: () => void;
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
        <SheetContent side="bottom" className="p-0 rounded-t-2xl">
          <SheetTitle className="sr-only">Chat options</SheetTitle>
          <div className="py-2">
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
              <>
                <div className="h-px bg-border mx-4 my-1" />
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
              </>
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
}: {
  attachment: Attachment;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  return (
    <SidePanel
      icon={FileText}
      title={attachment.name}
      closeLabel="Close file"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
    >
      <div className="flex-1 overflow-auto">
        <FilePreview name={attachment.name} content={attachment.content} />
      </div>
    </SidePanel>
  );
}

/**
 * A side-panel thread branched off a single message. The root message is shown
 * read-only at the top; replies typed here form a focused side conversation
 * without cluttering the main transcript.
 */
function ThreadPanel({
  rootMessage,
  botName,
  onClose,
  maximized,
  onToggleMaximize,
}: {
  rootMessage: AgentMessage;
  botName: string;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const [replies, setReplies] = useState<AgentMessage[]>(
    rootMessage.replies ?? [],
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSend = (content: string) => {
    const now = Date.now();
    setReplies((prev) => [
      ...prev,
      { id: `thread-u-${now}`, role: "user", content, timestamp: now },
      {
        id: `thread-a-${now}`,
        role: "assistant",
        content:
          "Picking this up in the thread — I'll keep it scoped to the message above.",
        timestamp: now + 1,
      },
    ]);
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  };

  return (
    <SidePanel
      icon={MessageSquareText}
      title="Thread"
      closeLabel="Close thread"
      maximized={maximized}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      initialWidth={440}
      minWidth={340}
    >
      {/* Body: root message, replies, composer */}
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto px-3 lg:px-4 pt-3 pb-40">
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
          {replies.map((r) => (
            <MessageBubble key={r.id} message={r} botName={botName} />
          ))}
          <div ref={endRef} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-3 lg:px-4 pb-4">
          <ChatInput
            compact
            rows={1}
            onSend={handleSend}
            onModelChange={() => {}}
            placeholder="Reply in thread…"
          />
        </div>
      </div>
    </SidePanel>
  );
}

function TextSelectionToolbar({
  containerRef,
  onAddToChat,
  onAskInSideChat,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onAddToChat: (text: string) => void;
  onAskInSideChat: (text: string) => void;
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
        Add to chat
      </button>
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
        Ask in side chat
      </button>
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
  error,
  onRetry,
  sidebarOpen,
  onToggleSidebar,
  pendingApproval,
  onRespondApproval,
  pendingClarification,
  onRespondClarification,
  onRename,
  onDelete,
  onSidePanelOpenChange,
  initialDraft,
  onInitialDraftConsumed,
}: {
  session: AgentSession;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (content: string) => void;
  botName: string;
  /** True while the daemon connection is up. */
  live?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  /** The last turn failed with this text; rendered as an inline strip. */
  error?: string | null;
  onRetry?: () => void;
  sidebarOpen: boolean;
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showActivity, setShowActivity] = useState(false);
  // The single right-hand panel — a discriminated union makes "one panel at a
  // time" structural rather than something to coordinate by hand.
  const [panel, setPanel] = useState<ActivePanel | null>(null);
  const [appendText, setAppendText] = useState<string | null>(null);
  // When maximized, the panel fills the pane and the conversation column is
  // hidden. Always reset when the panel is closed.
  const [panelMaximized, setPanelMaximized] = useState(false);
  const isMobile = useIsMobile();
  const handleAppendConsumed = useCallback(() => setAppendText(null), []);

  const closeSidePanel = useCallback(() => {
    setPanel(null);
    setPanelMaximized(false);
  }, []);
  const toggleMaximize = useCallback(() => setPanelMaximized((v) => !v), []);
  const handleStartThread = useCallback(
    (message: AgentMessage) => setPanel({ kind: "thread", message }),
    [],
  );

  // Jump to the latest message whenever the active chat changes so users
  // always land at the bottom (most-recent) of the conversation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolling is intentionally driven by session.id changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [session.id]);

  // The right-hand panel only renders on non-mobile layouts; let the parent
  // collapse the chat list while it's open so both panels fit side by side.
  const sidePanelOpen = !isMobile && panel !== null;
  useEffect(() => {
    onSidePanelOpenChange?.(sidePanelOpen);
  }, [sidePanelOpen, onSidePanelOpenChange]);

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-background",
          panelMaximized && "hidden",
        )}
      >
        <div className="flex h-16 items-center gap-2 lg:gap-3 border-b border-border px-3 lg:px-6">
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
          <h2
            className="min-w-0 flex-1 truncate text-sm font-semibold select-none"
            onDoubleClick={onRename}
            title={onRename ? "Double-click to rename" : undefined}
          >
            {session.title || "Untitled"}
          </h2>
          {live && usage && (
            /* Token usage as the daemon reported it; hidden until any lands. */
            <div className="hidden sm:block shrink-0">
              <ContextWindowIndicator usage={usage} />
            </div>
          )}
          {!isMobile && (
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
                    <PanelRightClose className="size-4" />
                  ) : (
                    <PanelRightOpen className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              </TooltipContent>
            </Tooltip>
          )}
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
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete}>
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isMobile && (
            <MobileChatMenu
              showActivity={showActivity}
              onToggleActivity={() => setShowActivity((v) => !v)}
              onRename={onRename}
              onDelete={onDelete}
            />
          )}
        </div>

        <div className="relative flex-1 min-h-0">
          <div
            ref={messagesContainerRef}
            className="h-full overflow-y-auto px-3 lg:px-6 pt-1 lg:pt-2 pb-48 lg:pb-56"
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
                  onStartThread={handleStartThread}
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
              {isStreaming &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3 px-3 py-1.5 -mx-3">
                    <div className="pt-0.5">
                      <BotAvatar />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-3 lg:px-6 pb-4 lg:pb-6">
            <div className="max-w-[768px] space-y-1.5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
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
              {pendingClarification ? (
                <ClarificationPanel
                  clarification={pendingClarification}
                  onRespond={onRespondClarification}
                />
              ) : (
                <ChatInput
                  onSend={onSend}
                  onQueue={onSend}
                  modelLockedLabel={live ? "Auto-routed" : undefined}
                  onModelChange={() => {}}
                  isStreaming={isStreaming}
                  disabled={!!pendingApproval}
                  appendText={appendText}
                  onAppendConsumed={handleAppendConsumed}
                  initialText={initialDraft}
                  onInitialTextConsumed={onInitialDraftConsumed}
                  placeholder={
                    isStreaming ? "Queue a message..." : "Send a message..."
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {!isMobile && panel !== null && (
        <SidePanelForKind
          panel={panel}
          botName={botName}
          onClose={closeSidePanel}
          maximized={panelMaximized}
          onToggleMaximize={toggleMaximize}
        />
      )}
    </div>
  );
}

/** Renders the right-hand panel for the active kind. */
function SidePanelForKind({
  panel,
  botName,
  onClose,
  maximized,
  onToggleMaximize,
}: {
  panel: ActivePanel;
  botName: string;
  onClose: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const shared = { onClose, maximized, onToggleMaximize };
  switch (panel.kind) {
    case "artifact":
      return <MarkdownCanvasPanel artifact={panel.artifact} {...shared} />;
    case "attachment":
      return <AttachmentPanel attachment={panel.attachment} {...shared} />;
    case "thread":
      return (
        <ThreadPanel
          rootMessage={panel.message}
          botName={botName}
          {...shared}
        />
      );
  }
}
