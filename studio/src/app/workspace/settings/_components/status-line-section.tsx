"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { StatusTemplateText } from "@/app/workspace/chat/_components/templated-status-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/use-confirm";
import { copyToClipboard } from "@/lib/clipboard";
import { SAMPLE_STATUS_FACTS, STATUS_FACT_KEYS } from "@/lib/statusline/facts";
import {
  STATUS_INTERVAL_MAX_SECONDS,
  STATUS_INTERVAL_MIN_SECONDS,
  STATUS_SURFACES,
  STATUS_TEMPLATE_MAX_CHARS,
  STATUS_VARIANTS,
  type StatusSurface,
  type StatusVariant,
  type SurfaceTemplates,
  serializeStatusLinePreferences,
  useStatusLinePreferences,
  validateStatusLinePreferences,
} from "@/lib/statusline/preferences";
import { SettingsCard, SettingsRow } from "./settings-card";

/**
 * Settings → Status line: mecatui's `status_customization` templates +
 * interval, for the browser. Two lanes (the chat header's right segment and
 * the strip above the composer), each with three width variants, edited as
 * plain text with `{{fact}}` placeholders and previewed live over sample
 * facts. Stored in this browser; the JSON export/import is how it travels to
 * another one.
 */

const SURFACE_LABEL: Record<StatusSurface, string> = {
  header: "Header",
  footer: "Footer",
};

const SURFACE_HINT: Record<StatusSurface, string> = {
  header:
    "The right-hand segment of the chat's title row. Empty by default — nothing shows until you add a template.",
  footer:
    "The strip above the composer. By default it is the shipped context meter ({{context_meter}}).",
};

const VARIANT_LABEL: Record<StatusVariant, string> = {
  full: "Full",
  compact: "Compact",
  minimal: "Minimal",
};

const VARIANT_HINT: Record<StatusVariant, string> = {
  full: "when the lane is wider than 448 px",
  compact: "when the lane is 320–448 px wide",
  minimal: "when the lane is narrower than 320 px",
};

/** A fixed instant so the previews read the same on every visit. */
const PREVIEW_NOW = new Date(2026, 0, 5, 9, 41, 7);

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
      {children}
    </code>
  );
}

