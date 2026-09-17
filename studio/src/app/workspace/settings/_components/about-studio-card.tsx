"use client";

import { BookOpen, ExternalLink, Keyboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { studioBuild } from "@/lib/studio-build";
import { sdkVersion, studioVersion } from "@/lib/studio-version";
import { SHORTCUTS_PAGE_HREF } from "@/lib/workspace-pages";
import { SettingsCard } from "./settings-card";

/** The public documentation site. */
const DOCS_URL = "https://mecatl.dev/docs/";
/** The repository: source, issues, releases. */
const SOURCE_URL = "https://github.com/stacklok/mecatl";

const ROWS: readonly { label: string; value: () => string; testId: string }[] =
  [
    {
      label: "Studio version",
      value: studioVersion,
      testId: "about-studio-version",
    },
    { label: "Build", value: studioBuild, testId: "about-studio-build-stamp" },
    { label: "SDK version", value: sdkVersion, testId: "about-sdk-version" },
  ];

/**
 * Studio's OWN identity and the help entry points — the web analogue of
 * `mecatui --version` plus the docs pointer its `--help` ends with. The
 * three rows are build-time facts inlined at `next build` (studio-version.ts,
 * studio-build.ts), so the card is complete before any daemon call; the
 * daemon's half lives in the About card beneath it on the Help page.
 *
 * The links: the documentation site and the repository (both external, in a
 * new tab), and the in-app keyboard shortcuts reference — the page that was
 * otherwise reachable only by keystroke.
 */
export function AboutStudioCard() {
  return (
    <SettingsCard
      title="About Studio"
      description="This web client's version, and where to read more or report a problem."
    >
      <div className="flex flex-col gap-3">
        <div className="divide-y rounded-lg border bg-background">
          {ROWS.map(({ label, value, testId }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm">{label}</span>
              <span
                className="break-all text-right font-mono text-sm text-muted-foreground"
                data-testid={testId}
              >
                {value()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              <BookOpen className="size-4" />
              Documentation
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              Source &amp; issues
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={SHORTCUTS_PAGE_HREF}>
              <Keyboard className="size-4" />
              Keyboard shortcuts
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Documentation and the repository open in a new tab. The daemon's own
          identity is in the About card below.
        </p>
      </div>
    </SettingsCard>
  );
}
