/**
 * TEMPORARY compile shim.
 *
 * The prototype's demo fixtures were excluded at import: Studio is
 * daemon-only, so an unreachable daemon must render as offline, never as
 * demo content. These empty exports keep the not-yet-converted hooks
 * compiling; the daemon-only hook rewrite deletes this file entirely.
 */
import type {
  AgentMessage,
  AgentProject,
  AgentRoster,
  AgentSession,
  CronJob,
  MemoryEntry,
} from "./types";

export const MOCK_SESSIONS: AgentSession[] = [];
export const MOCK_AGENTS: AgentRoster[] = [];
export const MOCK_MESSAGES: Record<string, AgentMessage[]> = {};
export const MOCK_PROJECTS: AgentProject[] = [];
export const MOCK_MEMORY_ENTRIES: MemoryEntry[] = [];
export const MOCK_CRON_JOBS: CronJob[] = [];
