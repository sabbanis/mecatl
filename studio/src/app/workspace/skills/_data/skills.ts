/**
 * TEMPORARY compile shim.
 *
 * The prototype's inline SKILL.md fixtures were excluded at import:
 * Studio is daemon-only. These empty exports keep the Skills pages
 * compiling until they are wired to the daemon's GET /v1/skills
 * inventory, which deletes this file.
 */
import type { LucideIcon } from "lucide-react";

export interface SkillEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  author: string;
  icon: LucideIcon;
  /** True when the running agent already has this skill in its inventory. */
  loaded: boolean;
  /** The SKILL.md the agent loads once it chooses this skill. */
  content: string;
}

export const SKILLS: SkillEntry[] = [];

export function getSkillById(id: string): SkillEntry | undefined {
  return SKILLS.find((skill) => skill.id === id);
}
