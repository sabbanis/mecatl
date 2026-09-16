"use client";

import { Input } from "@/components/ui/input";
import { LLM_TIMEOUT_DEFAULTS } from "@/lib/daemon-defaults.mjs";
import { SettingsRow } from "./settings-card";

/** The two timeout fields as the form holds them: whole seconds AS TYPED
 *  ("" reads as mecated's own default for that flag when saved). */
export interface LlmTimeoutDraft {
  perAttempt: string;
  streamIdle: string;
}

const ROW_CLASS = "[&>div:last-child]:w-full [&>div:last-child]:sm:max-w-xs";

/**
 * The daemon's two LLM stream bounds, as rows of the "Daemon defaults" card
 * (the web analogue of mecated's / mecatui's `--llm-per-attempt-timeout`
 * and `--llm-stream-idle-timeout`). Both are spawn flags: the card's one
 * Save writes them into the same document as the context window override,
 * behind the same restart confirm. The help text mirrors the flag docs in
 * `cmd/mecated/main.go`: the connect bound never cuts a turn that is already
 * streaming, the idle bound ends a stalled turn and is never retried, and 0
 * disables either one.
 */
export function LlmTimeoutRows({
  value,
  onChange,
}: {
  value: LlmTimeoutDraft;
  onChange: (next: LlmTimeoutDraft) => void;
}) {
  return (
    <>
      <SettingsRow
        label="LLM connect timeout"
        htmlFor="daemon-llm-per-attempt-timeout"
        description={`Seconds allowed to establish a model stream — connect plus first chunk (--llm-per-attempt-timeout). It never cuts a turn that is already streaming; a stall before the first chunk is retried. 0 disables it. Large-context reasoning models can take minutes to their first token. mecated's default is ${LLM_TIMEOUT_DEFAULTS.perAttemptSeconds}.`}
        className={ROW_CLASS}
      >
        <Input
          id="daemon-llm-per-attempt-timeout"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.perAttempt}
          onChange={(event) =>
            onChange({ ...value, perAttempt: event.target.value })
          }
          placeholder={`${LLM_TIMEOUT_DEFAULTS.perAttemptSeconds} (mecated default)`}
          autoComplete="off"
          className="font-mono"
        />
      </SettingsRow>
      <SettingsRow
        label="LLM idle timeout"
        htmlFor="daemon-llm-stream-idle-timeout"
        description={`Seconds of silence between stream chunks, after the first, before the turn is ended (--llm-stream-idle-timeout). A longer stall ends the turn with an error and is not retried. 0 disables it. mecated's default is ${LLM_TIMEOUT_DEFAULTS.streamIdleSeconds}.`}
        className={ROW_CLASS}
      >
        <Input
          id="daemon-llm-stream-idle-timeout"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.streamIdle}
          onChange={(event) =>
            onChange({ ...value, streamIdle: event.target.value })
          }
          placeholder={`${LLM_TIMEOUT_DEFAULTS.streamIdleSeconds} (mecated default)`}
          autoComplete="off"
          className="font-mono"
        />
      </SettingsRow>
    </>
  );
}
