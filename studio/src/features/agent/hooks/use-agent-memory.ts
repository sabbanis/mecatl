"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHarnessUserModel, probeHarness } from "@/lib/harness/client";
import { MOCK_MEMORY_ENTRIES } from "../mock-data";
import type { MemoryEntry } from "../types";

/**
 * Agent memory for the current operator.
 *
 * Backed by a local mecatl daemon's user model when one answers — durable facts
 * the agent stored about you, shared across every project — and by mock entries
 * otherwise, which is the deployed case.
 *
 * `canWrite` is false against a live harness: the daemon exposes no write
 * endpoint for the user model, because the agent curates it through
 * injection-scanned tool calls. A value typed by hand would land in the model's
 * turn-0 context without passing that check, so the UI must not offer editing.
 */
export function useAgentMemory() {
  const [entries, setEntries] = useState<MemoryEntry[]>(MOCK_MEMORY_ENTRIES);
  const [isLoading, setIsLoading] = useState(false);
  const [harnessLive, setHarnessLive] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const probe = await probeHarness(signal);
    if (signal?.aborted || !probe.live) return;
    setIsLoading(true);
    try {
      const facts = await fetchHarnessUserModel(signal);
      if (signal?.aborted) return;
      setHarnessLive(true);
      setEntries(
        facts.map((fact) => ({
          id: fact.key,
          title: fact.key,
          content: fact.description,
          section: "user model",
          updatedAt: Date.now(),
        })),
      );
    } catch {
      // Leave the mock entries in place: a reachable daemon with an unreadable
      // store is still better served by the demo content than by an empty panel.
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Re-reads the store; the agent may have written facts since the last read. */
  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const writeMemory = useCallback(
    async (section: string, content: string) => {
      if (harnessLive) return;
      setEntries((prev) =>
        prev.map((e) =>
          e.section === section ? { ...e, content, updatedAt: Date.now() } : e,
        ),
      );
    },
    [harnessLive],
  );

  return {
    entries,
    isLoading,
    writeMemory,
    refresh,
    isSupported: true,
    harnessLive,
    canWrite: !harnessLive,
  };
}
