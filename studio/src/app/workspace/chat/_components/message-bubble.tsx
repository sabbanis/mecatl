"use client";

import {
  AlertCircle,
  Bot,
  Copy,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  MessageSquareText,
  Paperclip,
  User,
} from "lucide-react";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentMessage, Artifact, Attachment } from "@/features/agent";
import { formatMessageTime } from "@/lib/formatters";
import { useAgentAvatar, useUserAvatar } from "@/lib/profile-preferences";
import { cn } from "@/lib/utils";
import { mdComponents } from "./markdown-components";
import { ToolCallList } from "./tool-call-list";

function UserAvatar() {
  const { avatarUrl } = useUserAvatar();
  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: a locally stored data URL, not a remote image
      <img
        src={avatarUrl}
        alt="You"
        className="size-7 lg:size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex size-7 lg:size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <User className="size-4 lg:size-5" />
    </div>
  );
}

export function BotAvatar() {
  const { avatarUrl } = useAgentAvatar();
  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: a locally stored data URL, not a remote image
      <img
        src={avatarUrl}
        alt=""
        className="size-7 lg:size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex size-7 lg:size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
      <Bot className="size-4 lg:size-5" />
    </div>
  );
}

/**
 * Slack-style reply indicator shown under a message that has a thread: the
 * unique repliers, the reply count, and when the last reply landed. Clicking it
 * opens the thread side panel.
 */
function ReplyIndicator({
  replies,
  onClick,
}: {
  replies: AgentMessage[];
  onClick: () => void;
}) {
  const last = replies[replies.length - 1];
  const authors: string[] = [];
  for (const r of replies) {
    const name = r.role === "user" ? "You" : (r.agentName ?? "Mecatl");
    if (!authors.includes(name)) authors.push(name);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/reply mt-1.5 -ml-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-brand/5"
    >
      <div className="flex -space-x-1.5">
        {authors.slice(0, 3).map((name) => (
          <span
            key={name}
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-background",
              name === "You"
                ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100"
                : "bg-brand text-white",
            )}
          >
            {name === "You" ? "Y" : <Bot className="size-3" />}
          </span>
        ))}
      </div>
      <span className="text-xs font-semibold text-brand group-hover/reply:underline">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </span>
      <span
        suppressHydrationWarning
        className="hidden text-xs text-muted-foreground sm:inline"
      >
        Last reply {formatMessageTime(last.timestamp)}
      </span>
    </button>
  );
}

function MessageActions({
  message,
  onStartThread,
}: {
  message: AgentMessage;
  onStartThread?: () => void;
}) {
  const copyContent = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
  };

  const btnClass =
    "flex items-center justify-center size-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="msg-actions flex items-center gap-1 h-6 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={copyContent} className={btnClass}>
              <Copy className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Copy to clipboard
          </TooltipContent>
        </Tooltip>
        {onStartThread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onStartThread}
                className={btnClass}
                aria-label="Reply in thread"
              >
                <MessageSquareText className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Reply in thread
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

const ARTIFACT_META: Record<
  string,
  { icon: typeof FileText; label: string; color: string; bg: string }