function SurfaceEditor({
  surface,
  templates,
  onChange,
}: {
  surface: StatusSurface;
  templates: SurfaceTemplates;
  onChange: (variant: StatusVariant, text: string) => void;
}) {
  // The fact chips insert into the most recently focused template of this
  // lane (Full until one is focused), at its caret.
  const [active, setActive] = useState<StatusVariant>("full");
  const fields = useRef<Record<StatusVariant, HTMLTextAreaElement | null>>({
    full: null,
    compact: null,
    minimal: null,
  });
  const pendingCaret = useRef<{ variant: StatusVariant; pos: number } | null>(
    null,
  );

  // After an insert lands in the store, put the caret after the placeholder.
  useEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pendingCaret.current = null;
    const field = fields.current[pending.variant];
    if (!field) return;
    field.focus();
    field.setSelectionRange(pending.pos, pending.pos);
  });

  function insert(key: string) {
    const field = fields.current[active];
    const value = templates[active];
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const snippet = `{{${key}}}`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    if (next.length > STATUS_TEMPLATE_MAX_CHARS) {
      toast.error(
        `A template is at most ${STATUS_TEMPLATE_MAX_CHARS} characters`,
      );
      return;
    }
    pendingCaret.current = { variant: active, pos: start + snippet.length };
    onChange(active, next);
  }

  const label = SURFACE_LABEL[surface];
  return (
    <section
      aria-labelledby={`status-line-${surface}-heading`}
      className="space-y-3"
    >
      <div className="space-y-0.5">
        <h3
          id={`status-line-${surface}-heading`}
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </h3>
        <p className="text-xs text-muted-foreground">{SURFACE_HINT[surface]}</p>
      </div>
      {STATUS_VARIANTS.map((variant) => {
        const id = `status-line-${surface}-${variant}`;
        const template = templates[variant];
        return (
          <div key={variant} className="space-y-1">
            <Label htmlFor={id} className="text-xs">
              {VARIANT_LABEL[variant]}
              <span className="ml-1 font-normal text-muted-foreground">
                — {VARIANT_HINT[variant]}
              </span>
            </Label>
            <Textarea
              id={id}
              ref={(el) => {
                fields.current[variant] = el;
              }}
              aria-label={`${label} ${VARIANT_LABEL[variant].toLowerCase()} template`}
              rows={1}
              value={template}
              maxLength={STATUS_TEMPLATE_MAX_CHARS}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onChange(variant, e.target.value)}
              onFocus={() => setActive(variant)}
              className="min-h-9 font-mono text-xs md:text-xs"
            />
            <div
              data-testid={`${id}-preview`}
              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
            >
              <span className="shrink-0 select-none">Preview:</span>
              {template.trim() === "" ? (
                <span className="italic">nothing — the lane stays hidden</span>
              ) : (
                <StatusTemplateText
                  template={template}
                  facts={SAMPLE_STATUS_FACTS}
                  now={PREVIEW_NOW}
                  className="min-w-0 truncate text-foreground"
                />
              )}
            </div>
          </div>
        );
      })}
      <div>
        <p className="mb-1 text-xs text-muted-foreground">
          Insert a fact into the {VARIANT_LABEL[active]} template:
        </p>
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
          <legend className="sr-only">Facts for the {label} lane</legend>
          {STATUS_FACT_KEYS.map((fact) => (
            <button
              key={fact.key}
              type="button"
              title={`${fact.label} — e.g. ${fact.example}`}
              aria-label={`Insert {{${fact.key}}} into the ${VARIANT_LABEL[active]} ${label} template`}
              onClick={() => insert(fact.key)}
              className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {`{{${fact.key}}}`}
            </button>
          ))}
        </fieldset>
      </div>
    </section>
  );
}

