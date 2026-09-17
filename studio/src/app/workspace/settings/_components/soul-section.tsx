"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRuntimeSettings } from "@/features/agent/hooks/use-runtime-settings";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { copyToClipboard } from "@/lib/clipboard";
import type {
  HarnessRuntimeSettings,
  HarnessRuntimeSettingsDoc,
} from "@/lib/harness/runtime-settings";
import { fetchHarnessSoul, type HarnessSoul } from "@/lib/harness/soul";
import {
  ExternalManagedNote,
  Note,
  OfflineNote,
  SettingsCard,
  SettingsRow,
} from "./settings-card";

/**
 * Settings → Agent → Persona: the web form of mecatui's soul surface — the
 * `/soul` preview plus the `--no-soul` / `--soul-strict` / `--soul-file` /
 * `--approve-soul` flags (docs/tui.md "Soul").
 *
 * Two cards. "Persona" is the DAEMON's resolved snapshot (`GET /v1/soul`,
 * read-only in both directions: the agent cannot write it and Studio never
 * sends it back): whether a fragment loads this run, where it came from,
 * whether it is trusted, whether it drifted from its recorded baseline, its
 * size and hash, and the body as plain text behind a disclosure — never
 * markdown, because a project soul is prompt text of workspace provenance.
 * Gated on `capabilities.soul`; re-read after every controller write, since
 * each one restarts the daemon and the snapshot describes THIS process.
 *
 * "Persona settings" is the CONTROLLER's half (managed mode only; external
 * mode renders the managed note — the deployment owns its flags): a draft of
 * the saved `soul` document (load on/off, strict, file) with one "Save and
 * restart", and — only while the snapshot reports a DRIFTED user/project
 * soul — "Accept current persona as baseline", the one-shot `--approve-soul`
 * that rewrites `<soul>.sha256` to the current hash. Hidden for a driver
 * soul (the flag is a no-op there) and while the persona is disabled (the
 * controller answers 409). Every write RESTARTS the daemon, so both confirm.
 */

type SoulConfig = HarnessRuntimeSettings["soul"];

/** How the snapshot read stands. */
type SnapshotState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unsupported" }
  | { kind: "ok"; soul: HarnessSoul };

const PROVENANCE_HINT: Record<HarnessSoul["provenance"], string> = {
  none: "No persona was selected.",
  user: "Your user-scoped persona file — always trusted.",
  project:
    "The workspace's own .mecatl/soul.md — loaded only under project trust.",
  driver:
    "A remote soul-source driver configured by the operator — always trusted.",
};

/** The drift-baseline path the daemon compares against, when known. */
export function baselinePath(doc: HarnessRuntimeSettingsDoc | null): string {
  const file = doc?.config.soul.file || doc?.soulFileDefault || "";
  return file ? `${file}.sha256` : "";
}

/** The amber drift line: names the baseline file when the controller told
 *  us where the persona lives (managed mode), else the generic sidecar. */
export function driftNote(doc: HarnessRuntimeSettingsDoc | null): string {
  const path = baselinePath(doc);
  const baseline = path
    ? `its recorded baseline (${path})`
    : "its recorded .sha256 baseline";
  return `Edited since ${baseline}; it loads with a warning unless the persona settings refuse a drifted persona.`;
}

const sameSoul = (a: SoulConfig, b: SoulConfig) =>
  a.enabled === b.enabled && a.strict === b.strict && a.file === b.file;

/** The `--approve-soul` one-shot means something only for a drifted
 *  user/project soul that is currently enabled. */
export function canApproveBaseline(
  soul: HarnessSoul | null,
  config: SoulConfig | undefined,
): boolean {
  if (!soul || !config?.enabled) return false;
  if (!soul.drifted) return false;
  return soul.provenance === "user" || soul.provenance === "project";
}

