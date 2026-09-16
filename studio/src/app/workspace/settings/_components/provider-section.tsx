"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { useDaemonDefaults } from "@/features/agent/hooks/use-daemon-defaults";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import type {
  ProviderKeyHealth,
  useProviderManagement,
} from "@/features/agent/hooks/use-provider-management";
import type { useProviderStatus } from "@/features/agent/hooks/use-provider-status";
import type {
  HarnessProviderInfo,
  HarnessProviderRemovalScope,
  HarnessProviderStatus,
} from "@/lib/harness/client";
import { cn } from "@/lib/utils";
import { AddProviderDialog } from "./add-provider-dialog";
import {
  AvailableProviderKinds,
  DaemonProviderStatusList,
  groupProviderRows,
  NoProvidersNote,
  ProviderRowDetails,
  ToolhiveGatewayRow,
} from "./provider-inventory";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
} from "./settings-card";
import { SwitchToMockButton } from "./switch-to-mock-button";

type Runtime = ReturnType<typeof useHarnessRuntime>;
type Management = ReturnType<typeof useProviderManagement>;
type DaemonDefaults = ReturnType<typeof useDaemonDefaults>;
type ProviderStatus = ReturnType<typeof useProviderStatus>;

/** Dot color + label for a row's key health. Green = a test passed, red =
 *  the provider rejected the key, amber = the test could not complete, gray
 *  = untested (or no key in the block yet). */
function healthPresentation(
  row: HarnessProviderInfo,
  health: ProviderKeyHealth | undefined,
): { dot: string; label: string; detail?: string } {
  if (!row.keyPresent) {
    return { dot: "bg-muted-foreground/50", label: "no key in block" };
  }
  switch (health?.state) {
    case "ok":
      return { dot: "bg-emerald-500", label: "key OK" };
    case "rejected":
      return {
        dot: "bg-red-500",
        label: "key rejected",
        detail: health.detail,
      };
    case "error":
      return {
        dot: "bg-amber-500",
        label: "test failed",
        detail: health.detail,
      };
    default:
      return { dot: "bg-muted-foreground/50", label: "untested" };
  }
}

/**
 * Provider management, SERVER-MEDIATED end to end (Studio rule 3):
 * credentials never cross the browser/controller boundary, so there is no
 * key input anywhere on this surface — not on add, not on test, not on
 * remove. The controller owns auth.yaml server-side: it reports names and
 * key-present booleans, key-tests a STORED key with one bounded outbound
 * call (only the verdict reaches the browser), and removes with a
 * conservative line-range cut in the TUI's two scopes — the key alone
 * ("Remove key (keep provider)", `providers logout`) or the whole provider
 * (`providers remove`: the auth.yaml block plus a custom definition's
 * settings.yaml entry; a built-in has no definition, so its item reads
 * "Remove key"). Adding a built-in is a guided copy of a snippet (a
 * `<YOUR_KEY>` placeholder) into auth.yaml on the daemon's machine, then a
 * re-check + restart; a custom gateway's NON-secret definition is written
 * by the controller (`providers add`), its key still by hand. Every mutation
 * restarts the daemon and confirms first; external mode disables all of it
 * (the controller answers 409 there anyway).
 */
