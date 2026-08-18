"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteHarnessSkill,
  fetchHarnessSkillFiles,
  type HarnessSkillFile,
  listHarnessSkills,
  probeHarness,
  reloadHarnessDaemon,
  saveHarnessSkill,
} from "@/lib/harness/client";

export interface ManagedSkill extends HarnessSkillFile {
  /**
   * True when the RUNNING daemon has this skill in its inventory. The daemon
   * resolves skills once at startup, so a skill written since then exists on
   * disk with loaded=false until a reload — the agent genuinely cannot use it
   * yet, and the UI must not imply otherwise.
   */
  loaded: boolean;
}

/**
 * Skill authoring against a local mecatl daemon.
 *
 * Reads two sources and reconciles them: the files on disk (editable) and the
 * daemon's resolved inventory (what the agent can actually load).
 */
export function useAgentSkills() {
  const [skills, setSkills] = useState<ManagedSkill[]>([]);
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
      const [files, loaded] = await Promise.all([
        fetchHarnessSkillFiles(signal).catch(() => ({ dir: "", skills: [] })),
        listHarnessSkills(signal).catch(() => []),
      ]);
      if (signal?.aborted) return;
      const loadedNames = new Set(loaded.map((skill) => skill.name));
      setDir(files.dir);
      setSkills(
        files.skills.map((file) => ({
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

  const saveSkill = useCallback(
    async (skill: HarnessSkillFile) =>
      run(
        `save:${skill.name}`,
        () => saveHarnessSkill(skill),
        `Saved ${skill.name}. Reload the agent to make it loadable.`,
      ),
    [run],
  );

  const removeSkill = useCallback(
    async (name: string) =>
      run(
        `delete:${name}`,
        () => deleteHarnessSkill(name),
        `Deleted ${name}. Reload the agent to drop it from its inventory.`,
      ),
    [run],
  );

  const reloadAgent = useCallback(
    async () =>
      run(
        "reload",
        () => reloadHarnessDaemon(),
        "Agent reloaded with the current skills.",
      ),
    [run],
  );

  /** Skills whose on-disk state the running agent has not picked up yet. */
  const pendingCount = skills.filter((skill) => !skill.loaded).length;

  return {
    skills,
    dir,
    live,
    isLoading,
    busy,
    error,
    notice,
    pendingCount,
    refresh,
    saveSkill,
    removeSkill,
    reloadAgent,
  };
}