> = {
  spreadsheet: {
    icon: FileSpreadsheet,
    label: "Spreadsheet",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  document: {
    icon: FileText,
    label: "Document",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  code: {
    icon: FileCode2,
    label: "Code",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
};

function ArtifactCard({
  artifact,
  onClick,
}: {
  artifact: Artifact;
  onClick?: () => void;
}) {
  const meta = ARTIFACT_META[artifact.type] ?? ARTIFACT_META.document;
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background p-3 w-full max-w-md text-left cursor-pointer hover:border-brand/30 transition-colors"
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          meta.bg,
        )}
      >
        <Icon className={cn("size-5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{artifact.name}</p>
        <p className="text-xs text-muted-foreground">{meta.label}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 h-8 shrink-0 rounded-full border border-input px-3 text-xs font-medium">
        <ExternalLink className="size-3" />
        Open
      </span>
    </button>
  );
}

export function MessageBubble({
  message,
  onOpenArtifact,
  onOpenAttachment,
  onStartThread,
  botName = "Mecatl",
  showActivity = true,
}: {
  message: AgentMessage;
  onOpenArtifact?: (artifact: Artifact) => void;
  onOpenAttachment?: (attachment: Attachment) => void;
  onStartThread?: (message: AgentMessage) => void;
  botName?: string;
  showActivity?: boolean;
}) {
  const isUser = message.role === "user";

  if (message.role === "tool") return null;

  // Touch has no hover: a horizontal-dominant left swipe reveals the action
  // row instead (right swipe or a new swipe elsewhere hides it again).
  const [swipeRevealed, setSwipeRevealed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchMove = (event: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setSwipeRevealed(dx < 0);
    touchStart.current = null;
  };

  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasContent = message.content?.trim();
  // Notices and delegations can repeat verbatim within a turn, so rows get
  // positional ids up front to keep React keys unique.
  const notices = (message.notices ?? []).map((text, index) => ({
    id: `${index}:${text}`,
    text,
  }));
  const delegations = (message.delegations ?? []).map((d, index) => ({
    ...d,
    id: `${index}:${d.kind}:${d.label}`,
  }));
  // A failed turn must always render (never look like an empty success), as
  // must one that only carries notices or delegation badges.
  const hasExtras =
    Boolean(message.failed) || notices.length > 0 || delegations.length > 0;

  if (!isUser && !hasContent && !hasToolCalls && !hasExtras) return null;
  if (!isUser && !hasContent && hasToolCalls && !showActivity && !hasExtras)
    return null;

  return (
    <div
      className={cn(
        "group/msg flex gap-2 lg:gap-3 rounded-lg px-2 lg:px-3 py-2 -mx-2 lg:-mx-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
        !swipeRevealed && "[&:not(:hover)_.msg-actions]:opacity-0",
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      <div className="pt-0.5">{isUser ? <UserAvatar /> : <BotAvatar />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm lg:text-[15px] font-bold">
            {isUser ? "You" : (message.agentName ?? botName)}
          </span>
          <span
            suppressHydrationWarning
            className="msg-actions text-[11px] text-muted-foreground tabular-nums transition-opacity"
          >
            {formatMessageTime(message.timestamp)}
          </span>
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 my-1.5">
            {message.attachments.map((att) => (
              <button
                key={att.name}
                type="button"
                onClick={() => onOpenAttachment?.(att)}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 px-3 py-1 text-xs text-blue-600 dark:text-blue-400 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10 cursor-pointer"
              >
                <Paperclip className="size-3" />
                {att.name}
              </button>
            ))}
          </div>
        )}
        {hasToolCalls && showActivity && message.toolCalls && (
          <ToolCallList toolCalls={message.toolCalls} />
        )}
        {delegations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {delegations.map((d) => (
              <Badge
                key={d.id}
                variant="secondary"
                className="gap-1 border-transparent text-xs font-normal text-muted-foreground"
              >
                <GitBranch className="size-3" />
                {d.kind}: {d.label}
                {d.detail ? ` · ${d.detail}` : ""}
              </Badge>
            ))}
          </div>
        )}
        {hasContent && (
          <div className="text-sm lg:text-[15px] mt-0.5 leading-[1.75] text-foreground/80">
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={mdComponents}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {notices.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-0.5">
            {notices.map((notice) => (
              <p
                key={notice.id}
                className="truncate text-xs text-muted-foreground/70"
              >
                {notice.text}
              </p>
            ))}
          </div>
        )}
        {message.failed && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-destructive">This turn failed</p>
              {message.failureDetail && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-destructive/90">
                  {message.failureDetail}
                </p>
              )}
            </div>
          </div>
        )}
        {message.artifact && (
          <ArtifactCard
            artifact={message.artifact}
            onClick={
              onOpenArtifact
                ? () => {
                    if (message.artifact) onOpenArtifact(message.artifact);
                  }
                : undefined
            }
          />
        )}
        {message.replies && message.replies.length > 0 && onStartThread && (
          <ReplyIndicator
            replies={message.replies}
            onClick={() => onStartThread(message)}
          />
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <MessageActions
          message={message}
          onStartThread={
            onStartThread ? () => onStartThread(message) : undefined
          }
        />
      </div>
    </div>
  );
}
