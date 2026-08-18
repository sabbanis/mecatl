"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteHarnessRun,
  type HarnessInstance,
  launchHarnessRun,
  listHarnessInstances,
  probeHarness,
  streamHarnessRun,
} from "@/lib/harness/client";

export interface ActiveRun {
  teamId: string;
  name: string;
  agentType: string;
  goal: string;
  sessionId: string;
  /** Client-side lifecycle: the harness has no list-teams endpoint to poll. */
  status: "launching" | "running" | "done" | "error";
  lastEvent: string;
  eventCount: number;
  error?: string;
}

/**
 * Agent runs — actual instances executing in the harness, not definition files.
 *
 * mecatl runs a named definition as a team member (a member spec's `agent_type`
 * is the definition it adopts, and each member gets its own session), so a
 * one-member team is what "run this agent" means here.
 *
 * Two views, because they answer different questions:
 *  - `runs` — what this page launched, with live progress. Client-held: there is
 *    no list-teams endpoint, so a reload loses the handles (not the sessions).
 *  - `instances` — every run recorded in the session store, which survives
 *    reloads and covers scheduled fires and in-chat subagents too.
 */
export function useAgentRuns() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [instances, setInstances] = useState<HarnessInstance[]>([]);
  const [live, setLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborts = useRef(new Map<string, AbortController>());

  const load = useCallback(async (signal?: AbortSignal) => {
    const probe = await probeHarness(signal);
    if (signal?.aborted) return;
    setLive(probe.live);
    if (!probe.live) return;
    setIsLoading(true);
    try {
      const next = await listHarnessInstances(signal);
      if (signal?.aborted) return;
      setInstances(next);
    } catch (caught) {
      if (!signal?.aborted) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      for (const abort of aborts.current.values()) abort.abort();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const patch = useCallback((teamId: string, next: Partial<ActiveRun>) => {
    setRuns((prev) =>
      prev.map((run) => (run.teamId === teamId ? { ...run, ...next } : run)),
    );
  }, []);

  const launch = useCallback(
    async (input: {
      name: string;
      agentType?: string;
      goal: string;
      mutating?: boolean;
    }) => {
      setError(null);
      let created: Awaited<ReturnType<typeof launchHarnessRun>>;
      try {
        created = await launchHarnessRun(input);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return;
      }
      const run: ActiveRun = {
        teamId: created.teamId,
        name: input.name,
        agentType: input.agentType ?? "",
        goal: input.goal,
        sessionId: created.members[0]?.sessionId ?? "",
        status: "running",
        lastEvent: "launched",
        eventCount: 0,
      };
      setRuns((prev) => [run, ...prev]);

      const controller = new AbortController();
      aborts.current.set(created.teamId, controller);
      try {
        // The run streams for its whole duration; progress is surfaced as it
        // arrives rather than leaving the row looking stalled.
        await streamHarnessRun(
          created.teamId,
          (kind) =>
            setRuns((prev) =>
              prev.map((item) =>
                item.teamId === created.teamId
                  ? {
                      ...item,
                      lastEvent: kind,
                      eventCount: item.eventCount + 1,
                    }
                  : item,
              ),
            ),
          controller.signal,
        );
        patch(created.teamId, { status: "done", lastEvent: "outcome" });
      } catch (caught) {
        if (controller.signal.aborted) {
          patch(created.teamId, { status: "done", lastEvent: "cancelled" });
        } else {
          patch(created.teamId, {
            status: "error",
            error: caught instanceof Error ? caught.message : String(caught),
          });
        }
      } finally {
        aborts.current.delete(created.teamId);
        await load();
      }
    },
    [load, patch],
  );

  /** Stops following a run and releases it on the daemon. */
  const stop = useCallback(
    async (teamId: string) => {
      aborts.current.get(teamId)?.abort();
      await deleteHarnessRun(teamId);
      setRuns((prev) => prev.filter((run) => run.teamId !== teamId));
      await load();
    },
    [load],
  );

  return { runs, instances, live, isLoading, error, refresh, launch, stop };
}
