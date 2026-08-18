"use client";

import { Bell, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { GatewaySection } from "./_components/gateway-section";
import { ModelRouterSection } from "./_components/model-router-section";
import { ProviderSection } from "./_components/provider-section";
import { SettingsCard } from "./_components/settings-card";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Per-user Settings — crosscutting account preferences (profile, appearance).
 * The display name comes from the session's identity provider.
 */
export default function UserSettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme();

  // One hook instance shared by the three runtime sections, so they read one
  // status snapshot and share the busy/notice/error channel for writes.
  const runtime = useHarnessRuntime();

  // next-themes resolves only on the client; gate the active-pill highlight on
  // mount so the selected theme shows instead of nothing on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Browser notifications: track the permission so the UI reflects granted /
  // denied / not-yet-asked. "unsupported" covers browsers without the API.
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

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <h1 className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}>
          Settings
        </h1>

        <div className="space-y-5">
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

          <SettingsCard
            title="Notifications"
            description="Get a desktop alert when a scheduled task or agent run finishes."
          >
            {notifyPermission === "unsupported" ? (
              <p className="text-sm text-muted-foreground">
                This browser doesn't support notifications.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-sm text-muted-foreground">
                  {notifyPermission === "granted"
                    ? "Browser notifications are on. You'll be alerted when background work completes."
                    : notifyPermission === "denied"
                      ? "Notifications are blocked. Re-enable them for this site in your browser settings."
                      : "Allow browser notifications to be alerted when background work completes."}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={enableNotifications}
                    disabled={notifyPermission === "granted"}
                  >
                    <Bell className="size-4" />
                    {notifyPermission === "granted" ? "Enabled" : "Enable"}
                  </Button>
                  <Button
                    variant="action"
                    onClick={sendTestNotification}
                    disabled={notifyPermission !== "granted"}
                  >
                    Send a test notification
                  </Button>
                </div>
              </div>
            )}
          </SettingsCard>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
            <div>
              <h2 className="text-lg font-semibold">Agent runtime</h2>
              <p className="text-xs text-muted-foreground">
                Provider, model routing and MCP gateway behind the agent.
                Configuration writes restart the daemon.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(runtime.isLoading || runtime.busy) && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void runtime.refresh()}
                disabled={!runtime.live || runtime.isLoading}
              >
                Refresh
              </Button>
            </div>
          </div>

          {runtime.error && (
            <p className="text-sm text-destructive">{runtime.error}</p>
          )}
          {runtime.notice && (
            <p className="text-sm text-muted-foreground">{runtime.notice}</p>
          )}

          <ProviderSection runtime={runtime} />
          <ModelRouterSection runtime={runtime} />
          <GatewaySection runtime={runtime} />
        </div>
      </div>
    </div>
  );
}
