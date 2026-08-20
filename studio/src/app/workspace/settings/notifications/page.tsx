"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsCard, SettingsRow } from "../_components/settings-card";

export default function NotificationSettingsPage() {
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
    <SettingsCard title="Notifications">
      {notifyPermission === "unsupported" ? (
        <p className="text-sm text-muted-foreground">
          This browser doesn't support notifications.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Browser notifications"
            description={
              notifyPermission === "denied"
                ? "Notifications are blocked. Re-enable them for this site in your browser settings."
                : "Get a browser alert when a run or scheduled task finishes."
            }
          >
            <Button
              variant="outline"
              className="rounded-full"
              onClick={enableNotifications}
              disabled={notifyPermission === "granted"}
            >
              <Bell className="size-4" />
              {notifyPermission === "granted" ? "Enabled" : "Enable"}
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Test notification"
            description="Send a sample so you can check how it looks."
          >
            <Button
              variant="action"
              onClick={sendTestNotification}
              disabled={notifyPermission !== "granted"}
            >
              Send a test notification
            </Button>
          </SettingsRow>
        </div>
      )}
    </SettingsCard>
  );
}
