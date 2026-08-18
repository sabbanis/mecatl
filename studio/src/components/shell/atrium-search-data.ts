import { Brain, Clock, MessageCircle, Sparkles } from "lucide-react";
import { SKILLS } from "@/app/(authenticated)/workspace/skills/_data/skills";
import {
  MOCK_CRON_JOBS,
  MOCK_MEMORY_ENTRIES,
  MOCK_MESSAGES,
  MOCK_PROJECTS,
  MOCK_SESSIONS,
} from "@/features/agent/mock-data";
import type { SearchEntry, SearchGroup } from "./search-types";

/**
 * Global-search entries for the Atrium workspace surfaces (chats, memory,
 * skills, scheduled tasks), derived from the same in-memory fixtures the pages
 * render so a result always deep-links to a record that resolves. Chat entries
 * put their full message text in `body`, so the palette can find a word said
 * *inside* a conversation and show a snippet of where it matched.
 */

/** Collapse a chat's messages into one searchable blob. */
function chatBodyText(sessionId: string): string {
  const messages = MOCK_MESSAGES[sessionId] ?? [];
  return messages
    .map((m) => m.content)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const CHAT_ENTRIES: SearchEntry[] = MOCK_SESSIONS.filter(
  (s) => !s.archived,
).map((session) => {
  const project = MOCK_PROJECTS.find((p) => p.id === session.projectId);
  return {
    id: `chat-${session.id}`,
    source: "atrium",
    category: "chat",
    title: session.title || "Untitled chat",
    subtitle: project ? project.name : "Chat",
    keywords: project ? [project.name] : [],
    body: chatBodyText(session.id),
    href: `/workspace/chat/${session.id}`,
    icon: MessageCircle,
  };
});

const MEMORY_ENTRIES: SearchEntry[] = MOCK_MEMORY_ENTRIES.map((entry) => ({
  id: `memory-${entry.id}`,
  source: "atrium",
  category: "memory",
  title: entry.title,
  subtitle: `Memory · ${entry.section}`,
  keywords: [entry.section],
  body: entry.content,
  href: `/workspace/memory/${entry.id}`,
  icon: Brain,
}));

const SKILL_ENTRIES: SearchEntry[] = SKILLS.map((skill) => ({
  id: `skill-${skill.id}`,
  source: "atrium",
  category: "skill",
  title: skill.displayName,
  subtitle: `Skill · ${skill.author}`,
  keywords: [skill.name, skill.description],
  body: skill.content ?? "",
  href: `/workspace/skills/${skill.id}`,
  icon: Sparkles,
}));

const SCHEDULE_ENTRIES: SearchEntry[] = MOCK_CRON_JOBS.map((job) => ({
  id: `schedule-${job.id}`,
  source: "atrium",
  category: "schedule",
  title: job.name,
  subtitle: `Scheduled · ${job.schedule}`,
  keywords: job.tools ?? [],
  body: [job.instruction, job.prompt ?? ""].join(" "),
  href: `/workspace/schedules/${job.id}`,
  icon: Clock,
}));

export const ATRIUM_SEARCH_ENTRIES: readonly SearchEntry[] = [
  ...CHAT_ENTRIES,
  ...MEMORY_ENTRIES,
  ...SKILL_ENTRIES,
  ...SCHEDULE_ENTRIES,
];

export const ATRIUM_SEARCH_GROUPS: readonly SearchGroup[] = [
  { category: "chat", heading: "Chats", source: "atrium" },
  { category: "memory", heading: "Memory", source: "atrium" },
  { category: "skill", heading: "Skills", source: "atrium" },
  { category: "schedule", heading: "Scheduled", source: "atrium" },
];
