"use client";

import { Paperclip, Send, Sparkles, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "agent" | "tool";
  content: string;
  tool?: string;
}

interface ChatWindowProps {
  title: string;
  seedMessages: Message[];
  attachedSkill?: string;
}

export function ChatWindow({
  title,
  seedMessages,
  attachedSkill,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    if (!draft.trim()) return;
    const next: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: draft.trim(),
    };
    setMessages((prev) => [...prev, next]);
    setDraft("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "agent",
          content:
            "Working on it — this is a UI-only demo, so no model is actually running.",
        },
      ]);
    }, 400);
  };

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full bg-brand" />
          <span className="text-sm font-medium truncate">{title}</span>
        </div>
        {attachedSkill && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent px-2 py-1 text-xs">
            <Sparkles className="size-3" />
            <span className="truncate max-w-[140px]">{attachedSkill}</span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything…"
            className="min-h-[52px] flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="icon" aria-label="Attach">
              <Paperclip className="size-4" />
            </Button>
            <Button size="icon" onClick={handleSend} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "tool") {
    return (
      <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-2 text-xs">
        <Wrench className="mt-0.5 size-3.5 text-muted-foreground" />
        <div className="min-w-0">
          <div className="font-medium">{message.tool}</div>
          <div className="text-muted-foreground line-clamp-3">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
