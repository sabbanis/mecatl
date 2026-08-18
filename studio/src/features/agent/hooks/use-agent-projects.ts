"use client";

import { useCallback, useState } from "react";
import { MOCK_PROJECTS } from "../mock-data";
import type { AgentProject } from "../types";

/** Module mirror so projects survive the chat-workspace remount on navigation
 * (see the note in use-agent-sessions). Resets on a full page reload. */
let projectStore: AgentProject[] | null = null;

export function useAgentProjects() {
  const [projects, setProjectsState] = useState<AgentProject[]>(
    () => projectStore ?? MOCK_PROJECTS,
  );
  const [isLoading] = useState(false);

  const setProjects = useCallback(
    (updater: (prev: AgentProject[]) => AgentProject[]) => {
      setProjectsState((prev) => {
        const next = updater(prev);
        projectStore = next;
        return next;
      });
    },
    [],
  );

  const createProject = useCallback(
    async (name: string, color?: string) => {
      const project: AgentProject = {
        id: `p-${Date.now()}`,
        name,
        color: color ?? "#6b7280",
        createdAt: Date.now(),
      };
      setProjects((prev) => [...prev, project]);
      return project;
    },
    [setProjects],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [setProjects],
  );

  const assignSessionToProject = useCallback(
    async (_sessionId: string, _projectId: string | null) => {},
    [],
  );

  const refreshProjects = useCallback(async () => {}, []);

  return {
    projects,
    isLoading,
    createProject,
    deleteProject,
    assignSessionToProject,
    refreshProjects,
  };
}
