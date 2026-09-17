"use client";

import { Switch } from "@/components/ui/switch";
import {
  type DaemonOptionsPatch,
  useDaemonOptions,
} from "@/features/agent/hooks/use-daemon-options";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { readMemoryStores } from "../../../_components/memory-indicator";
import {
  ApplyingNote,
  Note,
  SettingsCard,
  SettingsRow,
} from "../../_components/settings-card";

/**
 * Settings → Memory → Memory: the two things the agent can remember, as two
 * switches. The saved values come from the same options document every other
 * agent-options card edits. Flipping a switch saves AT ONCE — the hook merges
 * the one changed value over the saved document and sends the WHOLE thing —
 * and the agent restarts in the background: both switches are disabled
 * behind one "Applying…" line until the re-read shows the new state, and a
 * refusal shows inline. Only the on/off switches are offered here. When the
 * agent is run elsewhere the switches give way to a read-only On/Off line
 * per store, read from what the running agent reports.
 */

/** The two stores, in display order, keyed by the options-document section. */
const STORES = [
  {
    section: "projectMemory",
    id: "project-memory-enabled",
    label: "Project memory",
    description: "Remember things about this project between chats.",
    statusTestId: "memory-status-project",
    capability: "project",
    patch: (enabled: boolean): DaemonOptionsPatch => ({
      projectMemory: { enabled },
    }),
  },
  {
    section: "userModel",
    id: "user-model-enabled",
    label: "Facts about you",
    description: "Remember your preferences across every project.",
    statusTestId: "memory-status-user-model",
    capability: "userModel",
    patch: (enabled: boolean): DaemonOptionsPatch => ({
      userModel: { enabled },
    }),
  },
] as const;

const statusWord = (value: boolean | null) =>
  value === null ? "Not available" : value ? "On" : "Off";

export function MemoryStoresCard() {
  const { serverCapabilities } = useRuntimeStatus();
  const { live, manageable, doc, isLoading, busy, error, save } =
    useDaemonOptions();

  let body: React.ReactNode;
  if (!live) {
    body = <Note>The agent is offline, so memory can&apos;t be changed.</Note>;
  } else if (!manageable) {
    const stores = readMemoryStores(serverCapabilities);
    body = (
      <div className="space-y-4">
        <Note>
          Memory is set where the agent runs and can&apos;t be changed here.
        </Note>
        <div className="divide-y divide-border/60 rounded-lg border px-4">
          {STORES.map((store) => (
            <div
              key={store.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <p className="text-sm">{store.label}</p>
              <span
                className="text-sm text-muted-foreground"
                data-testid={store.statusTestId}
              >
                {statusWord(stores[store.capability])}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (!doc) {
    body = (
      <Note>
        {isLoading
          ? "Loading memory settings…"
          : (error ?? "Memory settings couldn't be loaded right now.")}
      </Note>
    );
  } else {
    body = (
      <>
        <div className="divide-y divide-border/60">
          {STORES.map((store) => (
            <SettingsRow
              key={store.id}
              label={store.label}
              htmlFor={store.id}
              description={store.description}
            >
              <Switch
                id={store.id}
                checked={doc.options[store.section].enabled}
                disabled={busy}
                onCheckedChange={(enabled) => void save(store.patch(enabled))}
              />
            </SettingsRow>
          ))}
        </div>
        {busy ? <ApplyingNote className="mt-3" /> : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <SettingsCard title="Memory">
      <div data-testid="memory-stores">{body}</div>
    </SettingsCard>
  );
}
