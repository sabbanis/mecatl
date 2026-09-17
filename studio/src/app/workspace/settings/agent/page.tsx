"use client";

import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAgentAvatar, useAgentDisplayName } from "@/lib/profile-preferences";
import { AvatarPicker } from "../_components/avatar-picker";
import { RuntimeBehaviourSection } from "../_components/runtime-behaviour-section";
import { SettingsCard, SettingsRow } from "../_components/settings-card";
import { SoulSection } from "../_components/soul-section";

/**
 * The agent's cosmetic identity — display name and picture, browser-local
 * (no daemon concept of either). The picture replaces the default bot mark
 * in chat. Below it, the DAEMON-side agent: its runtime behaviour and the
 * persona (soul) it injects as turn-0 context.
 */
export default function AgentSettingsPage() {
  const { name, setName, defaultName } = useAgentDisplayName();
  const { avatarUrl, setAvatarUrl } = useAgentAvatar();

  return (
    <>
      <SettingsCard title="Agent">
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Agent name"
            htmlFor="agent-display-name"
            description="Labels the agent's replies in chat."
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
          <SettingsRow
            label="Picture"
            description="Shown next to the agent's replies."
          >
            <AvatarPicker
              avatarUrl={avatarUrl}
              onChange={setAvatarUrl}
              alt={name}
              fallback={<Bot className="size-6" />}
            />
          </SettingsRow>
        </div>
      </SettingsCard>
      {/* The managed DAEMON's behaviour, for every client — the operator half
          of the steer opt-out (mecated --no-steer). The browser-local "Queue
          only" Enter preference lives on Settings → Personalize. */}
      <RuntimeBehaviourSection />
      {/* The daemon's resolved persona (GET /v1/soul, read-only) and, in
          managed mode, the soul spawn flags (--no-soul / --soul-strict /
          --soul-file / the one-shot --approve-soul) via the controller. */}
      <SoulSection />
    </>
  );
}
