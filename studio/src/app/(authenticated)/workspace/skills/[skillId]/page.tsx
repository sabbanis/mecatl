"use client";

import { Check } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { getSkillById } from "../_data/skills";

export default function SkillDetailPage() {
  const router = useRouter();
  const params = useParams<{ skillId: string }>();
  const skill = getSkillById(params.skillId);
  const [loaded, setLoaded] = useState(skill?.loaded ?? false);

  if (!skill) return notFound();
  const Icon = skill.icon;

  return (
    <div className="space-y-5 px-4 pt-6 pb-8 min-[500px]:px-8">
      <Button
        variant="outline"
        size="sm"
        className="w-fit self-start rounded-full h-9 px-4 gap-1"
        onClick={() => router.back()}
      >
        <span aria-hidden="true">‹</span>
        Back
      </Button>

      {/* Title + metadata pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon className="size-6 text-foreground" />
          </div>
          <h1 className={pageTitleClass("text-[44px] leading-[1.05]")}>
            {skill.displayName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill className="font-mono">{skill.name}</MetaPill>
          <MetaPill>{skill.author}</MetaPill>
          <MetaPill>{loaded ? "Enabled" : "Available"}</MetaPill>
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
          <div className="pt-2">
            {loaded ? (
              <Button
                variant="outline"
                className="rounded-full h-11 px-6 gap-2 text-success border-success/30 hover:bg-success/10 hover:text-success"
                onClick={() => setLoaded(false)}
              >
                <Check className="size-4" />
                Enabled
              </Button>
            ) : (
              <Button
                variant="action"
                className="h-11 px-6"
                onClick={() => setLoaded(true)}
              >
                Enable for agent
              </Button>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-base font-semibold">SKILL.md</h2>
          <div className="rounded-lg border bg-background p-6">
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-[21px] text-muted-foreground">
              {skill.content}
            </pre>
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
