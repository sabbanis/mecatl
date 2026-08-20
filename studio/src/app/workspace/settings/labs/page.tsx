"use client";

import { Switch } from "@/components/ui/switch";
import { useMockFeatures } from "@/lib/profile-preferences";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

export default function LabsSettingsPage() {
  const { enabled, setEnabled } = useMockFeatures();

  return (
    <SettingsCard
      title="Labs"
      description="Experimental previews. Everything here is browser-local."
    >
      <SettingsRow
        label="Show mock features"
        htmlFor="mock-features"
        description={
          <>
            Adds a clearly-labeled mock chat demonstrating file cards, previews,
            and threads. Local demo content only &mdash; nothing is sent to the
            daemon.
          </>
        }
      >
        <Switch
          id="mock-features"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Show mock features"
        />
      </SettingsRow>
    </SettingsCard>
  );
}