export function StatusLineSection() {
  const {
    prefs,
    setTemplate,
    setIntervalSeconds,
    importPreferences,
    reset,
    isDefault,
  } = useStatusLinePreferences();
  const { confirm, ConfirmDialog } = useConfirm();

  // The interval is typed freely and committed (clamped) on blur/Enter, so
  // clearing the field to type a new value does not snap to the minimum.
  const [intervalDraft, setIntervalDraft] = useState(
    String(prefs.intervalSeconds),
  );
  useEffect(() => {
    setIntervalDraft(String(prefs.intervalSeconds));
  }, [prefs.intervalSeconds]);
  function commitInterval() {
    const parsed = Number.parseInt(intervalDraft, 10);
    if (Number.isNaN(parsed)) {
      setIntervalDraft(String(prefs.intervalSeconds));
      return;
    }
    setIntervalSeconds(parsed);
  }

  // The JSON export mirrors the store until someone edits it; Apply parses
  // it strictly and reports every problem instead of silently repairing.
  const serialized = serializeStatusLinePreferences(prefs);
  const [jsonDraft, setJsonDraft] = useState(serialized);
  const [jsonDirty, setJsonDirty] = useState(false);
  const [jsonError, setJsonError] = useState("");
  useEffect(() => {
    if (!jsonDirty) setJsonDraft(serialized);
  }, [serialized, jsonDirty]);
  function applyJson() {
    const result = validateStatusLinePreferences(jsonDraft);
    if (!result.ok) {
      setJsonError(result.error);
      return;
    }
    setJsonError("");
    setJsonDirty(false);
    importPreferences(result.prefs);
    toast.success("Status line settings applied");
  }

  async function onReset() {
    const ok = await confirm({
      title: "Reset the status line?",
      description:
        "Both lanes go back to their defaults: an empty header and the shipped context meter in the footer. Only this browser is affected.",
      confirmText: "Reset",
    });
    if (!ok) return;
    reset();
    setJsonDirty(false);
    setJsonError("");
    toast.success("Status line reset to defaults");
  }

  return (
    <>
      <SettingsCard
        title="Status line"
        description="Two lanes over the live session — the chat header's right segment and the strip above the composer. Plain text with {{fact}} placeholders, stored in this browser."
      >
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Each lane has three variants and shows the richest one that fits its
            width. Templates are text, never markup: <Code>&lt;b&gt;</Code>{" "}
            stays literal. <Code>{"{{fact}}"}</Code> renders a human-readable
            value, <Code>{"{{fact|raw}}"}</Code> the exact one, and{" "}
            <Code>{"{{clock|HH:mm:ss}}"}</Code> formats the clock.{" "}
            <Code>{"{{context_meter}}"}</Code> is Studio&rsquo;s shipped meter
            (model, bar and token counts); <Code>{"{{context_bar}}"}</Code> is
            just its bar.
          </p>
          {STATUS_SURFACES.map((surface) => (
            <SurfaceEditor
              key={surface}
              surface={surface}
              templates={prefs[surface]}
              onChange={(variant, text) => setTemplate(surface, variant, text)}
            />
          ))}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">
              Every fact and what it shows
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/60">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Placeholder
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      Shows
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      Example
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_FACT_KEYS.map((fact) => (
                    <tr key={fact.key} className="border-b border-border/40">
                      <td className="py-1 pr-3 font-mono">{`{{${fact.key}}}`}</td>
                      <td className="py-1 pr-3">{fact.label}</td>
                      <td className="py-1">{fact.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Refresh and portability"
        description="How often the clock ticks, and how to carry these settings to another browser."
      >
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Refresh interval (seconds)"
            htmlFor="status-line-interval"
            description={`Only affects {{clock}} and {{date}}. ${STATUS_INTERVAL_MIN_SECONDS}–${STATUS_INTERVAL_MAX_SECONDS}; below 5 the header and footer re-render every tick.`}
          >
            <Input
              id="status-line-interval"
              type="number"
              inputMode="numeric"
              min={STATUS_INTERVAL_MIN_SECONDS}
              max={STATUS_INTERVAL_MAX_SECONDS}
              step={1}
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value)}
              onBlur={commitInterval}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitInterval();
                }
              }}
              className="w-24 tabular-nums"
            />
          </SettingsRow>
          <div className="space-y-2 py-4">
            <Label htmlFor="status-line-json" className="text-sm font-medium">
              Copy to another browser
            </Label>
            <p className="max-w-md text-xs text-muted-foreground">
              These settings live in this browser only. Copy the JSON below and
              paste it on another device, then Apply. Unknown keys and over-long
              templates are refused, never silently dropped.
            </p>
            <Textarea
              id="status-line-json"
              value={jsonDraft}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={jsonError ? true : undefined}
              aria-describedby={
                jsonError ? "status-line-json-error" : undefined
              }
              onChange={(e) => {
                setJsonDraft(e.target.value);
                setJsonDirty(true);
                setJsonError("");
              }}
              className="min-h-32 font-mono text-xs md:text-xs"
            />
            {jsonError && (
              <p
                id="status-line-json-error"
                role="alert"
                className="text-xs text-destructive"
              >
                Not applied: {jsonError}.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyToClipboard(serialized, "Status line settings")
                }
              >
                Copy JSON
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!jsonDirty}
                onClick={applyJson}
              >
                Apply JSON
              </Button>
            </div>
          </div>
          <SettingsRow
            label="Reset to defaults"
            description="An empty header lane and the shipped context meter in the footer."
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDefault}
              onClick={() => void onReset()}
            >
              Reset
            </Button>
          </SettingsRow>
        </div>
      </SettingsCard>
      {ConfirmDialog}
    </>
  );
}
