"use client";

import { User } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentDisplayName, useUserAvatar } from "@/lib/profile-preferences";
import { SettingsCard } from "./settings-card";

/** Longest edge of the stored avatar; it renders at 56px, so this is ample. */
const AVATAR_MAX_DIM = 512;

/**
 * Downscale a picked image in the browser so any size of upload fits
 * comfortably in local storage: longest edge capped at AVATAR_MAX_DIM,
 * re-encoded as JPEG (composited over white — JPEG has no alpha).
 */
async function downscaleAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("undecodable image"));
      el.src = url;
    });
    const scale = Math.min(
      1,
      AVATAR_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
    downscaleAvatar(file)
      .then(setAvatarUrl)
      .catch(() => toast.error("Could not read that image."));
  }

  return (
    <SettingsCard title="Profile">
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
        </div>
      </div>
    </SettingsCard>
  );
}
