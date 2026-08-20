"use client";

import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

interface DraftCategory {
  /** Stable react key — tier names are editable, so they cannot key the list. */
  key: string;
  name: string;
  description: string;
  model: string;
}

/**
 * Validation mirrors the controller's own rules so a mistake surfaces here
 * rather than after a daemon restart has already been attempted.
 */
function routingProblem(draft: {
  classifierModel: string;
  defaultCategory: string;
  categories: DraftCategory[];
}): string | null {
  if (!draft.classifierModel.trim()) return "Choose a classifier model.";
  if (draft.categories.length < 2 || draft.categories.length > 8) {
    return "Routing needs between 2 and 8 categories.";
  }
  const seen = new Set<string>();
  for (const category of draft.categories) {
    const name = category.name.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name)) {
      return `"${category.name || "(unnamed)"}" is not a valid category name — start with a letter, then letters, numbers, dashes or underscores.`;
    }
    if (seen.has(name)) return `Category "${name}" is duplicated.`;
    seen.add(name);
    if (!category.description.trim() || category.description.length > 300) {
      return `Category "${name}" needs a distinct description of at most 300 characters — it is what the classifier matches on.`;
    }
    if (!category.model.trim()) return `Category "${name}" needs a model.`;
  }
  if (!seen.has(draft.defaultCategory.trim().toLowerCase())) {
    return "The default category must be one of the categories above.";
  }
  return null;
}

