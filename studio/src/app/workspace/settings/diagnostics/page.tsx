"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { AboutDaemonCard } from "../_components/about-daemon-card";
import { DaemonLogCard } from "../_components/daemon-log-card";
import { PerformanceCard } from "../_components/performance-card";
import { PostureCard } from "../_components/posture-card";
import {
  DAEMON_LOG_ANCHOR_ID,
  ProductMetricsCard,
} from "../_components/product-metrics-card";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

/**
 * Settings → Diagnostics: what THIS daemon is and how it is running — the
 * operator posture it reports (with the four defenses that tier switches
 * on) and its safe identity. Read-mostly by design: the posture is changed
 * on the Permissions page, and the observability knobs the controller owns
 * (log level, admin listener, product metrics — `useDiagnosticsOptions`)
 * get their cards here as they land.
 */
export default function DiagnosticsSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <PostureCard />
      <ProductMetricsCard />
      {/* The product-metrics dry run prints to mecated's stderr, which this
          card shows: the anchor is the card's "Daemon log below" link. */}
      <div id={DAEMON_LOG_ANCHOR_ID} className="scroll-mt-4">
        <DaemonLogCard />
      </div>
      <PerformanceCard />
      <AboutDaemonCard
        selectedProviderId={runtime.status?.selectedProvider ?? undefined}
      />
    </>
  );
}
