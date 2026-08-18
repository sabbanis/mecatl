"use client";

import { useCallback } from "react";
import type { AgentProject } from "../types";

/**
 * The daemon has no project concept, so the workspace has no project
 * grouping: the chat sidebar is a flat, recency-ordered session list. This
 * placeholder keeps the workspace's shape until the grouping UI is removed
 * with the sidebar rework — the list is always empty, creation returns a
 * transient handle that is never stored, and assignment is a no-op.
 */
export function useAgentProjects() {
  const createProject = useCallback(async (name: string) => {
    const project: AgentProject = {
      id: `project-${Date.now()}`,
      name,
      color: "gray",
      createdAt: Date.now(),
    };
    return project;
  }, []);

  const deleteProject = useCallback(async (_id: string) => {}, []);
  const assignSessionToProject = useCallback(
    async (_sessionId: string, _projectId: string | null) => {},
    [],
  );
  const refreshProjects = useCallback(async () => {}, []);

  return {
    projects: [] as AgentProject[],
    isLoading: false,
    error: null as string | null,
    createProject,
    deleteProject,
    assignSessionToProject,
    refreshProjects,
  };
}
