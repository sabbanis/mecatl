"use client";

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createHarnessSchedule,
  harnessScheduleAction,
  listHarnessSchedules,
  probeHarness,
} from "@/lib/harness/client";
import { MOCK_CRON_JOBS } from "../mock-data";
import type { CreateCronOpts, CronJob } from "../types";

/** Fields the create-schedule form supplies on top of the shared opts. */
export type CreateJobInput = CreateCronOpts & { enabled?: boolean };

/** Module mirror so newly created jobs survive the workspace remount on
 * navigation (same pattern as use-agent-projects). Resets on a full reload. */
let cronStore: CronJob[] | null = null;

/** Monotonic counter for client-side job ids — stable within a session and
 * collision-free even after deletes, without reading the clock or RNG. */
let cronSeq = 0;

/** Slugify a job name into an id-safe fragment. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "job"
  );
}

/**
 * Scheduled agent runs.
 *
 * Backed by a local mecatl daemon's schedule registry when one answers, mock
 * jobs otherwise. A live schedule fires an agent run unattended, so this hook
 * reads the daemon's durable state back after every action rather than
 * predicting what an action produced.
 */
export function useAgentCron() {
  const [jobs, setJobsState] = useState<CronJob[]>(
    () => cronStore ?? MOCK_CRON_JOBS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [harnessLive, setHarnessLive] = useState(false);
  const liveRef = useRef(false);

  /** Mirror every job update into the module store so it outlives remounts. */
  const setJobs = useCallback((action: SetStateAction<CronJob[]>) => {
    setJobsState((prev) => {
      const next =
        typeof action === "function"
          ? (action as (p: CronJob[]) => CronJob[])(prev)
          : action;
      cronStore = next;
      return next;
    });
  }, []);

  const loadFromHarness = useCallback(
    async (signal?: AbortSignal) => {
      const schedules = await listHarnessSchedules(signal);
      if (signal?.aborted) return;
      setJobs(
        schedules.map((schedule) => ({
          id: schedule.name,
          name: schedule.name,
          schedule: schedule.cron || "one-shot",
          instruction: schedule.prompt,
          enabled: schedule.enabled,
          status: schedule.live ? ("running" as const) : ("idle" as const),
          lastRunAt: schedule.lastFireAt,
          output:
            schedule.fireCount > 0
              ? `${schedule.fireCount} fire${schedule.fireCount === 1 ? "" : "s"} so far`
              : null,
          lastRunSessionId: schedule.lastFireSessionId || undefined,
        })),
      );
    },
    [setJobs],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const probe = await probeHarness(controller.signal);
      if (controller.signal.aborted || !probe.live) return;
      setIsLoading(true);
      try {
        await loadFromHarness(controller.signal);
        if (controller.signal.aborted) return;
        liveRef.current = true;
        setHarnessLive(true);
      } catch {
        // A daemon with no ScheduleStore answers with an error rather than an
        // empty list; keep the mock jobs instead of showing a bare panel.
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [loadFromHarness]);

  const refresh = useCallback(async () => {
    if (!liveRef.current) return;
    await loadFromHarness();
  }, [loadFromHarness]);

  const createJob = useCallback(
    async (opts: CreateJobInput) => {
      cronSeq += 1;
      const job: CronJob = {
        id: liveRef.current
          ? opts.name
          : `cron-${cronSeq}-${slugify(opts.name)}`,
        name: opts.name,
        schedule: opts.schedule,
        instruction: opts.instruction,
        enabled: opts.enabled ?? true,
        status: "idle",
        lastRunAt: null,
        output: null,
      };
      if (liveRef.current) {
        await createHarnessSchedule(opts.name, opts.schedule, opts.instruction);
        await loadFromHarness();
        return job;
      }
      // Newest first so a freshly created task lands at the top of the list.
      setJobs((prev) => [job, ...prev]);
      return job;
    },
    [loadFromHarness, setJobs],
  );

  const runJob = useCallback(
    async (jobId: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: "running" as const } : j,
        ),
      );
      if (liveRef.current) {
        // FireNow is synchronous on the harness: this await lasts the whole run.
        await harnessScheduleAction(jobId, "fire");
        await loadFromHarness();
        return;
      }
      setTimeout(() => {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "idle" as const,
                  lastRunAt: Date.now(),
                  output: "Job completed successfully (demo).",
                }
              : j,
          ),
        );
      }, 2000);
    },
    [loadFromHarness, setJobs],
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      if (liveRef.current) {
        await harnessScheduleAction(jobId, "delete");
        await loadFromHarness();
        return;
      }
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    },
    [loadFromHarness, setJobs],
  );

  const setEnabled = useCallback(
    async (jobId: string, enabled: boolean) => {
      if (liveRef.current) {
        await harnessScheduleAction(jobId, enabled ? "resume" : "pause");
        await loadFromHarness();
        return;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, enabled } : j)),
      );
    },
    [loadFromHarness, setJobs],
  );

  const pauseJob = useCallback(
    async (jobId: string) => setEnabled(jobId, false),
    [setEnabled],
  );
  const resumeJob = useCallback(
    async (jobId: string) => setEnabled(jobId, true),
    [setEnabled],
  );

  return {
    jobs,
    isLoading,
    isSupported: true,
    harnessLive,
    createJob,
    runJob,
    deleteJob,
    pauseJob,
    resumeJob,
    refresh,
  };
}
