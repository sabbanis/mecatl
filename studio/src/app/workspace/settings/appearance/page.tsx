"use client";

import {
  Minus,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Sun,
} from "lucide-react";
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
import { SettingsCard, SettingsRow } from "../_components/settings-card";

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
      <div className="divide-y divide-border/60">
        <SettingsRow
          label="Theme"
          description="Light, dark, or follow the system."
        >
          <OptionField
            label="Theme"
            value={mounted ? (activeTheme ?? "system") : "system"}
            options={THEME_OPTIONS}
            onChange={setTheme}
          />
        </SettingsRow>

        <SettingsRow
          label="Interface scale"
          description="Sizes text and controls together."
        >
          {/* Same footprint as the OptionField triggers so the control
              column lines up. */}
          <div className="flex min-w-36 items-center justify-between gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Decrease interface scale"
              disabled={scale <= UI_SCALE_MIN}
              onClick={() => setScale(scale - 0.05)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="text-center text-sm tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Increase interface scale"
              disabled={scale >= UI_SCALE_MAX}
              onClick={() => setScale(scale + 0.05)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </SettingsRow>

        {/* Meaningless on mobile — the session list is full-screen there. */}
        <SettingsRow
          label="Session list position"
          description="Which side of the window the session list docks on."
          className="max-[499px]:hidden"
        >
          <OptionField
            label="Session list position"
            value={side}
            options={SIDE_OPTIONS}
            onChange={(next) => setSide(next as "left" | "right")}
          />
        </SettingsRow>
      </div>
    </SettingsCard>
  );
}
