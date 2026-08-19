"use client";

import { Monitor, Moon, PanelLeft, PanelRight, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useSessionListSide,
  useUiScale,
} from "@/lib/profile-preferences";
import { OptionField } from "../_components/option-field";
import { SettingsCard } from "../_components/settings-card";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const SIDE_OPTIONS = [
  { value: "left", label: "Left", icon: PanelLeft },
  { value: "right", label: "Right", icon: PanelRight },
] as const;

export default function AppearanceSettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme();
  const { side, setSide } = useSessionListSide();
  const { scale, setScale } = useUiScale();

  // next-themes resolves only on the client; gate the current value on mount
  // so the trigger shows the real choice instead of a flash of "system".
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SettingsCard title="Appearance">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Theme</p>
          <OptionField
            label="Theme"
            value={mounted ? (activeTheme ?? "system") : "system"}
            options={THEME_OPTIONS}
            onChange={setTheme}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Interface scale</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Interface scale"
              min={UI_SCALE_MIN}
              max={UI_SCALE_MAX}
              step={0.05}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              className="h-2 w-full max-w-64 cursor-pointer accent-brand"
            />
            <span className="w-11 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={scale === 1}
              onClick={() => setScale(1)}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Meaningless on mobile — the session list is full-screen there. */}
        <div className="flex items-center justify-between gap-3 max-[499px]:hidden">
          <p className="text-sm font-medium">Session list position</p>
          <OptionField
            label="Session list position"
            value={side}
            options={SIDE_OPTIONS}
            onChange={(next) => setSide(next as "left" | "right")}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
