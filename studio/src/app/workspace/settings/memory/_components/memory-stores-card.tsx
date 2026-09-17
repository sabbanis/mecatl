"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { MAX_REVIEW_INTERVAL } from "@/lib/harness/daemon-options";
import { readMemoryStores } from "../../../_components/memory-indicator";
import {
  DaemonOptionsCard,
  StatusRow,
} from "../../_components/daemon-options-card";
import { SettingsRow } from "../../_components/settings-card";

/**
 * Settings → Memory → Memory stores: the two daemon memory stores as the
 * TUI documents them — the per-project cross-session store behind the
 * Remember/Recall tools (`--memory-dir`; off = the flag omitted) and the
 * cross-project user model whose facts the table below lists
 * (`--no-user-model`, `--user-model-dir`, `--user-model-review-interval`).
 *
 * The status rows are the daemon's own `capabilities.memory` /
 * `user_model` — the TUI's "memory is on" welcome note — in both modes; the
 * controls are managed-mode only and every save restarts the daemon. The
 * review interval only matters once learning mode is Auto (Settings →
 * Learning owns the mode). Directories are trust decisions confined by the
 * controller to the workspace / default root / mecatl config dir.
 */

const STORE_WORD = { on: "on", off: "off" };

const clampInterval = (raw: string, fallback: number) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_REVIEW_INTERVAL, Math.max(1, value));
};

export function MemoryStoresCard() {
  const { serverCapabilities } = useRuntimeStatus();
  const stores = readMemoryStores(serverCapabilities);
  const word = (value: boolean | null) =>
    value === null ? "not reported" : value ? STORE_WORD.on : STORE_WORD.off;
  return (
    <DaemonOptionsCard
      title="Memory stores"
      description="Whether the managed daemon keeps per-project memory and a cross-project user model, and where. Changes restart it."
      testId="memory-stores"
      confirmTitle="Change the memory stores and restart the daemon?"
      externalNote={
        <>
          Pass <code>--memory-dir</code>, <code>--no-user-model</code>,{" "}
          <code>--user-model-dir</code> or{" "}
          <code>--user-model-review-interval</code> to the server host&rsquo;s
          mecated and restart that server.
        </>
      }
      status={
        <>
          <StatusRow
            label="Project memory (Remember/Recall)"
            testId="memory-status-project"
            value={word(stores.project)}
            description="Cross-session memory for this project, as the running daemon reports it."
          />
          <StatusRow
            label="User model (facts about you)"
            testId="memory-status-user-model"
            value={word(stores.userModel)}
            description="The cross-project store the table below lists."
          />
        </>
      }
    >
      {({ options, doc, busy, update }) => (
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Project memory"
            htmlFor="project-memory-enabled"
            description="Register the Remember/Recall/SearchMemory tools over a per-project store. Off omits --memory-dir, which is how mecated turns them off. Automatic consolidation stays off; the card below runs it on demand."
          >
            <Switch
              id="project-memory-enabled"
              checked={options.projectMemory.enabled}
              disabled={busy}
              onCheckedChange={(enabled) =>
                update({ projectMemory: { enabled } })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="Project memory directory"
            htmlFor="project-memory-dir"
            description="Absolute, or relative to the workspace. Empty keeps Studio's per-project location beside the session store."
          >
            <Input
              id="project-memory-dir"
              value={options.projectMemory.dir}
              placeholder={doc.defaults.memoryDir}
              disabled={busy || !options.projectMemory.enabled}
              spellCheck={false}
              onChange={(event) =>
                update({ projectMemory: { dir: event.target.value } })
              }
              className="w-56 font-mono text-xs min-[500px]:w-80"
            />
          </SettingsRow>
          <SettingsRow
            label="User model"
            htmlFor="user-model-enabled"
            description="Keep durable facts about you across projects and expose the explicit user-memory tools. Off passes --no-user-model; the table below then has nothing to list."
          >
            <Switch
              id="user-model-enabled"
              checked={options.userModel.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => update({ userModel: { enabled } })}
            />
          </SettingsRow>
          <SettingsRow
            label="User model directory"
            htmlFor="user-model-dir"
            description="Empty keeps mecated's conventional location."
          >
            <Input
              id="user-model-dir"
              value={options.userModel.dir}
              placeholder={doc.defaults.userModelDir}
              disabled={busy || !options.userModel.enabled}
              spellCheck={false}
              onChange={(event) =>
                update({ userModel: { dir: event.target.value } })
              }
              className="w-56 font-mono text-xs min-[500px]:w-80"
            />
          </SettingsRow>
          <SettingsRow
            label="Review every Nth completion"
            htmlFor="user-model-review-interval"
            description={
              <>
                The debounce for automatic user-model review: 1 reviews every
                eligible completed run. Applies only while learning mode is Auto
                (
                <Link
                  href="/workspace/settings/learning"
                  className="underline underline-offset-2"
                >
                  Settings → Learning
                </Link>
                ).
              </>
            }
          >
            <Input
              id="user-model-review-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_REVIEW_INTERVAL}
              step={1}
              value={options.userModel.reviewInterval}
              disabled={busy || !options.userModel.enabled}
              onChange={(event) =>
                update({
                  userModel: {
                    reviewInterval: clampInterval(
                      event.target.value,
                      options.userModel.reviewInterval,
                    ),
                  },
                })
              }
              className="w-24"
            />
          </SettingsRow>
        </div>
      )}
    </DaemonOptionsCard>
  );
}
