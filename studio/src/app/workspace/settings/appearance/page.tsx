"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileSection } from "../_components/profile-section";
import { SettingsCard } from "../_components/settings-card";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function AppearanceSettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme();

  // next-themes resolves only on the client; gate the active-pill highlight on
  // mount so the selected theme shows instead of nothing on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <ProfileSection />
      <SettingsCard title="Appearance">
        <div className="inline-flex w-max items-center gap-1 rounded-full bg-muted p-1">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const isActive = mounted && activeTheme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </SettingsCard>
    </>
  );
}
