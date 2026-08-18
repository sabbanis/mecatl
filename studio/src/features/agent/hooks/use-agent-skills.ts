"use client";

import { useCallback, useEffect, useState } from "react";
import { type HarnessSkillInfo, listHarnessSkills } from "@/lib/harness/client";
import { useRuntimeStatus } from "../runtime-status";

/**
 * The daemon's resolved skill inventory (`GET /v1/skills`) — the skills the
 * running agent can actually load, read-only.
 *
 * The inventory is metadata-only by design: the model sees each skill's name
 * and one-line summary until it chooses to load one, and the client tier has
 * no body-read endpoint for external skills. Authoring (and body reads via
 * the controller) is a deliberate follow-up.
 */
export function useAgentSkills() {
  const { connected } = useRuntimeStatus();
  const [skills, setSkills] = useState<HarnessSkillInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const inventory = await listHarnessSkills(signal);
      if (signal?.aborted) return;
      setSkills(inventory);
      setError(null);
    } catch (caught) {
      if (signal?.aborted) return;
      setSkills([]);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [connected, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    skills,
    isLoading: isLoading && connected,
    error,
    refresh,
  };
}