export function ProviderSection({
  runtime,
  management,
  daemonDefaults,
  providerStatus,
}: {
  runtime: Runtime;
  management: Management;
  /** The shared daemon-defaults hook (the provider page's), so the Add
   *  dialog can SAVE a base-URL override as a spawn flag instead of only
   *  rendering the settings.yaml snippet. Optional: without it the dialog
   *  falls back to copy-only. */
  daemonDefaults?: DaemonDefaults;
  /** The DAEMON's per-provider status hints (`provider_status`), merged
   *  into each row in managed mode and listed read-only in external mode.
   *  Optional: without it no daemon hint renders. */
  providerStatus?: ProviderStatus;
}) {
  const status = runtime.status;
  // The pending removal awaiting confirmation: which row, and how much of
  // it (the key line only, or the whole provider).
  const [removing, setRemoving] = useState<{
    row: HarnessProviderInfo;
    scope: HarnessProviderRemovalScope;
  } | null>(null);
  // Writes ONE provider's base-URL override into the saved daemon defaults
  // (the rest of the document is kept as saved). Managed mode only.
  const saveBaseURL =
    daemonDefaults?.manageable && daemonDefaults.defaults
      ? async (kind: string, url: string) => {
          const current = daemonDefaults.defaults;
          if (!current) return false;
          const { activeProvider: _owned, ...rest } = current;
          const ok = await daemonDefaults.save({
            ...rest,
            baseUrls: { ...rest.baseUrls, [kind]: url },
          });
          if (ok) await runtime.refresh();
          return ok;
        }
      : undefined;

  const modelsFor = (name: string) =>
    runtime.models.filter((model) => model.providerId === name).length;

  // management.load() only re-reads the auth.yaml inventory; runtime.status
  // (the top card's provider/running/selectedProvider) is a SEPARATE poll
  // owned by useHarnessRuntime, so a mutation that restarts the daemon must
  // explicitly refresh it too or the card shows the pre-mutation provider.
  const refreshAll = async () => {
    await Promise.all([runtime.refresh(), providerStatus?.refresh()]);
  };
  const activateProvider = (kind: string) =>
    management.setActiveProvider(kind).then(refreshAll);
  const removeProvider = (name: string, scope: HarnessProviderRemovalScope) =>
    management.removeProvider(name, scope).then(refreshAll);
  // The controller writes a custom DEFINITION only in managed mode (the
  // dialog also withholds the button while an imported operator settings
  // file is active — the controller would answer 409).
  const saveDefinition = management.manageable
    ? management.addCustomProvider
    : undefined;
  // The controller's rows grouped for rendering: configured providers, the
  // ToolHive external row, and the unconfigured built-in kinds (which open
  // the Add dialog preselected via `addRequest`).
  const groups = groupProviderRows(management.providers);
  const [addRequest, setAddRequest] = useState({ kind: "", seq: 0 });
  const daemonStatusFor = (name: string) =>
    providerStatus?.forProvider(name) ?? null;

  return (
    <SettingsCard title="Model provider">
      {!runtime.live ? (
        <OfflineNote />
      ) : status === null ? (
        <Note>Reading the controller&rsquo;s status…</Note>
      ) : (
        <div className="flex flex-col gap-3">
          {runtime.mode === "external" ? (
            <>
              <ExternalManagedNote />
              {/* The daemon's own per-provider hints are readable in every
                  mode — they are the deployment's daemon speaking, not the
                  (absent) controller. Read-only. */}
              <DaemonProviderStatusList rows={providerStatus?.rows ?? []} />
            </>
          ) : (
            <>
              {management.error && (
                <p className="whitespace-pre-wrap text-sm text-destructive">
                  {management.error}
                </p>
              )}
              {management.notice && (
                <p className="text-sm text-muted-foreground">
                  {management.notice}
                </p>
              )}

              {groups.configured.length === 0 && !management.isLoading ? (
                <NoProvidersNote
                  toolhive={
                    groups.toolhive !== null &&
                    (groups.toolhive.reachable === true ||
                      groups.toolhive.thvOnPath === true)
                  }
                />
              ) : null}
              <ul className="divide-y overflow-hidden rounded-lg border">
                {groups.configured.map((row) => (
                  <ProviderRow
                    key={row.name}
                    row={row}
                    active={row.name === status.selectedProvider}
                    running={status.running}
                    modelCount={modelsFor(row.name)}
                    health={management.health[row.name]}
                    daemonStatus={daemonStatusFor(row.name)}
                    busy={management.busy}
                    operatorSettings={status.operatorSettings}
                    onTest={() => void management.testKey(row.name)}
                    onActivate={() => void activateProvider(row.name)}
                    onRemove={(scope) => setRemoving({ row, scope })}
                  />
                ))}
                {groups.toolhive ? (
                  <ToolhiveGatewayRow
                    row={groups.toolhive}
                    running={status.running}
                    busy={management.busy}
                    daemonStatus={daemonStatusFor("toolhive")}
                    onActivate={() => void activateProvider("toolhive")}
                    onStart={() => void management.startToolhive()}
                    onRecheck={() =>
                      void Promise.all([
                        management.reload(),
                        runtime.refresh(),
                        providerStatus?.refresh(),
                      ])
                    }
                  />
                ) : null}
              </ul>
              <AvailableProviderKinds
                rows={groups.available}
                known={management.known}
                onAdd={(kind) =>
                  setAddRequest((previous) => ({
                    kind,
                    seq: previous.seq + 1,
                  }))
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AddProviderDialog
                  known={management.known}
                  configured={groups.configured.map((p) => p.name)}
                  authFile={status.authFile}
                  settingsFile={status.settingsFile}
                  operatorSettings={status.operatorSettings}
                  reload={management.reload}
                  restartDaemon={management.restartDaemon}
                  restarting={management.busy === "restart"}
                  savedBaseUrls={daemonDefaults?.defaults?.baseUrls}
                  saveBaseURL={saveBaseURL}
                  savingBaseURL={daemonDefaults?.busy ?? false}
                  saveDefinition={saveDefinition}
                  savingDefinition={management.busy.startsWith("add:")}
                  initialKind={addRequest.kind}
                  openSignal={addRequest.seq}
                />
                {/* The explicit `--mock` control (hidden while the mock is
                    already the active provider). */}
                {!status.isMock && (
                  <SwitchToMockButton
                    busy={management.busy === "activate:mock"}
                    onSwitch={() => activateProvider("mock")}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        {removing && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {removing.scope === "credential"
                  ? `Remove the key for ${removing.row.name}?`
                  : isCustomRow(removing.row)
                    ? `Remove ${removing.row.name}?`
                    : `Remove the ${removing.row.name} key?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {/* Name exactly what is cut: the api_key line only, the
                    settings definition (plus the key block when there is
                    one), or a built-in's whole auth.yaml block. */}
                {removing.scope === "credential"
                  ? "Only its api_key line is cut from auth.yaml on the daemon's machine — the provider definition stays in settings.yaml, so the row lists as configured with no key — and the daemon restarts: in-flight runs and session ids die with it."
                  : isCustomRow(removing.row)
                    ? `Its definition is removed from settings.yaml${
                        removing.row.source.includes("auth.yaml")
                          ? ", and its key block from auth.yaml,"
                          : ""
                      } on the daemon's machine, and the daemon restarts: in-flight runs and session ids die with it.`
                    : "Its block — key included — is removed from auth.yaml on the daemon's machine, and the daemon restarts: in-flight runs and session ids die with it."}
                {removing.row.name === status?.selectedProvider &&
                  " This is the SELECTED provider (MECATL_STUDIO_PROVIDER names it) — the daemon will fail to restart until the variable changes or the key returns."}
                {removing.scope === "all" &&
                  groups.configured.length === 1 &&
                  " It is also the only configured provider: mecated will come back on the offline mock."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void removeProvider(removing.row.name, removing.scope);
                  setRemoving(null);
                }}
              >
                {removing.scope === "credential" ? "Remove key" : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </SettingsCard>
  );
}

/** A settings-defined custom gateway (ADR 0238): it has a DEFINITION the
 *  controller can remove, distinct from its optional auth.yaml key block.
 *  The source fallback covers an older controller with no class field. */
function isCustomRow(row: HarnessProviderInfo): boolean {
  return row.class === "custom" || row.source.includes("settings.yaml");
}

const OPERATOR_SETTINGS_REMOVAL_TITLE =
  "Refused while an imported operator settings file is active — remove the providers: entry from that file by hand, then restart the daemon";

/**
 * One provider row: health dot, mono name (a real anchor to its models
 * subpage), key-health label, model count, and the actions kebab. The
 * whole row is a Link so click-through works everywhere; kebab clicks stop
 * propagation. The built-in mock is deliberately NOT listed — it is the
 * daemon's silent fallback (and the Labs demo target), not a provider the
 * user manages here.
 *
 * Removal comes in the TUI's two scopes. A CUSTOM row offers "Remove key
 * (keep provider)" — enabled only when an api_key is actually in its
 * auth.yaml block — and "Remove provider" (definition + key block), which
 * is withheld while an imported operator settings file is active because
 * the controller refuses to edit the settings file then. A built-in has no
 * definition, so its single destructive item is "Remove key": the whole
 * auth.yaml block, disabled when there is no block to cut.
 */
function ProviderRow({
  row,
  active,
  running,
  modelCount,
  health,
  daemonStatus = null,
  busy,
  operatorSettings = false,
  onTest,
  onActivate,
  onRemove,
}: {
  row: HarnessProviderInfo;
  active: boolean;
  running: boolean;
  modelCount: number;
  health: ProviderKeyHealth | undefined;
  /** The daemon's own status row for this provider, when it surfaced one. */
  daemonStatus?: HarnessProviderStatus | null;
  busy: string;
  /** An imported operator settings file is active (from /status). */
  operatorSettings?: boolean;
  onTest: () => void;
  onActivate: () => void;
  onRemove: (scope: HarnessProviderRemovalScope) => void;
}) {
  const presentation = healthPresentation(row, health);
  const testing = busy === `test:${row.name}`;
  const activating = busy === `activate:${row.name}`;
  const removingBusy = busy === `remove:${row.name}`;
  const href = `/workspace/provider/${encodeURIComponent(row.name)}`;
  const custom = isCustomRow(row);
  const hasAuthBlock = row.source.includes("auth.yaml");
  // An older controller sends no authMethod; an auth.yaml block then holds
  // an api_key unless it is the oauth kind.
  const keyed = row.authMethod
    ? row.authMethod === "api_key"
    : row.name !== "openai-codex";
  const keyRemovable = keyed && row.keyPresent && hasAuthBlock;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", presentation.dot)}
        title={presentation.detail}
      />
      <Link href={href} className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="truncate font-mono text-sm font-medium hover:underline">
            {row.name}
          </span>
          {active && <Badge variant="info">active</Badge>}
          {active && (
            <Badge variant={running ? "default" : "secondary"}>
              {running ? "running" : "stopped"}
            </Badge>
          )}
        </span>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={presentation.detail}
        >
          {presentation.label}
          {presentation.detail ? ` — ${presentation.detail}` : ""}
          {" · "}
          {modelCount} model{modelCount === 1 ? "" : "s"}
          {" · "}
          {row.source}
        </span>
        <ProviderRowDetails row={row} daemonStatus={daemonStatus} />
      </Link>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Actions for ${row.name}`}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!row.testable || !row.keyPresent || testing}
            title={
              row.testable
                ? row.keyPresent
                  ? undefined
                  : "No key in the block to test"
                : "Key testing is not supported for this provider"
            }
            onClick={onTest}
          >
            {testing ? "Testing key…" : "Test key"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              active || !(row.keyPresent || row.envShadowed) || activating
            }
            title={
              active
                ? undefined
                : !(row.keyPresent || row.envShadowed)
                  ? "No key in the block to activate"
                  : undefined
            }
            onClick={onActivate}
          >
            {activating ? "Switching…" : "Set as active"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={href}>View models</Link>
          </DropdownMenuItem>
          {custom ? (
            <>
              <DropdownMenuItem
                disabled={removingBusy || !keyRemovable}
                title={
                  keyRemovable
                    ? "Cuts only the api_key line from auth.yaml; the definition stays"
                    : "No api_key in auth.yaml to remove"
                }
                onClick={() => onRemove("credential")}
              >
                {removingBusy ? "Removing…" : "Remove key (keep provider)"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={removingBusy || operatorSettings}
                title={
                  operatorSettings
                    ? OPERATOR_SETTINGS_REMOVAL_TITLE
                    : "Removes the settings.yaml definition and any auth.yaml key block"
                }
                onClick={() => onRemove("all")}
              >
                {removingBusy ? "Removing…" : "Remove provider"}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={removingBusy || !hasAuthBlock}
              title={
                hasAuthBlock
                  ? "Removes the whole auth.yaml block, key included"
                  : "No auth.yaml block to remove (configured from the environment)"
              }
              onClick={() => onRemove("all")}
            >
              {removingBusy ? "Removing…" : "Remove key"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
