"use client";

import { useEffect, useState } from "react";
import { listHarnessAgents } from "@/lib/harness/client";
import { useRuntimeStatus } from "../runtime-status";
import type { AgentRoster } from "../types";

/**
 * The daemon's RESOLVED subagent inventory (`GET /v1/agents`): the
 * definitions the running agent can actually delegate to now. An empty
 * inventory renders empty — Studio is daemon-only.
 */
export function useAgentRoster(): { agents: AgentRoster[] } {
  const { connected } = useRuntimeStatus();
  const [agents, setAgents] = useState<AgentRoster[]>([]);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const inventory = await listHarnessAgents(controller.signal);
        if (controller.signal.aborted) return;
        setAgents(
          inventory.map((agent) => ({
            id: agent.name,
            name: agent.name,
            description: agent.description,
            enabled: true,
          })),
        );
      } catch {
        // The runtime-status banner owns connectivity errors; an unreadable
        // roster just stays empty.
      }
    })();
    return () => controller.abort();
  }, [connected]);

  return { agents };
}
