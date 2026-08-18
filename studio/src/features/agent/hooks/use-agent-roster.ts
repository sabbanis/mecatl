"use client";

import { useEffect, useState } from "react";
import { listHarnessAgents } from "@/lib/harness/client";
import { useRuntimeStatus } from "../runtime-status";

/** One row of the daemon's resolved agent inventory (`GET /v1/agents`). */
export interface RosterAgent {
  name: string;
  description: string;
}

/**
 * The daemon's real agent roster, read-only. Gated on the runtime being
 * connected; an unreachable daemon yields an empty roster, never demo data.
 */
export function useAgentRoster() {
  const { connected } = useRuntimeStatus();
  const [agents, setAgents] = useState<RosterAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    setIsLoading(true);
    listHarnessAgents(controller.signal)
      .then((roster) => {
        if (!controller.signal.aborted) setAgents(roster);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAgents([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [connected]);

  return { agents, isLoading: isLoading && connected };
}
