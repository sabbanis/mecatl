"use client";

import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAgentAvatar, useAgentDisplayName } from "@/lib/profile-preferences";
import { AvatarPicker } from "../_components/avatar-picker";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

/**
 * The agent's cosmetic identity — display name and picture, browser-local
 * (no daemon concept of either). The picture replaces the default bot mark
 * in chat.
 */
export default function AgentSettingsPage() {
  const { name, setName, defaultName } = useAgentDisplayName();
  const { avatarUrl, setAvatarUrl } = useAgentAvatar();

  return (
    <SettingsCard
      title="Agent"
      description="Cosmetic identity, stored in this browser only."
    >
      <div className="divide-y divide-border/60">
        <SettingsRow
          label="Name"
          htmlFor="agent-display-name"
          description="Replaces the default agent name in chat."
        >
          <Input
            id="agent-display-name"
            value={name}
            placeholder={defaultName}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            className="w-44 min-[500px]:w-60"
          />
        </SettingsRow>
        <div className="pt-4">
          <AvatarPicker
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            alt={name}
            fallback={<Bot className="size-6" />}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
