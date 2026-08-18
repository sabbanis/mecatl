"use client";

import { useCallback, useState } from "react";
import { MOCK_SESSIONS } from "../mock-data";
import type { AgentSession, CreateSessionOpts } from "../types";

/**
 * Module-level mirror of the session list. Selecting a chat navigates, and Next
 * remounts the chat workspace when the optional-catch-all route's param count
 * changes — which would otherwise reset this hook's `useState` back to the
 * fixtures, dropping any chat created or edited in-session. Seeding state from
 * (and writing every mutation back to) this mirror keeps those changes alive
 * across the remount. It resets on a full page reload, which is fine for the
 * demo fixtures.
 */
let sessionStore: AgentSession[] | null = null;

export function useAgentSessions() {
  const [sessions, setSessionsState] = useState<AgentSession[]>(
    () => sessionStore ?? MOCK_SESSIONS,
  );
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // Persist every update to the module mirror so a remount restores it.
  const setSessions = useCallback(
    (updater: (prev: AgentSession[]) => AgentSession[]) => {
      setSessionsState((prev) => {
        const next = updater(prev);
        sessionStore = next;
        return next;
      });
    },
    [],
  );

  const createSession = useCallback(
    async (opts: CreateSessionOpts = {}) => {
      const session: AgentSession = {
        id: `s-${Date.now()}`,
        title: "New conversation",
        projectId: opts.projectId ?? null,
        agentId: opts.agentId,
        model: opts.model ?? "claude-sonnet-4-6",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        archived: false,
        unread: false,
        messageCount: 0,
        isStreaming: false,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: null,
        contextLength: 200_000,
        lastPromptTokens: null,
        thresholdTokens: 160_000,
      };
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [setSessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [setSessions],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const target = sessions.find((s) => s.id === id);
      const updated = target
        ? { ...target, title, updatedAt: Date.now() }
        : target;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
        ),
      );
      return updated as AgentSession;
    },
    [sessions, setSessions],
  );

  const pinSession = useCallback(
    async (id: string, pinned: boolean) => {
      const target = sessions.find((s) => s.id === id);
      const updated = target
        ? { ...target, pinned, updatedAt: Date.now() }
        : target;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, pinned, updatedAt: Date.now() } : s,
        ),
      );
      return updated as AgentSession;
    },
    [sessions, setSessions],
  );

  const archiveSession = useCallback(
    async (id: string, archived: boolean) => {
      const target = sessions.find((s) => s.id === id);
      const updated = target
        ? { ...target, archived, updatedAt: Date.now() }
        : target;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, archived, updatedAt: Date.now() } : s,
        ),
      );
      return updated as AgentSession;
    },
    [sessions, setSessions],
  );

  const refreshSessions = useCallback(async () => {}, []);

  return {
    sessions,
    isLoading,
    error,
    createSession,
    deleteSession,
    renameSession,
    pinSession,
    archiveSession,
    refreshSessions,
  };
}
