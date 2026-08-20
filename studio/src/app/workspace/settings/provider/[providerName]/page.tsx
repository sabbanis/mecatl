"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  directed,
  SortableHead,
  useTableSort,
} from "@/components/sortable-head";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type HarnessModel,
  useHarnessRuntime,
} from "@/features/agent/hooks/use-harness-runtime";
import { useDisabledModels } from "@/lib/model-preferences";
import { cn } from "@/lib/utils";
import {
  Note,
  OfflineNote,
  SettingsCard,
} from "../../_components/settings-card";

/** "128000" → "128k"; 0 stays an honest em dash (window unknown). */
function formatContext(tokens: number): string {
  if (tokens <= 0) return "—";
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}

/**
 * One provider's models from the daemon's live inventory (`GET /v1/models`,
 * filtered by provider id), with a per-model switch. HONEST SCOPE (see
 * model-preferences.ts): the daemon has no per-model disable knob — the
 * operator `models.allowlist` caps project-tier model BINDINGS, not the
 * inventory — so the switch is a Studio-side preference that hides the model
 * from Studio's own pickers. Other clients can still ask the daemon for it,
 * and the note below the table says so.
 */
export default function ProviderModelsPage() {
  const params = useParams<{ providerName: string }>();
  const providerName = decodeURIComponent(params.providerName ?? "");
  const runtime = useHarnessRuntime();
  const { disabled, setModelEnabled } = useDisabledModels();
  const sort = useTableSort<"name" | "id" | "context" | "enabled">("name");

  const models = useMemo(
    () =>
      runtime.models.filter(
        (model) => model.providerId === providerName && model.id,
      ),
    [runtime.models, providerName],
  );

  const sorted = useMemo(() => {
    const primary = (a: HarnessModel, b: HarnessModel) => {
      switch (sort.key) {
        case "id":
          return a.id.localeCompare(b.id);
        case "context":
          return a.contextLimit - b.contextLimit;
        case "enabled":
          return Number(disabled.has(b.id)) - Number(disabled.has(a.id));
        default:
          return a.displayName.localeCompare(b.displayName);
      }
    };
    // Display name stays the direction-independent tiebreak for stability.
    return [...models].sort(
      (a, b) =>
        directed(sort.dir, primary(a, b)) ||
        a.displayName.localeCompare(b.displayName),
    );
  }, [models, sort.key, sort.dir, disabled]);

  return (
    <>
      <Link
        href="/workspace/settings/provider"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All providers
      </Link>
      <SettingsCard
        title={`${providerName} models`}
        description="The daemon's live inventory for this provider. Switching a model off hides it from Studio's pickers only — the daemon can still be asked for it by other clients."
      >
        {!runtime.live ? (
          <OfflineNote />
        ) : models.length === 0 ? (
          <Note>
            {runtime.isLoading
              ? "Reading the model inventory…"
              : `The daemon lists no models for “${providerName}”. A provider added to auth.yaml surfaces its models after a daemon restart.`}
          </Note>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHead label="Model" sortKey="name" sort={sort} />
                  <SortableHead
                    label="Context"
                    sortKey="context"
                    sort={sort}
                    className="w-px whitespace-nowrap"
                  />
                  <TableHead className="w-px whitespace-nowrap">
                    Capabilities
                  </TableHead>
                  <SortableHead
                    label="Enabled"
                    sortKey="enabled"
                    sort={sort}
                    className="w-px whitespace-nowrap"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((model) => {
                  const enabled = !disabled.has(model.id);
                  return (
                    <TableRow
                      key={model.id}
                      className={cn(!enabled && "opacity-60")}
                    >
                      <TableCell className="max-w-0">
                        <p className="truncate text-sm font-medium">
                          {model.displayName}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {model.id}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatContext(model.contextLimit)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {[
                          model.image ? "image" : "",
                          model.reasoning ? "reasoning" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "text"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(next) =>
                            setModelEnabled(model.id, next)
                          }
                          aria-label={`Show ${model.displayName} in Studio's model pickers`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsCard>
    </>
  );
}
