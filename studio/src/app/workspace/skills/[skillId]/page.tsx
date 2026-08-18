"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentSkills } from "@/features/agent/hooks/use-agent-skills";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";

/** "pr-feedback" → "Pr Feedback"; the raw slug stays the id/route param. */
function humanizeSkillName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SkillDetailPage() {
  const router = useRouter();
  const params = useParams<{ skillId: string }>();
  const name = decodeURIComponent(params.skillId);
  const { skills, isLoading, error } = useAgentSkills();
  const skill = skills.find((s) => s.name === name);

  const back = (
    <Button
      variant="outline"
      size="sm"
      className="w-fit self-start rounded-full h-9 px-4 gap-1"
      onClick={() => router.back()}
    >
      <span aria-hidden="true">‹</span>
      Back
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
        {back}
        <Skeleton className="h-12 w-72 rounded-lg" />
        <Skeleton className="h-24 max-w-[465px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
        {back}
        <div className="rounded-lg border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
        {back}
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No skill named <code className="font-mono text-xs">{name}</code> in
          the daemon&apos;s inventory.
        </div>
      </div>
    );
  }

  const Icon = skill.agentOwned ? Sparkles : BookOpen;

  return (
    <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
      {back}

      {/* Title + metadata pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon className="size-6 text-foreground" />
          </div>
          <h1 className={pageTitleClass("text-[44px] leading-[1.05]")}>
            {humanizeSkillName(skill.name)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill className="font-mono">{skill.name}</MetaPill>
          {skill.agentOwned ? (
            <>
              <Badge variant="info">
                <Sparkles />
                Learned
              </Badge>
              {skill.ownerAgent ? (
                <MetaPill>by {skill.ownerAgent}</MetaPill>
              ) : null}
              {skill.activeVersion ? (
                <MetaPill className="font-mono">{skill.activeVersion}</MetaPill>
              ) : null}
            </>
          ) : (
            <Badge variant="muted">Workspace</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <aside className="flex w-full max-w-[465px] flex-col gap-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Summary</h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {skill.description}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-base font-semibold">SKILL.md</h2>
          <div className="rounded-lg border bg-background p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The daemon&apos;s inventory is metadata-only; the agent reads a
              skill&apos;s body only when it loads it.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetaPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
