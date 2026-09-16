"use client";

import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { useDaemonDefaults } from "@/features/agent/hooks/use-daemon-defaults";
import type {
  HarnessModel,
  useHarnessRuntime,
} from "@/features/agent/hooks/use-harness-runtime";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ANTHROPIC_CACHE_TTLS,
  BASE_URL_KINDS,
  REASONING_EFFORTS,
  TOOLHIVE_MODES,
} from "@/lib/daemon-defaults.mjs";
import {
  type HarnessDaemonDefaults,
  validateDaemonDefaults,
} from "@/lib/harness/client";
import { KNOWN_AUTH_PROVIDERS } from "@/lib/provider-auth.mjs";
import { LlmTimeoutRows } from "./llm-timeout-rows";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;
type DefaultsHook = ReturnType<typeof useDaemonDefaults>;

/** Radix Select refuses an empty-string item value, so "not set" rides a
 *  sentinel that can never collide with a model id or an enum token. */
const NONE = "__none__";

/** One editable alias / slot binding. */
interface KeyValueRow {
  key: string;
  value: string;
}

/**
 * The form's working copy — the saved document flattened for editing: the
 * ACTIVE provider's model pair pulled out of `models`, the number as typed,
 * the maps as ordered rows. Exported for its vitest.
 */
export interface DaemonDefaultsFormDraft {
  defaultModel: string;
  subagentModel: string;
  reasoningEffort: string;
  contextWindowOverride: string;
  /** Whole seconds as typed; "" saves as mecated's own default. */
  llmPerAttemptTimeout: string;
  llmStreamIdleTimeout: string;
  promptCacheEnabled: boolean;
  anthropicTtl: string;
  baseUrls: Record<string, string>;
  toolhiveEnabled: boolean;
  toolhiveBaseUrl: string;
  toolhiveMode: string;
  aliases: KeyValueRow[];
  slots: KeyValueRow[];
  apiKeyFile: string;
}

const rowsOf = (map: Record<string, string>): KeyValueRow[] =>
  Object.entries(map).map(([key, value]) => ({ key, value }));

/** Rows → map, skipping rows left entirely blank (an "Add" the user
 *  abandoned); a half-filled row is kept so the validator names it. */
const mapOf = (rows: KeyValueRow[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key && !value) continue;
    out[key] = value;
  }
  return out;
};

/** The saved document as the form edits it, for the provider `kind`. */
export function draftFromDefaults(
  saved: HarnessDaemonDefaults,
  kind: string | null,
): DaemonDefaultsFormDraft {
  const pair = kind ? saved.models[kind] : undefined;
  return {
    defaultModel: pair?.defaultModel ?? "",
    subagentModel: pair?.subagentModel ?? "",
    reasoningEffort: saved.reasoningEffort,
    contextWindowOverride: saved.contextWindowOverride
      ? String(saved.contextWindowOverride)
      : "",
    llmPerAttemptTimeout: String(saved.llmTimeouts.perAttemptSeconds),
    llmStreamIdleTimeout: String(saved.llmTimeouts.streamIdleSeconds),
    promptCacheEnabled: !saved.promptCache.disabled,
    anthropicTtl: saved.promptCache.anthropicTtl,
    baseUrls: Object.fromEntries(
      BASE_URL_KINDS.map((url) => [url, saved.baseUrls[url] ?? ""]),
    ),
    toolhiveEnabled: saved.toolhive.enabled,
    toolhiveBaseUrl: saved.toolhive.baseUrl,
    toolhiveMode: saved.toolhive.mode,
    aliases: rowsOf(saved.aliases),
    slots: rowsOf(saved.slots),
    apiKeyFile: saved.apiKeyFile,
  };
}

/**
 * The exact document Save sends: the draft folded back over the saved
 * document — the active provider's model pair replaces ITS entry in
 * `models` (other providers' pairs are kept untouched), everything else is
 * taken from the draft. Validated by the controller's own grammar; throws
 * its user-facing message. Exported for its vitest.
 */
