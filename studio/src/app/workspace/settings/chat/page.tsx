"use client";

import { CornerDownRight, ListEnd } from "lucide-react";
import {
  type EnterSendBehavior,
  useEnterSendBehavior,
} from "@/lib/profile-preferences";
import { OptionField } from "../_components/option-field";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

const ENTER_BEHAVIOR_OPTIONS = [
  { value: "queue", label: "Queue message", icon: ListEnd },
  { value: "steer", label: "Steer the agent", icon: CornerDownRight },
] as const;

export default function ChatSettingsPage() {
  const { behavior, setBehavior } = useEnterSendBehavior();

  return (
    <SettingsCard title="Messages">
      <SettingsRow
        label="Enter while the agent is replying"
        description="Shift+Enter does the opposite."
      >
        <OptionField
          label="Enter while the agent is replying"
          value={behavior}
          options={ENTER_BEHAVIOR_OPTIONS}
          onChange={(next) => setBehavior(next as EnterSendBehavior)}
        />
      </SettingsRow>
    </SettingsCard>
  );
}
