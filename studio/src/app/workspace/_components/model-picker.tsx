"use client";

/**
 * The model half of the composer's model + effort picker (the TUI's /models
 * surface): the daemon's live inventory as provider-qualified rows —
 * `provider · name`, capability glyphs (image input, reasoning), context
 * window — behind a type-to-filter box, under a `current:` header that names
 * the model in force and WHERE it came from (your pick / Studio default /
 * daemon default), with a ★ on the browser-local default for new chats and
 * an action to set or clear it (the ctrl+g analogue).
 *
 * The desktop list is a cmdk `Command` inside the Radix submenu — the shadcn
 * "combobox in a dropdown" shape — because a bare text input fights Radix's
 * roving focus and typeahead: cmdk owns arrow/Enter/Home/End from the input
 * and the submenu holds no Radix items, so Radix's typeahead has nothing to
 * steal focus for. Escape is two-stage like the TUI: a non-empty filter
 * clears first (`onEscapeKeyDown` on the submenu — Radix listens on the
 * document in the capture phase, so the input itself cannot intercept it),
 * an empty one lets Radix close the menu.
 */

import { Brain, Check, ImageIcon, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { formatContextWindow } from "@/lib/formatters";
import { type DefaultModel, useDefaultModel } from "@/lib/model-preferences";
import { cn } from "@/lib/utils";
import type { ComposerModelOption } from "./chat-input";
import {
  isDefaultOption,
  type ModelProvenance,
  modelProvenanceLabel,
} from "./draft-model";

/** The live-chat note above the rows (a pick forks, like an effort switch). */
export const MODEL_SWITCH_NOTE =
  "Picking a model continues this chat in a copy on it.";

/** Shown in place of the rows when the filter matches nothing. */
export const NO_MODELS_MATCH = "No models match";

/** The filter box's accessible name (desktop and mobile alike). */
export const FILTER_MODELS_LABEL = "Filter models";

/**
 * Case-insensitive substring filter over provider id, model id and display
 * name; an empty (or whitespace) query keeps every row. Callers pass the
 * real models only — the auto row is pinned above the list, not filtered.
 */
export function filterModelOptions(
  options: readonly ComposerModelOption[],
  query: string,
): ComposerModelOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter((option) =>
    [option.providerId ?? "", option.id, option.label].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

/** cmdk selection value for a row: provider-qualified so the same model id
 *  on two providers stays two rows; the auto row has a fixed sentinel. */
const AUTO_VALUE = "__auto__";
function optionValue(option: ComposerModelOption): string {
  return option.id === ""
    ? AUTO_VALUE
    : `${option.providerId ?? ""}/${option.id}`;
}

/** The provenance header: `current: {label} — {your pick|Studio default|daemon default}`. */
function CurrentModelHeader({
  label,
  provenance,
  className,
}: {
  label: string;
  provenance: ModelProvenance;
  className?: string;
}) {
  return (
    <p
      data-testid="model-picker-current"
      className={cn(
        "flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="shrink-0">current: </span>
      <span className="truncate font-medium text-foreground">{label}</span>
      <span className="shrink-0"> — {modelProvenanceLabel(provenance)}</span>
    </p>
  );
}

/**
 * One row's body: `provider · name` (mono provider), the ★ default marker,
 * then the trailing capability glyphs, context window and current checkmark.
 * The auto row (id "") has no provider, glyphs or window — label only.
 */
function ModelOptionBody({
  option,
  isDefault,
  isCurrent,
}: {
  option: ComposerModelOption;
  isDefault: boolean;
  isCurrent: boolean;
}) {
  const context = formatContextWindow(option.contextLimit ?? 0);
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {option.providerId ? (
          <>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {option.providerId}
            </span>
            <span aria-hidden="true" className="text-muted-foreground/60">
              ·
            </span>
          </>
        ) : null}
        <span className="truncate font-medium">{option.label}</span>
        {isDefault && (
          <Star
            role="img"
            aria-label="Your default for new chats"
            className="size-3.5 shrink-0 fill-current text-warning"
          />
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {option.image && (
          <ImageIcon
            role="img"
            aria-label="Accepts images"
            className="size-3.5"
          />
        )}
        {option.reasoning && (
          <Brain role="img" aria-label="Reasoning" className="size-3.5" />
        )}
        {context && <span className="font-mono text-xs">{context}</span>}
        <Check
          className={cn(
            "size-4 shrink-0",
            isCurrent ? "text-foreground" : "text-transparent",
          )}
        />
      </span>
    </>
  );
}

/** The set/clear label for the default action aimed at `option`. */
function defaultActionLabel(
  option: ComposerModelOption | null,
  studioDefault: DefaultModel | null,
): string | null {
  if (option && option.id !== "" && option.providerId) {
    return isDefaultOption(option, studioDefault)
      ? "Clear my default"
      : `Set ${option.label} as my default`;
  }
  return studioDefault ? "Clear my default" : null;
}

export interface ModelPickerListProps {
  /** Every option, the auto row (id "") first. */
  options: readonly ComposerModelOption[];
  /** The model in force ("" = auto): the live session's, or the draft's
   *  resolved pick, for the checkmark. */
  selectedId: string;
  /** Label of the model in force, for the header. */
  currentLabel: string;
  provenance: ModelProvenance;
  /** Live chat: a pick forks; the note above the rows says so. */
  live: boolean;
  onPick: (option: ComposerModelOption) => void;
}

/**
 * The desktop Model submenu — renders the `DropdownMenuSubContent` itself so
 * it can own the filter state the two-stage Escape needs.
 */
export function ModelSubmenuContent({
  options,
  selectedId,
  currentLabel,
  provenance,
  live,
  onPick,
}: ModelPickerListProps) {
  const [filter, setFilter] = useState("");
  const { defaultModel, setDefaultModel, clearDefaultModel } =
    useDefaultModel();
  const auto = options.find((option) => option.id === "") ?? null;
  const real = options.filter((option) => option.id !== "");
  const rows = filterModelOptions(real, filter);
  const visible = auto ? [auto, ...rows] : rows;
  const selectedOption = options.find((option) => option.id === selectedId);
  // cmdk's highlighted row (its "value"), controlled so the footer action
  // and Shift+Enter know which model they aim at; starts on the current one.
  const [highlighted, setHighlighted] = useState(() =>
    selectedOption ? optionValue(selectedOption) : "",
  );
  const highlightedOption =
    visible.find((option) => optionValue(option) === highlighted) ?? null;
  const inputRef = useRef<HTMLInputElement>(null);

  // Radix focuses the submenu container for keyboard users AFTER the
  // input's own autoFocus; take the focus back a frame later so typing
  // always lands in the filter.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleDefault = (option: ComposerModelOption | null) => {
    if (option && option.id !== "" && option.providerId) {
      if (isDefaultOption(option, defaultModel)) clearDefaultModel();
      else
        setDefaultModel({ modelId: option.id, providerId: option.providerId });
    } else if (defaultModel) {
      clearDefaultModel();
    }
    inputRef.current?.focus();
  };
  const actionLabel = defaultActionLabel(highlightedOption, defaultModel);

  return (
    <DropdownMenuSubContent
      className="w-[26rem] max-w-[calc(100vw-2rem)] p-0"
      onEscapeKeyDown={(event) => {
        // Two-stage Escape: clear a filter first, close only when empty.
        if (filter) {
          event.preventDefault();
          setFilter("");
        }
      }}
    >
      <Command
        shouldFilter={false}
        loop
        label={FILTER_MODELS_LABEL}
        value={highlighted}
        onValueChange={setHighlighted}
        className="rounded-none bg-transparent"
        onKeyDown={(event) => {
          // The ctrl+g analogue: Shift+Enter marks the highlighted row as
          // the default instead of picking it.
          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            toggleDefault(highlightedOption);
          }
        }}
      >
        <CommandInput
          ref={inputRef}
          autoFocus
          value={filter}
          onValueChange={setFilter}
          placeholder={FILTER_MODELS_LABEL}
          aria-label={FILTER_MODELS_LABEL}
          onKeyDown={(event) => {
            // With text in the box the horizontal keys move the caret; keep
            // them from Radix, whose ArrowLeft would close the submenu.
            if (
              filter &&
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.stopPropagation();
            }
          }}
        />
        <div className="space-y-1 px-3 pt-2 pb-1">
          <CurrentModelHeader label={currentLabel} provenance={provenance} />
          {live && (
            <p className="text-xs text-muted-foreground">{MODEL_SWITCH_NOTE}</p>
          )}
        </div>
        <CommandList className="max-h-72 p-1">
          {visible.map((option) => {
            const isCurrent = option.id === selectedId;
            return (
              <CommandItem
                key={optionValue(option)}
                value={optionValue(option)}
                data-current={isCurrent || undefined}
                onSelect={() => onPick(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  isCurrent && "bg-zinc-100 dark:bg-zinc-800",
                )}
              >
                <ModelOptionBody
                  option={option}
                  isDefault={isDefaultOption(option, defaultModel)}
                  isCurrent={isCurrent}
                />
              </CommandItem>
            );
          })}
          {rows.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {NO_MODELS_MATCH}
            </p>
          )}
        </CommandList>
        {actionLabel && (
          <div className="flex items-center justify-end border-t px-3 py-2">
            <button
              type="button"
              title="Shift+Enter"
              onClick={() => toggleDefault(highlightedOption)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </Command>
    </DropdownMenuSubContent>
  );
}

/**
 * The mobile picker sheet's Model section: heading, live note, the header,
 * a filter box, one tappable row per model with a trailing ★ toggle for the
 * default, and the same "No models match" empty state.
 */
export function ModelSheetSection({
  options,
  selectedId,
  currentLabel,
  provenance,
  live,
  onPick,
}: ModelPickerListProps) {
  const [filter, setFilter] = useState("");
  const { defaultModel, setDefaultModel, clearDefaultModel } =
    useDefaultModel();
  const auto = options.find((option) => option.id === "") ?? null;
  const real = options.filter((option) => option.id !== "");
  const rows = filterModelOptions(real, filter);
  const visible = auto ? [auto, ...rows] : rows;

  return (
    <>
      <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
        Model
      </p>
      {live && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">
          {MODEL_SWITCH_NOTE}
        </p>
      )}
      <CurrentModelHeader
        label={currentLabel}
        provenance={provenance}
        className="px-4 pb-2"
      />
      <div className="px-4 pb-2">
        <InputSearch
          value={filter}
          onChange={setFilter}
          placeholder={FILTER_MODELS_LABEL}
          aria-label={FILTER_MODELS_LABEL}
          className="w-full"
        />
      </div>
      {visible.map((option) => {
        const isCurrent = option.id === selectedId;
        const isDefault = isDefaultOption(option, defaultModel);
        const canDefault = option.id !== "" && Boolean(option.providerId);
        return (
          <div key={optionValue(option)} className="flex items-stretch">
            <button
              type="button"
              onClick={() => onPick(option)}
              aria-current={isCurrent || undefined}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <ModelOptionBody
                option={option}
                isDefault={isDefault}
                isCurrent={isCurrent}
              />
            </button>
            {canDefault && (
              <button
                type="button"
                onClick={() =>
                  isDefault
                    ? clearDefaultModel()
                    : setDefaultModel({
                        modelId: option.id,
                        providerId: option.providerId ?? "",
                      })
                }
                aria-label={
                  isDefault
                    ? "Clear my default"
                    : `Set ${option.label} as my default`
                }
                aria-pressed={isDefault}
                className="flex shrink-0 items-center px-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Star
                  className={cn(
                    "size-4",
                    isDefault && "fill-current text-warning",
                  )}
                />
              </button>
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="px-4 py-4 text-center text-sm text-muted-foreground">
          {NO_MODELS_MATCH}
        </p>
      )}
    </>
  );
}