export function defaultsFromDraft(
  draft: DaemonDefaultsFormDraft,
  saved: HarnessDaemonDefaults,
  kind: string | null,
): HarnessDaemonDefaults {
  const models = { ...saved.models };
  if (kind) {
    models[kind] = {
      defaultModel: draft.defaultModel,
      subagentModel: draft.subagentModel,
    };
  }
  return validateDaemonDefaults({
    models,
    reasoningEffort: draft.reasoningEffort,
    contextWindowOverride: draft.contextWindowOverride.trim() || 0,
    llmTimeouts: {
      perAttemptSeconds: draft.llmPerAttemptTimeout.trim(),
      streamIdleSeconds: draft.llmStreamIdleTimeout.trim(),
    },
    promptCache: {
      disabled: !draft.promptCacheEnabled,
      anthropicTtl: draft.anthropicTtl,
    },
    baseUrls: draft.baseUrls,
    toolhive: {
      enabled: draft.toolhiveEnabled,
      baseUrl: draft.toolhiveBaseUrl,
      mode: draft.toolhiveMode,
    },
    aliases: mapOf(draft.aliases),
    slots: mapOf(draft.slots),
    apiKeyFile: draft.apiKeyFile,
  });
}

/** The provider whose model pair the form edits: the active selection, or
 *  the ToolHive gateway when the daemon fell back to it; never the mock
 *  (nothing to validate a default against). */
export function modelDefaultsKind(status: Runtime["status"]): string | null {
  if (!status) return null;
  const kind =
    status.selectedProvider ??
    (status.toolhiveGateway?.active ? "toolhive" : null);
  return kind && kind !== "mock" ? kind : null;
}

export const RESTART_WARNING =
  "The daemon restarts: in-flight runs and session ids die with it.";

