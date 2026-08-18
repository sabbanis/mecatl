"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteHarnessAgent,
  fetchHarnessAgentFiles,
  type HarnessAgentFile,
  listHarnessAgents,
  probeHarness,
  reloadHarnessDaemon,
  saveHarnessAgent,
} from "@/lib/harness/client";

export interface ManagedAgent extends HarnessAgentFile {
  /**
   * True when the RUNNING daemon can delegate to this definition. The daemon
   * resolves definitions once at startup, and project-scoped definitions are
   * additionally trust-gated, so on-disk does not imply usable.
   */
  loaded: boolean;
}

/**
 * Agent-definition authoring against a local mecatl daemon.
 *
 * Reconciles the files on disk (editable) with the daemon's resolved inventory
 * (what it can actually delegate to), so the UI can distinguish "written" from
 * "in use" instead of implying a write took effect.
 */
export function useAgentDefs() {
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [dir, setDir] = useState("");
  const [live, setLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const liveRef = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const probe = await probeHarness(signal);
    if (signal?.aborted) return;
    liveRef.current = probe.live;
    setLive(probe.live);
    if (!probe.live) return;
    setIsLoading(true);
    try {
      const [files, resolved] = await Promise.all([
        fetchHarnessAgentFiles(signal).catch(() => ({ dir: "", agents: [] })),
        listHarnessAgents(signal).catch(() => []),
      ]);
      if (signal?.aborted) return;
      const loadedNames = new Set(resolved.map((agent) => agent.name));
      setDir(files.dir);
      setAgents(
        files.agents.map((file) => ({
          ...file,
          loaded: loadedNames.has(file.name),
        })),
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const run = useCallback(
    async (label: string, work: () => Promise<void>, done: string) => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        await work();
        await load();
        setNotice(done);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy("");
      }
    },
    [load],
  );

  const saveAgent = useCallback(
    async (agent: {
      name: string;
      description: string;
      model: string;
      body: string;
    }) =>
      run(
        `save:${agent.name}`,
        () => saveHarnessAgent(agent),
        `Saved ${agent.name}. Reload the agent to make it delegatable.`,
      ),
    [run],
  );

  const removeAgent = useCallback(
    async (name: string) =>
      run(
        `delete:${name}`,
        () => deleteHarnessAgent(name),
        `Deleted ${name}. Reload to drop it from the daemon's inventory.`,
      ),
    [run],
  );

  const reloadAgent = useCallback(
    async () =>
      run(
        "reload",
        () => reloadHarnessDaemon(),
        "Daemon reloaded with the current definitions.",
      ),
    [run],
  );

  // Only OUR definitions count as pending: a .claude/agents file the daemon has
  // not resolved is usually trust-gated, not stale, and a reload will not change
  // that — promising otherwise via the reload button would be a lie.
  const pendingCount = agents.filter(
    (agent) => agent.writable && !agent.loaded,
  ).length;
  /** Read-only definitions the running daemon has not resolved (trust-gated). */
  const unresolvedSharedCount = agents.filter(
    (agent) => !agent.writable && !agent.loaded,
  ).length;

  return {
    agents,
    dir,
    live,
    isLoading,
    busy,
    error,
    notice,
    pendingCount,
    unresolvedSharedCount,
    refresh,
    saveAgent,
    removeAgent,
    reloadAgent,
  };
}
