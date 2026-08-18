"use client";

import { User } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentDisplayName, useUserAvatar } from "@/lib/profile-preferences";
import { SettingsCard } from "./settings-card";

const MAX_AVATAR_BYTES = 512 * 1024;

/**
 * Cosmetic identity preferences — the agent's display name and the user's
 * picture. Both are browser-local only: there is no daemon concept of a
 * profile picture or a per-deployment agent name to write back to.
 */
export function ProfileSection() {
  const { name, setName, defaultName } = useAgentDisplayName();
  const { avatarUrl, setAvatarUrl } = useUserAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Choose an image under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <SettingsCard
      title="Profile"
      description="Cosmetic and local to this browser — nothing here is stored by the daemon."
    >
      <div className="divide-y">
        <div className="flex items-center gap-4 pb-5">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
            {avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: a locally stored data URL, not a remote image
              <img
                src={avatarUrl}
                alt="You"
                className="size-full object-cover"
              />
            ) : (
              <User className="size-6" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-medium">You</p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? "Change picture" : "Upload picture"}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setAvatarUrl(null)}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-xs space-y-1.5 pt-5">
          <p className="text-sm font-medium">Agent</p>
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
          <p className="text-xs text-muted-foreground">
            Shown instead of "{defaultName}" in chat.
          </p>
        </div>
      </div>
    </SettingsCard>
  );
}