const EFFORT_LABELS: Record<string, string> = {
  "": "Auto (provider default)",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

const TTL_LABELS: Record<string, string> = {
  "": "API default (5 minutes)",
  "5m": "5 minutes",
  "1h": "1 hour",
};

const TOOLHIVE_MODE_LABELS: Record<string, string> = {
  auto: "Auto (direct when OIDC is configured, else the loopback proxy)",
  proxy: "Proxy (always the loopback reverse proxy)",
  direct: "Direct (in-process OIDC token; fails without OIDC)",
};

/**
 * The managed daemon's DEFAULTS — the mecated flags an operator would
 * otherwise pass by hand: the deployment-wide default model and subagent
 * model for the ACTIVE provider, the operator reasoning-effort tier, a
 * context-window override, prompt caching (and the Anthropic cache TTL),
 * and, under Advanced, per-provider base-URL overrides, the ToolHive LLM
 * gateway, model aliases and slots, and the credentials-file path. Every
 * value is a spawn flag owned by Studio's controller — never a settings.yaml
 * key, never a credential — and every save restarts the daemon. Managed
 * mode only: an external deployment spawned its own daemon.
 */
export function DaemonDefaultsCard({
  runtime,
  defaults,
}: {
  runtime: Runtime;
  defaults: DefaultsHook;
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [draft, setDraft] = useState<DaemonDefaultsFormDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const title = "Daemon defaults";

  if (!runtime.live) {
    return (
      <SettingsCard title={title}>
        <OfflineNote />
      </SettingsCard>
    );
  }
  if (runtime.mode === "external" || !defaults.manageable) {
    return (
      <SettingsCard title={title}>
        <ExternalManagedNote />
      </SettingsCard>
    );
  }
  const status = runtime.status;
  const saved = defaults.defaults;
  if (!saved || !status) {
    return (
      <SettingsCard title={title}>
        {defaults.error ? (
          <p className="whitespace-pre-wrap text-sm text-destructive">
            {defaults.error}
          </p>
        ) : defaults.isLoading || runtime.status === null ? (
          <Note>Reading the daemon defaults…</Note>
        ) : (
          <Note>
            The controller did not report its daemon defaults. Restart Studio
            (task studio:dev) so the current controller is running.
          </Note>
        )}
      </SettingsCard>
    );
  }

  const kind = modelDefaultsKind(status);
  const savedDraft = draftFromDefaults(saved, kind);
  const view = draft ?? savedDraft;
  const dirty = JSON.stringify(view) !== JSON.stringify(savedDraft);
  const busy = defaults.busy;
  const patch = (next: Partial<DaemonDefaultsFormDraft>) => {
    setFormError(null);
    setDraft({ ...view, ...next });
  };
  const providerModels = kind
    ? runtime.models.filter((model) => model.providerId === kind && model.id)
    : [];
  const anthropicConfigured = status.configuredProviders.includes("anthropic");
  const providerLabel =
    KNOWN_AUTH_PROVIDERS.find((entry) => entry.name === kind)?.label ??
    (kind === "toolhive" ? "the ToolHive LLM gateway" : kind);

  const save = async () => {
    let document: HarnessDaemonDefaults;
    try {
      document = defaultsFromDraft(view, saved, kind);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : String(caught));
      return;
    }
    const confirmed = await confirm({
      title: "Save the daemon defaults?",
      description: `${RESTART_WARNING} A default model mecated does not list for ${providerLabel ?? "the active provider"} is refused at startup and the previous defaults are restored.`,
      confirmText: "Save and restart",
    });
    if (!confirmed) return;
    const ok = await defaults.save(document);
    if (ok) {
      setDraft(null);
      await runtime.refresh();
    }
  };

  return (
    <SettingsCard
      title={title}
      description="What mecated starts with when a session does not choose for itself. Spawn flags owned by Studio's controller — never written to settings.yaml, and effective even when an imported operator settings file drives the daemon."
    >
      <div className="flex flex-col gap-4">
        {defaults.error && (
          <p className="whitespace-pre-wrap text-sm text-destructive">
            {defaults.error}
          </p>
        )}
        {defaults.notice && (
          <p className="text-sm text-muted-foreground">{defaults.notice}</p>
        )}

        <div className="divide-y divide-border/60">
          {kind ? (
            <>
              <SettingsRow
                label="Default model"
                htmlFor="daemon-default-model"
                description={`The model every session on ${providerLabel} inherits when it does not pick one (--default-model). A model the daemon does not list for this provider is refused at startup.`}
              >
                <ModelSelect
                  id="daemon-default-model"
                  value={view.defaultModel}
                  noneLabel="Provider default"
                  models={providerModels}
                  onChange={(next) => patch({ defaultModel: next })}
                />
              </SettingsRow>
              <SettingsRow
                label="Subagent model"
                htmlFor="daemon-subagent-model"
                description="The model every Subagent, Parallel branch and team member runs on unless its definition or call pins one (--subagent-model). The Parallel judge stays on the session model."
              >
                <ModelSelect
                  id="daemon-subagent-model"
                  value={view.subagentModel}
                  noneLabel="Inherit the session model"
                  models={providerModels}
                  onChange={(next) => patch({ subagentModel: next })}
                />
              </SettingsRow>
            </>
          ) : (
            <div className="py-4 first:pt-0">
              <Note>
                The daemon is on the offline mock: set a provider as active
                above to choose its default and subagent model.
              </Note>
            </div>
          )}

          <SettingsRow
            label="Default reasoning effort"
            htmlFor="daemon-reasoning-effort"
            description="The operator tier every session starts from (--reasoning-effort). A session's own effort out-ranks it; OpenAI clamps xhigh and max down to high; a model without reasoning ignores it."
          >
            <Select
              value={view.reasoningEffort || NONE}
              onValueChange={(next) =>
                patch({ reasoningEffort: next === NONE ? "" : next })
              }
            >
              <SelectTrigger
                id="daemon-reasoning-effort"
                className="w-full sm:w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONING_EFFORTS.map((effort) => (
                  <SelectItem key={effort || NONE} value={effort || NONE}>
                    {EFFORT_LABELS[effort] ?? effort}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label="Context window override"
            htmlFor="daemon-context-window"
            description="Tokens. Sets the compaction trigger (80% of it) and the context meter for every model (--context-window-override). 0 or blank keeps the model's own window. A small value — below a few thousand tokens — forces the agent to compact on nearly every turn."
            className="[&>div:last-child]:w-full [&>div:last-child]:sm:max-w-xs"
          >
            <Input
              id="daemon-context-window"
              inputMode="numeric"
              pattern="[0-9]*"
              value={view.contextWindowOverride}
              onChange={(event) =>
                patch({ contextWindowOverride: event.target.value })
              }
              placeholder="0 (off)"
              autoComplete="off"
              className="font-mono"
            />
          </SettingsRow>

          <LlmTimeoutRows
            value={{
              perAttempt: view.llmPerAttemptTimeout,
              streamIdle: view.llmStreamIdleTimeout,
            }}
            onChange={(next) =>
              patch({
                llmPerAttemptTimeout: next.perAttempt,
                llmStreamIdleTimeout: next.streamIdle,
              })
            }
          />

          <SettingsRow
            label="Provider-side prompt caching"
            htmlFor="daemon-prompt-cache"
            description={
              view.promptCacheEnabled
                ? "On (mecated's default): every adapter reuses its provider's prompt cache across turns."
                : "Off (--no-prompt-cache): every adapter's cache dialect degrades to none — the pre-caching wire, byte for byte (ADR 0100). Long conversations cost more."
            }
          >
            <Switch
              id="daemon-prompt-cache"
              checked={view.promptCacheEnabled}
              onCheckedChange={(checked) =>
                patch({ promptCacheEnabled: checked })
              }
            />
          </SettingsRow>

          {anthropicConfigured && (
            <SettingsRow
              label="Anthropic cache TTL"
              htmlFor="daemon-anthropic-ttl"
              description="Stamped on every Anthropic ephemeral cache breakpoint (--anthropic-cache-ttl). Only Anthropic reads it."
            >
              <Select
                value={view.anthropicTtl || NONE}
                onValueChange={(next) =>
                  patch({ anthropicTtl: next === NONE ? "" : next })
                }
                disabled={!view.promptCacheEnabled}
              >
                <SelectTrigger
                  id="daemon-anthropic-ttl"
                  className="w-full sm:w-64"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_CACHE_TTLS.map((ttl) => (
                    <SelectItem key={ttl || NONE} value={ttl || NONE}>
                      {TTL_LABELS[ttl] ?? ttl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1 px-2"
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Advanced
          </Button>
          {advancedOpen && (
            <div id={advancedId} className="flex flex-col gap-5 pl-1">
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">
                  Base-URL overrides
                  <span className="block text-xs font-normal text-muted-foreground">
                    Route a built-in provider through your proxy or gateway
                    (--&lt;provider&gt;-base-url). HTTPS, or plain HTTP on
                    loopback. Blank keeps the provider&rsquo;s own endpoint.
                  </span>
                </legend>
                {BASE_URL_KINDS.map((urlKind) => {
                  const label =
                    KNOWN_AUTH_PROVIDERS.find((entry) => entry.name === urlKind)
                      ?.label ?? urlKind;
                  const id = `daemon-base-url-${urlKind}`;
                  return (
                    <div key={urlKind} className="flex flex-col gap-1.5">
                      <Label htmlFor={id}>{label} base URL</Label>
                      <Input
                        id={id}
                        value={view.baseUrls[urlKind] ?? ""}
                        onChange={(event) =>
                          patch({
                            baseUrls: {
                              ...view.baseUrls,
                              [urlKind]: event.target.value,
                            },
                          })
                        }
                        placeholder="https://gateway.example/v1"
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                      />
                    </div>
                  );
                })}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">
                  ToolHive LLM gateway
                  <span className="block text-xs font-normal text-muted-foreground">
                    mecated auto-detects a local ToolHive LLM proxy and
                    registers it as the &ldquo;toolhive&rdquo; provider (no key
                    needed). Unrelated to ToolHive MCP workload discovery.
                  </span>
                </legend>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="daemon-toolhive-enabled">
                    Detect the gateway
                    <span className="block text-xs font-normal text-muted-foreground">
                      Off passes --toolhive-llm=false (shared hosts). Cannot be
                      switched off while toolhive is the active provider.
                    </span>
                  </Label>
                  <Switch
                    id="daemon-toolhive-enabled"
                    checked={view.toolhiveEnabled}
                    onCheckedChange={(checked) =>
                      patch({ toolhiveEnabled: checked })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="daemon-toolhive-url">Proxy URL</Label>
                  <Input
                    id="daemon-toolhive-url"
                    value={view.toolhiveBaseUrl}
                    onChange={(event) =>
                      patch({ toolhiveBaseUrl: event.target.value })
                    }
                    placeholder={
                      status.toolhiveGateway?.baseURL ||
                      "http://127.0.0.1:14000/v1"
                    }
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!view.toolhiveEnabled}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Loopback only (--toolhive-llm-base-url). Blank reads the
                    proxy address from ToolHive&rsquo;s own config; an explicit
                    URL is always proxy mode.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="daemon-toolhive-mode">Routing mode</Label>
                  <Select
                    value={view.toolhiveMode}
                    onValueChange={(next) => patch({ toolhiveMode: next })}
                    disabled={!view.toolhiveEnabled}
                  >
                    <SelectTrigger id="daemon-toolhive-mode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOLHIVE_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {TOOLHIVE_MODE_LABELS[mode] ?? mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>

              <KeyValueEditor
                legend="Model aliases"
                hint="--model-alias name=model. An agent definition's model: <alias> resolves through these (then the built-in sonnet/opus/haiku aliases). Names: lower-case letters, digits, _ or -."
                keyLabel="Alias"
                valueLabel="Model id"
                keyPlaceholder="fast"
                valuePlaceholder="openai/gpt-4o-mini"
                addLabel="Add alias"
                rows={view.aliases}
                onChange={(rows) => patch({ aliases: rows })}
              />

              <KeyValueEditor
                legend="Model slots"
                hint="--model-slot slot=selector. Routes an internal call to its own model: compaction, ask-reviewer, guardrail; the tiers cheap, fast and reasoning give a slot its fallback. The router slot belongs to the Model router page."
                keyLabel="Slot"
                valueLabel="Model or alias"
                keyPlaceholder="compaction"
                valuePlaceholder="fast"
                addLabel="Add slot"
                rows={view.slots}
                onChange={(rows) => patch({ slots: rows })}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="daemon-api-key-file">Credentials file</Label>
                <Input
                  id="daemon-api-key-file"
                  value={view.apiKeyFile}
                  onChange={(event) =>
                    patch({ apiKeyFile: event.target.value })
                  }
                  placeholder={status.authFile}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
                <p className="break-all text-xs text-muted-foreground">
                  The path mecated reads provider keys from (--api-key-file); a
                  .yaml inside the daemon&rsquo;s mecatl config directory. Blank
                  keeps <code className="font-mono">{status.authFile}</code>.
                  The file&rsquo;s contents never reach Studio.
                </p>
              </div>
            </div>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="whitespace-pre-wrap text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <Note>
          Saving restarts the daemon: in-flight runs end and session ids die
          with it.
        </Note>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setDraft(null);
                setFormError(null);
              }}
              disabled={busy}
            >
              Discard
            </Button>
          )}
          <Button
            variant="action"
            className="rounded-full"
            disabled={!dirty || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {ConfirmDialog}
    </SettingsCard>
  );
}

/**
 * A model picker over the daemon's live inventory for one provider, with a
 * "not set" first choice. A saved id the inventory no longer lists stays
 * selectable (labelled as saved) so an older choice is visible, not
 * silently replaced.
 */
function ModelSelect({
  id,
  value,
  noneLabel,
  models,
  onChange,
}: {
  id: string;
  value: string;
  noneLabel: string;
  models: HarnessModel[];
  onChange: (next: string) => void;
}) {
  const listed = models.some((model) => model.id === value);
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
    >
      <SelectTrigger id={id} className="w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {value && !listed && (
          <SelectItem value={value}>{value} (saved, not listed)</SelectItem>
        )}
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.displayName}
            {model.displayName !== model.id && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {model.id}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ordered key→value rows with add/remove — the alias and slot editors. */
function KeyValueEditor({
  legend,
  hint,
  keyLabel,
  valueLabel,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  rows,
  onChange,
}: {
  legend: string;
  hint: string;
  keyLabel: string;
  valueLabel: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}) {
  const update = (index: number, next: Partial<KeyValueRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">
        {legend}
        <span className="block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      </legend>
      {rows.map((row, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional edits; a key edit must not remount the input
          key={index}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex min-w-32 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${legend}-${index}-key`} className="text-xs">
              {keyLabel}
            </Label>
            <Input
              id={`${legend}-${index}-key`}
              value={row.key}
              onChange={(event) => update(index, { key: event.target.value })}
              placeholder={keyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          <div className="flex min-w-40 flex-[2] flex-col gap-1.5">
            <Label htmlFor={`${legend}-${index}-value`} className="text-xs">
              {valueLabel}
            </Label>
            <Input
              id={`${legend}-${index}-value`}
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder={valuePlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label={`Remove ${keyLabel.toLowerCase()} ${row.key || index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit rounded-full"
        onClick={() => onChange([...rows, { key: "", value: "" }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </Button>
    </fieldset>
  );
}
