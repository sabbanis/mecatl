// SPDX-License-Identifier: Apache-2.0

import { Bot } from "lucide-react";
import { Input } from "../../components/ui/input";
import {
  defaultAgentName,
  useAgentAvatar,
  useAgentDisplayName,
} from "../../lib/profile-preferences";
import { AvatarPicker } from "./avatar-picker";
import { IdentityCard, IdentityField } from "./identity-settings";

/**
 * Studio's Agent page also has an "Agent behaviour" card ("Take messages
 * while working" / steer opt-out), but that switch flips a daemon spawn
 * flag (`--no-steer`) via Studio's own controller sidecar restarting
 * `mecated` — this BFF spawns the daemon once at startup with no such
 * respawn path, so it is out of scope here for the same reason as
 * Permissions and provider CRUD.
 */
export function AgentSettings() {
  const agentName = useAgentDisplayName();
  const agentAvatar = useAgentAvatar();

  return (
    <IdentityCard description="Shown on the agent's replies." title="Agent">
      <IdentityField description="What the agent calls itself." label="Agent name">
        <Input
          aria-label="Agent name"
          className="max-w-64"
          maxLength={40}
          onChange={(event) => agentName.setValue(event.target.value)}
          placeholder={defaultAgentName}
          value={agentName.value}
        />
      </IdentityField>
      <IdentityField description="Shown next to the agent's replies." label="Picture">
        <AvatarPicker
          alt={agentName.value.trim() || defaultAgentName}
          avatarUrl={agentAvatar.value}
          fallback={<Bot aria-hidden="true" className="size-6" />}
          onChange={agentAvatar.setValue}
        />
      </IdentityField>
    </IdentityCard>
  );
}
