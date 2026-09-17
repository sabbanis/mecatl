"use client";

import { Copy, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDiagnosticsReport } from "@/features/agent/hooks/use-diagnostics-report";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { copyToClipboard } from "@/lib/clipboard";
import {
  type HarnessServerInfoProbe,
  probeHarnessServerInfo,
} from "@/lib/harness/server-info";
import { stashPendingDraft } from "@/lib/pending-draft";
import { knownPostureTier } from "@/lib/posture";
import { studioBuild } from "@/lib/studio-build";
import { SettingsCard } from "./settings-card";

/** How the daemon-identity half of the card stands: the probe's lookup
 *  class, or the two states before/without a probe. */
export type AboutLookup =
  | HarnessServerInfoProbe["lookup"]
  | "loading"
  | "offline";

/** The `Server identity` row when the daemon rows cannot be shown — one
 *  plain sentence per lookup class, so the card is never blank. */
function serverIdentityText(lookup: AboutLookup): string {
  switch (lookup) {
    case "ok":
      return "ok";
    case "loading":
      return "loading…";
    case "offline":
      return "unavailable — the daemon is offline";
    case "not-supported":
      return "unavailable on this daemon (GET /v1/info not supported)";
    case "unreachable":
      return "unavailable — the daemon did not answer";
    case "invalid-response":
      return "unavailable — the daemon answered, but not with its identity";
  }
}

export const HANDOFF_FAILED =
  "Couldn't hand the report to a new chat — copy it instead";

interface AboutRow {
  label: string;
  value: string;
  testId?: string;
}

/**
 * Studio's own identity next to the daemon's safe identity (ADR 0245) — the
 * payload a bug report wants, and the web analogue of `mecatui --version`
 * plus the TUI's `/diagnostics`.
 *
 * Always rendered: the Studio build stamp, the managed/external server
 * mode, then EITHER the daemon rows (opaque build id, composition family,
 * the sanitized endpoint of the selected provider) OR one `Server identity`
 * row naming why they are missing (an older daemon without GET /v1/info, an
 * unreachable one, an invalid answer, offline), then the operator's
 * deployment label and the daemon-reported effective posture.
 *
 * Two actions: copy the rows, or hand the full sanitized `/diagnostics`
 * report to a NEW chat's composer (the user still presses Enter).
 */
export function AboutDaemonCard({
  selectedProviderId,
}: {
  /** Names the provider whose sanitized endpoint the probe should project. */
  selectedProviderId?: string;
}) {
  const router = useRouter();
  const { state, mode, deployment, serverCapabilities } = useRuntimeStatus();
  const connected = state === "connected";
  const { compose } = useDiagnosticsReport();
  const [probe, setProbe] = useState<HarnessServerInfoProbe | null>(null);
  const [handingOff, setHandingOff] = useState(false);

  useEffect(() => {
    if (!connected) {
      setProbe(null);
      return;
    }
    const controller = new AbortController();
    void probeHarnessServerInfo(selectedProviderId, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setProbe(result);
      },
    );
    return () => controller.abort();
  }, [connected, selectedProviderId]);

  const lookup: AboutLookup =
    state === "offline" ? "offline" : (probe?.lookup ?? "loading");
  const info = lookup === "ok" ? probe?.info : null;

  const reportedPosture = serverCapabilities.posture;
  const posture =
    knownPostureTier(reportedPosture) ??
    (typeof reportedPosture === "string" && reportedPosture.trim()
      ? reportedPosture.trim()
      : "not reported");

  const rows: AboutRow[] = [
    { label: "Studio", value: studioBuild(), testId: "about-studio-build" },
    { label: "Server mode", value: mode, testId: "about-server-mode" },
  ];
  if (info) {
    rows.push({
      label: "Build",
      value: info.buildId || "unavailable",
      testId: "about-server-build",
    });
    rows.push({
      label: "Implementation",
      value: info.serverImplementation || "unavailable",
      testId: "about-server-implementation",
    });
    if (info.providerEndpoint) {
      rows.push({ label: "Provider endpoint", value: info.providerEndpoint });
    }
  } else {
    rows.push({
      label: "Server identity",
      value: serverIdentityText(lookup),
      testId: "about-server-identity",
    });
  }
  rows.push({ label: "Deployment", value: deployment || "not set" });
  rows.push({ label: "Posture", value: posture, testId: "about-posture" });

  const debugBlob = rows.map((row) => `${row.label}: ${row.value}`).join("\n");

  const sendToNewChat = async () => {
    setHandingOff(true);
    try {
      // The card's own probe is the report's server half when it has one;
      // otherwise compose probes (a still-loading card reads its class).
      const report = await compose({ server: probe ?? undefined });
      if (!stashPendingDraft(report)) {
        toast.error(HANDOFF_FAILED);
        return;
      }
      router.push("/workspace/chat");
    } finally {
      setHandingOff(false);
    }
  };

  return (
    <SettingsCard
      title="About"
      description="Studio's build and the daemon's safe identity — what a bug report needs."
    >
      <div className="flex flex-col gap-3">
        <div className="divide-y rounded-lg border bg-background">
          {rows.map(({ label, value, testId }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm">{label}</span>
              <span
                className="break-all text-right font-mono text-sm text-muted-foreground"
                data-testid={testId}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void copyToClipboard(debugBlob, "Debug info")}
          >
            <Copy className="size-4" />
            Copy debug info
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={!connected || handingOff}
            onClick={() => void sendToNewChat()}
          >
            <MessageSquarePlus className="size-4" />
            Send to a new chat
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Send to a new chat opens a chat with the same sanitized report the{" "}
          <code>/diagnostics</code> command sends — review it in the composer,
          then press Enter.
        </p>
      </div>
    </SettingsCard>
  );
}
