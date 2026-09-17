"use client";

import {
  Bell,
  BellRing,
  CornerDownRight,
  History,
  Keyboard,
  ListEnd,
  ListX,
  Minus,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  SquarePen,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePalette } from "@/components/palette-provider";
import { paletteSwatch } from "@/components/palette-swatch";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { findPalette, type PaletteDef } from "@/lib/palettes";
import {
  type EnterSendBehavior,
  type LaunchTarget,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useEnterSendBehavior,
  useLaunchTarget,
  useSessionListSide,
  useShowStarterPrompts,
  useUiScale,
  useWelcomeDismissed,
} from "@/lib/profile-preferences";
import { CustomPalettesSection } from "../_components/custom-palettes-section";
import { OptionField } from "../_components/option-field";
import { PreferencesFileSection } from "../_components/preferences-file-section";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// The palette catalogue IS the "list themes" surface (mecatui --list-themes):
// one option per built-in AND per custom palette (user-added or from
// STUDIO_PALETTE_DIR, suffixed so the source is visible), its swatch in the
// palette's accent. Memoised on the catalogue so the swatch component
// identities stay stable across renders.
function paletteOptions(catalogue: readonly PaletteDef[]) {
  return catalogue.map((palette) => ({
    value: palette.id,
    label:
      palette.source === "built-in"
        ? palette.label
        : `${palette.label} · ${palette.source === "user" ? "custom" : "operator"}`,
    description: palette.description,
    icon: paletteSwatch(palette.swatch),
  }));
}

const SIDE_OPTIONS = [
  { value: "left", label: "Left", icon: PanelLeft },
  { value: "right", label: "Right", icon: PanelRight },
] as const;

// The third option is the client-level never-steer switch (the web form of
// `mecatui --no-steer`): both keys queue and every steer affordance is
// withdrawn, whatever the daemon supports. The daemon-side opt-out is the
// Mid-run steering switch on Settings → Agent.
// The `--resume-latest` analogue: what the bare chat route opens.
const LAUNCH_TARGET_OPTIONS = [
  { value: "draft", label: "New chat", icon: SquarePen },
  { value: "latest", label: "Most recent chat", icon: History },
] as const;

const ENTER_BEHAVIOR_OPTIONS = [
  { value: "queue", label: "Queue message", icon: ListEnd },
  { value: "steer", label: "Steer the agent", icon: CornerDownRight },
  {
    value: "queue-only",
    label: "Queue only",
    icon: ListX,
    description: "Never steer, even with Shift+Enter.",
  },
] as const;

/** The Message queuing row's description, phrased for the chosen value. */
function enterBehaviorDescription(behavior: EnterSendBehavior): string {
  return behavior === "queue-only"
    ? "Never steer the in-flight run — every mid-run message waits for the next turn; a cancelled or failed run pauses the queue until you resume it."
    : "Shift+Enter does the opposite; a cancelled or failed run pauses the queue until you resume it.";
}

