"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionTabButtons } from "@/components/app/section-tabs";
import { Button } from "@/components/ui/button";
import { pageTitleClass } from "@/lib/typography";
import { SKILLS, type SkillEntry } from "./_data/skills";

/** Top-level segmented filter. */
type SectionFilter = "all" | "loaded";

const SECTION_TABS: { key: SectionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "loaded", label: "Enabled" },
];

export default function WorkspaceSkillsPage() {
  const [section, setSection] = useState<SectionFilter>("all");
  const [loaded, setLoaded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SKILLS.map((s) => [s.id, s.loaded])),
  );

  const isLoaded = (id: string) => loaded[id] ?? false;
  const toggleLoaded = (id: string) =>
    setLoaded((prev) => ({ ...prev, [id]: !prev[id] }));

  const loadedCount = useMemo(
    () => SKILLS.filter((s) => loaded[s.id]).length,
    [loaded],
  );

  const matches = useMemo(() => {
    let skills = SKILLS;
    if (section === "loaded") {
      skills = skills.filter((s) => loaded[s.id]);
    }
    return [...skills].sort((a, b) => {
      const ra = loaded[a.id] ? 0 : 1;
      const rb = loaded[b.id] ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [section, loaded]);

  // "All" splits into Enabled / Available; "Enabled" is a single flat grid.
  const groups = useMemo(() => {
    if (section === "loaded") {
      return [{ heading: null as string | null, skills: matches }];
    }
    const on = matches.filter((s) => loaded[s.id]);
    const off = matches.filter((s) => !loaded[s.id]);
    return [
      { heading: "Enabled", skills: on },
      { heading: "Available", skills: off },
    ].filter((g) => g.skills.length > 0);
  }, [section, matches, loaded]);

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1
            className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}
          >
            Skills
          </h1>
        </div>

        {/* Filter bar: All / Enabled pills. */}
        <div className="flex flex-wrap items-center gap-3">
          <SectionTabButtons
            items={SECTION_TABS.map((t) =>
              t.key === "loaded"
                ? { ...t, label: `Enabled (${loadedCount})` }
                : t,
            )}
            value={section}
            onValueChange={setSection}
          />
        </div>

        {matches.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No skills are enabled for the agent yet.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.heading ?? "all"} className="space-y-3">
                {group.heading ? (
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {group.heading}
                  </h2>
                ) : null}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      loaded={isLoaded(skill.id)}
                      onToggle={() => toggleLoaded(skill.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skill card, mirroring the connector catalog card: icon, name, author (or
 * "Enabled for agent"), description, and a single right-aligned affordance — an
 * Enabled badge when in the agent's inventory, else an Enable button.
 */
function SkillCard({
  skill,
  loaded,
  onToggle,
}: {
  skill: SkillEntry;
  loaded: boolean;
  onToggle: () => void;
}) {
  const Icon = skill.icon;
  const subLine = loaded ? "Enabled for agent" : skill.author;
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  return (
    <Link
      href={`/workspace/skills/${skill.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Icon className="size-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">
              {skill.displayName}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {subLine}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {loaded ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-success hover:bg-success/10 hover:text-success"
              onClick={stop}
            >
              <Check className="size-3" />
              Enabled
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={stop}
            >
              Enable
            </Button>
          )}
        </div>
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">
        {skill.description}
      </p>
    </Link>
  );
}