function ModelSelect({
  id,
  value,
  onChange,
  models,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  models: { id: string; displayName: string }[];
  placeholder: string;
}) {
  // A saved model can fall out of the inventory (provider changed since the
  // save); keep it selectable so opening the form doesn't silently blank it.
  const options =
    !value || models.some((model) => model.id === value)
      ? models
      : [{ id: value, displayName: value }, ...models];
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full font-mono">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((model) => (
          <SelectItem key={model.id} value={model.id} className="font-mono">
            {model.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Editor for the semantic model router: a small classifier reads each prompt
 * and picks a category, so cheap work lands on a cheap model without the user
 * choosing per message. The daemon owns this config — the draft is seeded from
 * it once edited and discarded on save, so the form never diverges from what
 * is actually running.
 */
export function ModelRouterSection({ runtime }: { runtime: Runtime }) {
  const router = runtime.router;
  // Router categories must resolve through the gateway's inventory; other
  // providers' entries would name models the daemon cannot route to.
  const models = runtime.models.filter(
    (model) => model.providerId === "toolhive" && model.id,
  );

  const keyCounter = useRef(0);
  const nextKey = () => {
    keyCounter.current += 1;
    return `new-${keyCounter.current}`;
  };

  const [draft, setDraft] = useState<{
    enabled: boolean;
    classifierModel: string;
    defaultCategory: string;
    categories: DraftCategory[];
  } | null>(null);

  const editing = draft !== null;
  const view = draft ?? {
    enabled: router?.enabled ?? false,
    classifierModel: router?.classifierModel ?? "",
    defaultCategory: router?.defaultCategory ?? "",
    categories: (router?.categories ?? []).map((category, index) => ({
      key: `saved-${index}`,
      ...category,
    })),
  };
  const problem = editing ? routingProblem(view) : null;

  const patch = (next: Partial<typeof view>) =>
    setDraft((prev) => ({ ...(prev ?? view), ...next }));

  const patchCategory = (key: string, next: Partial<DraftCategory>) =>
    patch({
      categories: view.categories.map((category) =>
        category.key === key ? { ...category, ...next } : category,
      ),
    });

  if (!runtime.live) {
    return (
      <SettingsCard title="Model router">
        <OfflineNote />
      </SettingsCard>
    );
  }

  if (runtime.mode === "external") {
    return (
      <SettingsCard title="Model router">
        <div className="flex flex-col gap-2">
          {runtime.status?.modelRouter ? (
            <p className="text-sm">
              Routing is{" "}
              <strong>
                {runtime.status.modelRouter.enabled ? "enabled" : "disabled"}
              </strong>{" "}
              with {runtime.status.modelRouter.categories} categor
              {runtime.status.modelRouter.categories === 1 ? "y" : "ies"}.
            </p>
          ) : null}
          <ExternalManagedNote />
        </div>
      </SettingsCard>
    );
  }

  if (router?.managedByOperator) {
    return (
      <SettingsCard title="Model router">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Managed by an operator settings file
          </p>
          <Note>
            This daemon was started with an imported settings file that owns
            routing along with its aliases, slots and guardrails. Saving from
            here would drop those, so the controller refuses it — change the
            settings file instead. The current categories are shown below.
          </Note>
          <div className="flex flex-col gap-2">
            {(router?.categories ?? []).map((category) => (
              <div key={category.name} className="rounded-lg border p-4">
                <p className="font-mono text-sm font-medium">{category.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {category.model || "no model pinned"}
                </p>
                {category.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Model router">
      <div className="flex flex-col gap-4">
        <SettingsRow
          label={`Semantic routing ${view.enabled ? "on" : "off"}`}
          htmlFor="routing-enabled"
          description="A small classifier reads each prompt and picks a category, so cheap work lands on a cheap model."
          className="py-0"
        >
          <Switch
            id="routing-enabled"
            checked={view.enabled}
            onCheckedChange={(checked) => patch({ enabled: checked })}
            aria-label="Enable semantic model routing"
          />
        </SettingsRow>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routing-classifier">Classifier model</Label>
            <ModelSelect
              id="routing-classifier"
              value={view.classifierModel}
              onChange={(next) => patch({ classifierModel: next })}
              models={models}
              placeholder="a small, fast model"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routing-default">Default category</Label>
            <Select
              value={view.defaultCategory || undefined}
              onValueChange={(next) => patch({ defaultCategory: next })}
            >
              <SelectTrigger id="routing-default" className="w-full">
                <SelectValue placeholder="Choose a category…" />
              </SelectTrigger>
              <SelectContent>
                {view.categories
                  .filter((category) => category.name.trim())
                  .map((category) => (
                    <SelectItem key={category.key} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Categories ({view.categories.length})
          </h3>
          {view.categories.length < 8 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                patch({
                  categories: [
                    ...view.categories,
                    { key: nextKey(), name: "", description: "", model: "" },
                  ],
                })
              }
            >
              Add category
            </Button>
          )}
        </div>

        {view.categories.length === 0 ? (
          <Note>
            No categories configured — routing is off until at least two exist.
          </Note>
        ) : (
          view.categories.map((category) => (
            <div
              key={category.key}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`category-name-${category.key}`}>Name</Label>
                  <Input
                    id={`category-name-${category.key}`}
                    value={category.name}
                    onChange={(event) =>
                      patchCategory(category.key, {
                        name: event.target.value,
                      })
                    }
                    placeholder="routine"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`category-model-${category.key}`}>
                    Model
                  </Label>
                  <ModelSelect
                    id={`category-model-${category.key}`}
                    value={category.model}
                    onChange={(next) =>
                      patchCategory(category.key, { model: next })
                    }
                    models={models}
                    placeholder="Choose a model…"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`category-desc-${category.key}`}>
                  What belongs in this category
                </Label>
                <Textarea
                  id={`category-desc-${category.key}`}
                  value={category.description}
                  onChange={(event) =>
                    patchCategory(category.key, {
                      description: event.target.value,
                    })
                  }
                  placeholder="Mechanical edits, quick lookups, formatting…"
                  className="min-h-16 text-sm"
                />
              </div>
              {view.categories.length > 2 && (
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      patch({
                        categories: view.categories.filter(
                          (candidate) => candidate.key !== category.key,
                        ),
                      })
                    }
                  >
                    Remove category
                  </Button>
                </div>
              )}
            </div>
          ))
        )}

        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Saving restarts the daemon and invalidates in-flight sessions.
          </p>
          <div className="flex gap-2">
            {editing && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setDraft(null)}
              >
                Discard changes
              </Button>
            )}
            <Button
              variant="action"
              disabled={
                !editing || problem !== null || runtime.busy === "router"
              }
              onClick={async () => {
                await runtime.saveRouter({
                  enabled: view.enabled,
                  classifierModel: view.classifierModel.trim(),
                  defaultCategory: view.defaultCategory.trim().toLowerCase(),
                  categories: view.categories.map((category) => ({
                    name: category.name.trim().toLowerCase(),
                    description: category.description.trim(),
                    model: category.model.trim(),
                  })),
                });
                setDraft(null);
              }}
            >
              {runtime.busy === "router" ? "Saving…" : "Save routing"}
            </Button>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
