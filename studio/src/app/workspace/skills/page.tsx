"use client";

import { BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentSkills } from "@/features/agent/hooks/use-agent-skills";
import type { HarnessSkillInfo } from "@/lib/harness/client";
import { pageTitleClass } from "@/lib/typography";

/** "pr-feedback" → "Pr Feedback"; the raw slug stays the id/route param. */
function humanizeSkillName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function WorkspaceSkillsPage() {
  const { skills, isLoading, error } = useAgentSkills();

  const sorted = useMemo(
    () => [...skills].sort((a, b) => a.name.localeCompare(b.name)),
    [skills],
  );

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <h1 className={pageTitleClass("truncate pb-0 text-3xl leading-tight")}>
          Skills
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {["a", "b", "c"].map((key) => (
              <Skeleton key={key} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No skills here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Drop a <code className="font-mono text-xs">SKILL.md</code> into{" "}
                <code className="font-mono text-xs">.mecatl/skills</code> and
                it'll show up here, ready for the agent to use.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {sorted.map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skill card, mirroring the connector catalog card: icon, humanized name, the
 * raw slug, provenance badge, and the one-line summary the model sees.
 */
function SkillCard({ skill }: { skill: HarnessSkillInfo }) {
  const Icon = skill.agentOwned ? Sparkles : BookOpen;

  return (
    <Link
      href={`/workspace/skills/${encodeURIComponent(skill.name)}`}
      className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Icon className="size-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">
              {humanizeSkillName(skill.name)}
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {skill.name}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {skill.agentOwned ? (
            <Badge variant="info">
              <Sparkles />
              Learned
            </Badge>
          ) : (
            <Badge variant="muted">Workspace</Badge>
          )}
        </div>
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">
        {skill.description}
      </p>
    </Link>
  );
}
