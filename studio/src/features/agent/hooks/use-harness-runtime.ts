"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectHarnessGateway,
  fetchHarnessControlStatus,
  fetchHarnessRouter,
  type HarnessControlStatus,
  type HarnessRouterCategory,
  type HarnessRouterConfig,
  listHarnessModels,
  listHarnessSkills,
  probeHarness,
  saveHarnessProviderKey,
  saveHarnessRouter,
  startHarnessGatewayOAuth,
  waitForHarnessGateway,
} from "@/lib/harness/client";

export interface HarnessSkill {
  name: string;
  description: string;
}

export interface HarnessModel {
  id: string;
  providerId: string;
  displayName: string;
}

/**
 * The runtime configuration behind the agent: which provider serves it, how
 * prompts are routed across models, which MCP gateway its tools come from, and
 * which skills it can load.
 *
 * Two backends, deliberately kept distinct because they fail differently:
 * the DAEMON (read-only inventories — skills, models) and the CONTROLLER
 * (config writes, each of which restarts the daemon and drops in-flight runs).
 */
export function useHarnessRuntime() {
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<HarnessControlStatus | null>(null);
  const [router, setRouter] = useState<HarnessRouterConfig | null>(null);
  const [skills, setSkills] = useState<HarnessSkill[]>([]);
  const [models, setModels] = useState<HarnessModel[]>([]);
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
      // Independent reads, so they go out together rather than in a waterfall.
      const [nextStatus, nextRouter, nextSkills, nextModels] =
        await Promise.all([
          fetchHarnessControlStatus(signal),
          fetchHarnessRouter(signal).catch(() => null),
          listHarnessSkills(signal).catch(() => []),
          listHarnessModels(signal).catch(() => []),
        ]);
      if (signal?.aborted) return;
      setStatus(nextStatus);
      setRouter(nextRouter);
      setSkills(nextSkills);
      setModels(nextModels);
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

  /** Wraps a config write: one at a time, always followed by a re-read. */
  const runWrite = useCallback(
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

  const saveProviderKey = useCallback(
    async (apiKey: string) =>
      runWrite(
        "provider",
        () => saveHarnessProviderKey(apiKey),
        "Provider connected. The daemon restarted with the new credential.",
      ),
    [runWrite],
  );

  /** Connects the fixed connector gateway; only the credential varies. */
  const connectGateway = useCallback(
    async (token?: string) =>
      runWrite(
        "gateway",
        () => connectHarnessGateway(token),
        "MCP gateway connected. Its tools are now in the agent's catalog.",
      ),
    [runWrite],
  );

  /**
   * Runs the gateway's OAuth flow. `openWindow` is called synchronously by the
   * caller before any await, because a popup opened after an await is blocked.
   */
  const connectGatewayOAuth = useCallback(
    async (popup: {
      setUrl: (url: string) => void;
      isClosed: () => boolean;
    }) => {
      setBusy("gateway");
      setError(null);
      setNotice(null);
      try {
        popup.setUrl(await startHarnessGatewayOAuth());
        const connected = await waitForHarnessGateway(popup.isClosed);
        await load();
        setNotice(
          connected
            ? "Gateway connected. Its tools are now in the agent's catalog."
            : "Sign-in did not complete — no gateway was connected.",
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy("");
      }
    },
    [load],
  );

  const saveRouter = useCallback(
    async (config: {
      enabled: boolean;
      classifierModel: string;
      defaultCategory: string;
      categories: HarnessRouterCategory[];
    }) =>
      runWrite(
        "router",
        () => saveHarnessRouter(config),
        "Routing saved. The daemon restarted with the new tiers.",
      ),
    [runWrite],
  );

  return {
    live,
    status,
    router,
    skills,
    models,
    isLoading,
    busy,
    error,
    notice,
    refresh,
    saveProviderKey,
    connectGateway,
    connectGatewayOAuth,
    saveRouter,
  };
}
