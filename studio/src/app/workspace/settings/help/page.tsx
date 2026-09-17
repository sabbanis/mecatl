"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { AboutDaemonCard } from "../_components/about-daemon-card";
import { AboutStudioCard } from "../_components/about-studio-card";
import { ConfigReferenceCard } from "../_components/config-reference-card";

/**
 * Settings → Help & about: the help entry point mecatui spreads over
 * `--version`, `--help-flags` and its docs pointer. Studio's own version
 * and SDK version with links to the documentation, the source and the
 * keyboard shortcuts reference; the daemon's safe identity (the same About
 * card as Provider and Diagnostics, so a bug report is one page); and the
 * in-app reference of Studio's configuration surface with what this
 * deployment has set — names only, never values.
 */
export default function HelpSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <AboutStudioCard />
      <AboutDaemonCard
        selectedProviderId={runtime.status?.selectedProvider ?? undefined}
      />
      <ConfigReferenceCard />
    </>
  );
}
