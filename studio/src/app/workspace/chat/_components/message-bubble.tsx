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
  Image as ImageIcon,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AgentMessage,
  Artifact,
  Attachment,
  ToolCallInfo,
} from "@/features/agent";
import { fileKindMeta } from "@/lib/file-meta";
import { formatMessageTime } from "@/lib/formatters";
import {
  useAgentAvatar,
  useUserAvatar,
  useUserDisplayName,
} from "@/lib/profile-preferences";
import { cn } from "@/lib/utils";
import { mdComponents } from "./markdown-components";
import { ToolCallList } from "./tool-call-list";

function UserAvatar({ small = false }: { small?: boolean }) {
  const { avatarUrl } = useUserAvatar();
  // The reply indicator overlaps small avatars, so that size gets a
  // background ring to separate the stack.
  const frame = small
    ? "size-5 shrink-0 ring-2 ring-background"
    : "size-7 lg:size-9 shrink-0";
  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: a locally stored data URL, not a remote image
      <img
        src={avatarUrl}
        alt="You"
        className={cn(frame, "rounded-full object-cover")}
      />
    );
  }
  return (
    <div
      className={cn(
        frame,
        "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
      )}
    >
      <User className={small ? "size-3" : "size-4 lg:size-5"} />
    </div>
  );
}

function BotAvatar({ small = false }: { small?: boolean }) {
  const { avatarUrl } = useAgentAvatar();
  const frame = small
    ? "size-5 shrink-0 ring-2 ring-background"
    : "size-7 lg:size-9 shrink-0";
  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: a locally stored data URL, not a remote image
      <img
        src={avatarUrl}
        alt=""
        className={cn(frame, "rounded-full object-cover")}
      />
    );
  }
  return (
    <div
      className={cn(
        frame,
        "flex items-center justify-center rounded-full bg-brand text-white",
      )}
    >
      <Bot className={small ? "size-3" : "size-4 lg:size-5"} />
    </div>
  );
}

/**
 * Splits the leading "> " blockquote lines off a user message. Add-to-chat
 * and thread-root quoting compose messages as a quote block, a blank line,
 * then the user's own words — user text otherwise stays plain (never
 * markdown-interpreted), so only this one deterministic shape gets styling.
 */
export function splitLeadingQuote(content: string): {
  quote: string | null;
  rest: string;
} {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && /^>\s?/.test(lines[i])) i++;
  if (i === 0) return { quote: null, rest: content };
  const quote = lines
    .slice(0, i)
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n");
  const rest = lines.slice(i).join("\n").replace(/^\n+/, "");
  return { quote, rest };
}

function MessageActions({ message }: { message: AgentMessage }) {
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
  image: {
    icon: ImageIcon,
    label: "Image",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  pdf: {
    icon: FileText,
    label: "PDF",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/40",
  },
  markdown: {
    icon: FileText,
    label: "Markdown",
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/40",
  },
};

/**
 * One attachment chip on a message: the file-kind glyph (image/PDF/markdown/
 * code, paperclip fallback) and, for an image with a displayable source, a
 * small thumbnail of the image itself — mirroring the composer's
 * AttachmentPill so a sent file keeps the look it had while attached.
 */
function AttachmentChip({
  attachment,
  onOpen,
  title,
}: {
  attachment: Attachment;
  onOpen?: () => void;
  title?: string;
}) {
  const kind = fileKindMeta(attachment.name, attachment.type);
  const KindIcon = kind.icon;
  const thumbSrc =
    kind.label === "Image"
      ? (attachment.url ??
        (attachment.content?.startsWith("data:")
          ? attachment.content
          : undefined))
      : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 pr-3 text-xs text-brand transition-colors hover:border-brand/60 hover:bg-brand/10 cursor-pointer",
        thumbSrc ? "pl-1" : "pl-3",
      )}
    >
      {thumbSrc ? (
        // biome-ignore lint/performance/noImgElement: a data/object URL thumbnail, not a remote image
        <img
          src={thumbSrc}
          alt=""
          className="size-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <KindIcon aria-label={kind.label} className="size-3" />
      )}
      {attachment.name}
    </button>
  );
}

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
  botName = "Mecatl",
  showActivity = true,
}: {
  message: AgentMessage;
  onOpenArtifact?: (artifact: Artifact) => void;
  onOpenAttachment?: (attachment: Attachment) => void;
  botName?: string;
  showActivity?: boolean;
}) {
  const isUser = message.role === "user";
  const { name: userName } = useUserDisplayName();

  if (message.role === "tool") return null;

  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  // Files this turn produced (Write calls), rendered as attachment chips —
  // deduped by path, the LAST write of a path wins (it is the final content).
  const producedFiles = (() => {
    const byPath = new Map<string, NonNullable<ToolCallInfo["file"]>>();
    for (const call of message.toolCalls ?? []) {
      if (call.file) byPath.set(call.file.path, call.file);
    }
    return [...byPath.values()];
  })();
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
    <div className="group/msg flex gap-2 lg:gap-3 rounded-lg px-2 lg:px-3 py-2 -mx-2 lg:-mx-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 [&:not(:hover)_.msg-actions]:opacity-0">
      <div className="pt-0.5">{isUser ? <UserAvatar /> : <BotAvatar />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm lg:text-[15px] font-bold">
            {isUser ? userName || "You" : (message.agentName ?? botName)}
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
              <AttachmentChip
                key={att.name}
                attachment={att}
                onOpen={() => onOpenAttachment?.(att)}
              />
            ))}
          </div>
        )}
        {producedFiles.length > 0 && (
          <div className="my-1.5 flex flex-wrap gap-1.5">
            {producedFiles.map((file) => (
              <AttachmentChip
                key={file.path}
                attachment={{
                  name: file.name,
                  type: "",
                  content: file.content,
                }}
                title={file.path}
                onOpen={() =>
                  onOpenAttachment?.({
                    name: file.name,
                    type: "",
                    content: file.content,
                  })
                }
              />
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
              (() => {
                const { quote, rest } = splitLeadingQuote(message.content);
                return (
                  <div className="flex flex-col gap-1.5">
                    {quote && (
                      <blockquote className="border-l-2 border-border pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                        {quote}
                      </blockquote>
                    )}
                    <div className="whitespace-pre-wrap">{rest}</div>
                  </div>
                );
              })()
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
      </div>
      <div className="shrink-0 pt-0.5">
        <MessageActions message={message} />
      </div>
    </div>
  );
}
