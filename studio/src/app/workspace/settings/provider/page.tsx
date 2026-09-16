"use client";

import { useDaemonDefaults } from "@/features/agent/hooks/use-daemon-defaults";
import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useProviderManagement } from "@/features/agent/hooks/use-provider-management";
import { useProviderStatus } from "@/features/agent/hooks/use-provider-status";
import { AboutDaemonCard } from "../_components/about-daemon-card";
import { DaemonDefaultsCard } from "../_components/daemon-defaults-card";
import { OidcLoginCard } from "../_components/oidc-login-card";
import { ProviderSection } from "../_components/provider-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function ProviderSettingsPage() {
  const runtime = useHarnessRuntime();
  const management = useProviderManagement();
  // One daemon-defaults hook shared by the provider card (its "Save
  // override" for a gateway URL) and the Daemon defaults card below it, so
  // both edit the same document and see the same save/error state.
  const daemonDefaults = useDaemonDefaults();
  // The daemon's own per-provider status hints (ListModels.provider_status)
  // — read-only and mode-independent, merged into the rows in managed mode
  // and listed on their own in external mode.
  const providerStatus = useProviderStatus();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <ProviderSection
        runtime={runtime}
        management={management}
        daemonDefaults={daemonDefaults}
        providerStatus={providerStatus}
      />
      {/* Deployment-wide model/effort/caching/endpoint defaults — the
          mecated spawn flags the controller owns. Kept OUTSIDE the provider
          card so that card stays free of text inputs (rule 3's test). */}
      <DaemonDefaultsCard runtime={runtime} defaults={daemonDefaults} />
      <AboutDaemonCard
        selectedProviderId={runtime.status?.selectedProvider ?? undefined}
      />
      {/* Remote-daemon login (H3): only external mode authenticates upstream,
          and the card itself explains a half-configured issuer. */}
      {runtime.mode === "external" && <OidcLoginCard />}
    </>
  );
}
