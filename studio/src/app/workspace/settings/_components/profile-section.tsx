"use client";

import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserAvatar, useUserDisplayName } from "@/lib/profile-preferences";
import { AvatarPicker } from "./avatar-picker";
import { SettingsCard } from "./settings-card";

/**
 * The user's own identity preferences — browser-local only: there is no
 * daemon concept of a user profile to write back to. The agent's identity
 * lives on the separate Agent page.
 */
export function ProfileSection() {
  const { avatarUrl, setAvatarUrl } = useUserAvatar();
  const { name, setName } = useUserDisplayName();

  return (
    <SettingsCard
      title="You"
      description="How you appear in chat, stored in this browser only."
    >
      <div className="divide-y divide-border/60">
        <div className="flex items-center justify-between gap-3 pb-4">
          <Label htmlFor="user-display-name" className="text-sm font-medium">
            Your name
          </Label>
          <Input
            id="user-display-name"
            value={name}
            placeholder="You"
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            className="w-44 min-[500px]:w-60"
          />
        </div>
        <div className="pt-4">
          <AvatarPicker
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            alt={name || "You"}
            fallback={<User className="size-6" />}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
