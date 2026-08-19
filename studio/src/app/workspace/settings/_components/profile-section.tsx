"use client";

import { User } from "lucide-react";
import { useUserAvatar } from "@/lib/profile-preferences";
import { AvatarPicker } from "./avatar-picker";
import { SettingsCard } from "./settings-card";

/**
 * The user's own identity preferences — browser-local only: there is no
 * daemon concept of a user profile to write back to. The agent's identity
 * lives on the separate Agent page.
 */
export function ProfileSection() {
  const { avatarUrl, setAvatarUrl } = useUserAvatar();

  return (
    <SettingsCard title="Profile">
      <AvatarPicker
        avatarUrl={avatarUrl}
        onChange={setAvatarUrl}
        alt="You"
        fallback={<User className="size-6" />}
      />
    </SettingsCard>
  );
}