function SnapshotRows({
  soul,
  doc,
}: {
  soul: HarnessSoul;
  doc: HarnessRuntimeSettingsDoc | null;
}) {
  const [showBody, setShowBody] = useState(false);
  const dropped = soul.provenance === "project" && !soul.trusted;
  return (
    <div data-testid="soul-snapshot">
      <div className="divide-y divide-border/60">
        <SettingsRow
          label="Status"
          description={
            soul.present
              ? "A persona fragment is part of every run's turn-0 context."
              : dropped
                ? "The workspace persona was found but dropped: the daemon does not trust this project."
                : "No persona fragment reaches the model."
          }
        >
          <Badge
            data-testid="soul-status"
            variant={soul.present ? "success" : "muted"}
          >
            {soul.present ? "loaded" : "not loaded"}
          </Badge>
        </SettingsRow>
        <SettingsRow
          label="Provenance"
          description={PROVENANCE_HINT[soul.provenance]}
        >
          <Badge data-testid="soul-provenance" variant="secondary">
            {soul.provenance}
          </Badge>
          {dropped ? (
            <Badge variant="destructive">
              dropped — untrusted project soul
            </Badge>
          ) : null}
        </SettingsRow>
        {soul.drifted ? (
          <SettingsRow label="Drift">
            <p
              role="note"
              data-testid="soul-drift"
              className="max-w-md text-right text-sm text-warning"
            >
              {driftNote(doc)}
            </p>
          </SettingsRow>
        ) : null}
        {soul.present ? (
          <SettingsRow label="Size">
            <span data-testid="soul-size" className="text-sm">
              {soul.sizeBytes.toLocaleString()} bytes
            </span>
          </SettingsRow>
        ) : null}
        {soul.sha256 ? (
          <SettingsRow label="SHA-256">
            <code
              className="font-mono text-xs"
              title={soul.sha256}
              data-testid="soul-sha256"
            >
              {soul.sha256.slice(0, 12)}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copy SHA-256"
              onClick={() => void copyToClipboard(soul.sha256, "SHA-256")}
            >
              <Copy className="size-4" />
            </Button>
          </SettingsRow>
        ) : null}
      </div>
      {soul.present ? (
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showBody}
            aria-controls="soul-body"
            onClick={() => setShowBody((open) => !open)}
          >
            {showBody ? "Hide persona" : "Show persona"}
          </Button>
          {showBody ? (
            <pre
              id="soul-body"
              className="max-h-64 overflow-y-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap"
            >
              {soul.content}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SoulSection() {
  const { connected } = useRuntimeStatus();
  const {
    live,
    manageable,
    soulSupported,
    doc,
    isLoading,
    busy,
    error,
    notice,
    save,
    approveSoul,
  } = useRuntimeSettings();

  // The daemon's snapshot. Re-read whenever the runtime-settings document
  // changes identity — every controller write reloads it after the restart,
  // and the snapshot describes the process that is running NOW.
  const [snapshot, setSnapshot] = useState<SnapshotState>({ kind: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `doc` is the re-read trigger — a new document means the daemon restarted, so the snapshot must be read again
  useEffect(() => {
    if (!connected || !soulSupported) return;
    const controller = new AbortController();
    setSnapshot({ kind: "loading" });
    fetchHarnessSoul(controller.signal)
      .then((soul) => {
        if (controller.signal.aborted) return;
        setSnapshot(soul ? { kind: "ok", soul } : { kind: "unsupported" });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot({
          kind: "error",
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
    return () => controller.abort();
  }, [connected, soulSupported, doc]);

  // The unsaved soul document; null = showing the saved one untouched.
  const [draft, setDraft] = useState<SoulConfig | null>(null);
  const [confirming, setConfirming] = useState<"save" | "approve" | null>(null);

  const soul = snapshot.kind === "ok" ? snapshot.soul : null;

  let snapshotBody: React.ReactNode;
  if (!connected) {
    snapshotBody = <OfflineNote />;
  } else if (!soulSupported) {
    snapshotBody = (
      <Note>
        This daemon has no persona loaded — it reports no persona surface.
      </Note>
    );
  } else if (snapshot.kind === "loading") {
    snapshotBody = <Note>Reading the daemon&rsquo;s persona…</Note>;
  } else if (snapshot.kind === "error") {
    snapshotBody = (
      <p role="alert" className="text-sm text-destructive">
        {snapshot.message}
      </p>
    );
  } else if (snapshot.kind === "unsupported") {
    snapshotBody = (
      <Note>This daemon does not report its persona (older daemon).</Note>
    );
  } else {
    snapshotBody = <SnapshotRows soul={snapshot.soul} doc={doc} />;
  }

  let settingsBody: React.ReactNode;
  if (!live) {
    settingsBody = <OfflineNote />;
  } else if (!manageable) {
    settingsBody = (
      <div className="space-y-2">
        <ExternalManagedNote />
        <Note>
          The persona is the deployment&rsquo;s <code>--soul-file</code>,{" "}
          <code>--no-soul</code>, <code>--soul-strict</code> and{" "}
          <code>--approve-soul</code> flags on the server host.
        </Note>
      </div>
    );
  } else if (!doc) {
    settingsBody = (
      <Note>
        {isLoading
          ? "Reading the daemon's runtime settings…"
          : (error ??
            "The daemon's runtime settings could not be read right now.")}
      </Note>
    );
  } else {
    const saved = doc.config.soul;
    const shown = draft ?? saved;
    const dirty = !sameSoul(shown, saved);
    const conventional = doc.soulFileDefault || "the conventional soul.md";
    const approvable = canApproveBaseline(soul, saved);
    const submit = async () => {
      setConfirming(null);
      const ok = await save({ soul: shown });
      if (ok) setDraft(null);
    };
    settingsBody = (
      <>
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Load a persona"
            htmlFor="soul-enabled"
            description={`On, the daemon injects ${
              saved.file || conventional
            } as turn-0 context. Off respawns it with --no-soul: no persona fragment at all.`}
          >
            <Switch
              id="soul-enabled"
              checked={shown.enabled}
              disabled={busy !== ""}
              onCheckedChange={(enabled) => setDraft({ ...shown, enabled })}
              aria-label="Load a persona"
            />
          </SettingsRow>
          <SettingsRow
            label="Refuse a drifted persona"
            htmlFor="soul-strict"
            description="--soul-strict: a persona edited since its recorded baseline contributes nothing, instead of loading with a warning."
          >
            <Switch
              id="soul-strict"
              checked={shown.strict}
              disabled={busy !== "" || !shown.enabled}
              onCheckedChange={(strict) => setDraft({ ...shown, strict })}
              aria-label="Refuse a drifted persona"
            />
          </SettingsRow>
          <SettingsRow
            label="Persona file"
            htmlFor="soul-file"
            description="Absolute path on the daemon's machine, inside the mecatl config directory or the workspace. Blank uses the conventional file."
          >
            <Input
              id="soul-file"
              list={
                doc.soulCandidates.length ? "soul-file-candidates" : undefined
              }
              value={shown.file}
              placeholder={doc.soulFileDefault}
              disabled={busy !== "" || !shown.enabled}
              onChange={(event) =>
                setDraft({ ...shown, file: event.target.value })
              }
              className="w-56 min-[500px]:w-80 font-mono text-xs"
              aria-invalid={error ? true : undefined}
            />
            {doc.soulCandidates.length ? (
              <datalist id="soul-file-candidates">
                {doc.soulCandidates.map((candidate) => (
                  <option key={candidate.path} value={candidate.path}>
                    {candidate.name}
                  </option>
                ))}
              </datalist>
            ) : null}
          </SettingsRow>
        </div>
        {dirty ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Restart required — saving restarts the daemon. In-flight runs end.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!dirty || busy !== ""}
            onClick={() => setConfirming("save")}
          >
            Save and restart
          </Button>
          {dirty ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy !== ""}
              onClick={() => setDraft(null)}
            >
              Discard
            </Button>
          ) : null}
          {approvable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== ""}
              onClick={() => setConfirming("approve")}
            >
              Accept current persona as baseline
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <AlertDialog
          open={confirming !== null}
          onOpenChange={(open) => !open && setConfirming(null)}
        >
          {confirming === "save" && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Restart the daemon to apply persona settings?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The daemon restarts with the new persona flags: in-flight runs
                  end and their session ids die with them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void submit()}>
                  Save and restart
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
          {confirming === "approve" && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Accept the current persona as its baseline?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Rewrites {baselinePath(doc) || "the persona's .sha256 file"}{" "}
                  to the current hash (mecated --approve-soul, one restart) so
                  the persona loads without a drift warning. In-flight runs end
                  and their session ids die with them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setConfirming(null);
                    void approveSoul();
                  }}
                >
                  Accept and restart
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <SettingsCard
        title="Persona"
        description="The persona (soul) the daemon injects as turn-0 context. Read-only: the agent cannot write it and Studio never sends it back."
      >
        {snapshotBody}
      </SettingsCard>
      <div data-testid="soul-settings">
        <SettingsCard
          title="Persona settings"
          description="Which persona the managed daemon loads and how strictly. Changes restart it."
        >
          {settingsBody}
        </SettingsCard>
      </div>
    </>
  );
}
