"use client";

import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentAvatar, useAgentDisplayName } from "@/lib/profile-preferences";
import { AvatarPicker } from "../_components/avatar-picker";
import { SettingsCard } from "../_components/settings-card";

/**
 * The agent's cosmetic identity — display name and picture, browser-local
 * (no daemon concept of either). The picture replaces the default bot mark
 * in chat.
 */
export default function AgentSettingsPage() {
  const { name, setName, defaultName } = useAgentDisplayName();
  const { avatarUrl, setAvatarUrl } = useAgentAvatar();

  return (
    <SettingsCard title="Agent">
      <div className="divide-y">
        <div className="pb-5">
          <AvatarPicker
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            alt={name}
            fallback={<Bot className="size-6" />}
          />
        </div>
        <div className="max-w-xs space-y-1.5 pt-5">
          <p className="text-sm font-medium">Name</p>
          <Label htmlFor="agent-display-name" className="sr-only">
            Agent name
          </Label>
          <Input
            id="agent-display-name"
            value={name}
            placeholder={defaultName}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