function PersonalizeCard() {
  const { theme: activeTheme, setTheme } = useTheme();
  const { palette, setPalette, defaultPalette, catalogue } = usePalette();
  const paletteOptionList = useMemo(
    () => paletteOptions(catalogue),
    [catalogue],
  );
  const { side, setSide } = useSessionListSide();
  const { scale, setScale } = useUiScale();
  const { behavior, setBehavior } = useEnterSendBehavior();
  const { target: launchTarget, setTarget: setLaunchTarget } =
    useLaunchTarget();
  const { show: showStarterPrompts, setShow: setShowStarterPrompts } =
    useShowStarterPrompts();
  const { dismissed: welcomeDismissed, setDismissed: setWelcomeDismissed } =
    useWelcomeDismissed();

  // Browser notifications: permission mirrored into state so the row reflects
  // granted / denied / not-yet-asked; "unsupported" hides the row's actions.
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifyPermission(Notification.permission);
    } else {
      setNotifyPermission("unsupported");
    }
  }, []);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
    if (result === "granted") {
      toast.success("Browser notifications enabled");
    } else if (result === "denied") {
      toast.error("Notifications are blocked — enable them in your browser.");
    }
  }

  function sendTestNotification() {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    new Notification("Scheduled task finished", {
      body: "Daily dependency audit completed — 0 critical vulnerabilities found.",
      tag: "atrium-example",
      icon: "/favicon.ico",
    });
    toast.success("Test notification sent");
  }

  // next-themes resolves only on the client; gate the current value on mount
  // so the trigger shows the real choice instead of a flash of "system".
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SettingsCard title="Personalize">
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

        {/* The second appearance axis: a named token set (data-palette on
            <html>) over the same light/dark choice — the web form of
            mecatui's --theme aztec|mono|solar. Browser-local; the deployment
            may pin a default with BRAND_PALETTE. */}
        <SettingsRow
          label="Palette"
          description={
            defaultPalette === "default"
              ? "Accent and shell colours. Light and dark still follow Theme; code blocks keep their light and dark colours."
              : `Accent and shell colours. Light and dark still follow Theme; code blocks keep their light and dark colours. This deployment's default is ${findPalette(defaultPalette)?.label ?? defaultPalette}.`
          }
        >
          <OptionField
            label="Palette"
            value={palette}
            options={paletteOptionList}
            onChange={setPalette}
          />
        </SettingsRow>

        <SettingsRow
          label="Interface scale"
          description="Sizes text and controls together."
        >
          {/* Same footprint as the OptionField triggers so the control
              column lines up. */}
          <div className="flex w-44 items-center justify-between gap-1">
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

        <SettingsRow
          label="Message queuing"
          description={enterBehaviorDescription(behavior)}
        >
          <OptionField
            label="Message queuing"
            value={behavior}
            options={ENTER_BEHAVIOR_OPTIONS}
            onChange={(next) => setBehavior(next as EnterSendBehavior)}
          />
        </SettingsRow>

        {/* Discoverability: the Enter preference above changes what a key
            DOES; which keys fire what lives on Settings → Keyboard. */}
        <SettingsRow
          label="Keyboard shortcuts"
          description="Rebind any shortcut, or see them all. Stored in this browser."
        >
          <Button asChild variant="outline" className="w-44 rounded-full">
            <Link href="/workspace/settings/keyboard">
              <Keyboard className="size-4" />
              Customize
            </Link>
          </Button>
        </SettingsRow>

        {/* The `--resume-latest` analogue. "Most recent" skips chats that
            are running or waiting on an approval (`latest-chat.ts`); an
            explicit "New chat" always wins over it. */}
        <SettingsRow
          label="Start on"
          description="What Chat opens when no chat is in the URL. “Most recent chat” skips chats that are running or waiting on an approval."
        >
          <OptionField
            label="Start on"
            value={launchTarget}
            options={LAUNCH_TARGET_OPTIONS}
            onChange={(next) => setLaunchTarget(next as LaunchTarget)}
          />
        </SettingsRow>

        <SettingsRow
          label="Starter prompts"
          htmlFor="starter-prompts"
          description="Suggested prompts on a new chat."
        >
          <Switch
            id="starter-prompts"
            checked={showStarterPrompts}
            onCheckedChange={setShowStarterPrompts}
            aria-label="Starter prompts"
          />
        </SettingsRow>

        <SettingsRow
          label="Welcome card"
          description="The first-run introduction on a new chat."
        >
          <Button
            variant="outline"
            className="w-44 rounded-full"
            onClick={() => setWelcomeDismissed(false)}
            disabled={!welcomeDismissed}
          >
            {welcomeDismissed ? "Show again" : "Showing"}
          </Button>
        </SettingsRow>

        {notifyPermission !== "unsupported" && (
          <SettingsRow
            label="Browser notifications"
            description={
              notifyPermission === "denied"
                ? "Blocked — re-enable them for this site in your browser settings."
                : "Get a browser alert when a run or scheduled task finishes."
            }
          >
            <div className="flex w-44 items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={enableNotifications}
                disabled={notifyPermission === "granted"}
              >
                <Bell className="size-4" />
                {notifyPermission === "granted" ? "Enabled" : "Enable"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-full"
                aria-label="Send a test notification"
                title="Send a test notification"
                onClick={sendTestNotification}
                disabled={notifyPermission !== "granted"}
              >
                <BellRing className="size-4" />
              </Button>
            </div>
          </SettingsRow>
        )}
      </div>
    </SettingsCard>
  );
}

export default function AppearanceSettingsPage() {
  return (
    <>
      <PersonalizeCard />
      {/* mecatui's custom {name, palette} JSON themes: user-added palettes
          (this browser) and the operator's STUDIO_PALETTE_DIR, both listed in
          the Palette picker above. */}
      <CustomPalettesSection />
      {/* The client-owned settings file, for the web: every preference on
          this page (and the keymap, status line, hidden models…) as one
          strict JSON document that moves between browsers. */}
      <PreferencesFileSection />
    </>
  );
}
