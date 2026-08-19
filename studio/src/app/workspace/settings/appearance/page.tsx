"use client";

import { Monitor, Moon, PanelLeft, PanelRight, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useSessionListSide } from "@/lib/profile-preferences";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../_components/settings-card";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const SESSION_LIST_SIDES = [
  { value: "left", label: "Left", icon: PanelLeft },
  { value: "right", label: "Right", icon: PanelRight },
] as const;

function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex w-max items-center gap-1 rounded-full bg-muted p-1">
      {children}
    </div>
  );
}

function Pill({
  isActive,
  onClick,
  icon: Icon,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
}

export default function AppearanceSettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme();
  const { side, setSide } = useSessionListSide();

  // next-themes resolves only on the client; gate the active-pill highlight on
  // mount so the selected theme shows instead of nothing on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <SettingsCard title="Appearance">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Theme</p>
            <PillGroup>
              {THEMES.map(({ value, label, icon }) => (
                <Pill
                  key={value}
                  isActive={mounted && activeTheme === value}
                  onClick={() => setTheme(value)}
                  icon={icon}
                  label={label}
                />
              ))}
            </PillGroup>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Session list position</p>
            <PillGroup>
              {SESSION_LIST_SIDES.map(({ value, label, icon }) => (
                <Pill
                  key={value}
                  isActive={mounted && side === value}
                  onClick={() => setSide(value)}
                  icon={icon}
                  label={label}
                />
              ))}
            </PillGroup>
          </div>
        </div>
      </SettingsCard>
    </>
  );
}
