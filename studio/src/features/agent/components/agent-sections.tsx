"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchHarnessTranscript,
  MCP_GATEWAY_URL,
  type TranscriptEntry,
} from "@/lib/harness/client";
import { useAgentCron } from "../hooks/use-agent-cron";
import { type ManagedAgent, useAgentDefs } from "../hooks/use-agent-defs";
import { useAgentMemory } from "../hooks/use-agent-memory";
import { type ActiveRun, useAgentRuns } from "../hooks/use-agent-runs";
import { type ManagedSkill, useAgentSkills } from "../hooks/use-agent-skills";
import { useHarnessRuntime } from "../hooks/use-harness-runtime";
import { useRefreshOnFocus } from "../hooks/use-refresh-on-focus";
import type { CronJob } from "../types";
import { TranscriptDialog } from "./transcript-dialog";

/**
 * The agent's own state, as four page-level sections: what it remembers, what it
 * runs unattended, which skills it can load, and the provider / routing / MCP
 * gateway wiring behind it.
 *
 * Each section is backed by a local mecatl daemon when one answers on loopback
 * and by demo data otherwise, and says which — a surface that cannot tell you
 * whether it is live is worse than no surface. Config writes reach the local
 * Studio controller and RESTART the daemon, which is stated rather than hidden.
 */

function LiveBadge({ live, label }: { live: boolean; label: string }) {
  return (
    <Badge variant="secondary" className="text-[11px]">
      {live ? label : "demo data"}
    </Badge>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/**
 * One header row for every section: live badge, busy spinner, Refresh, then
 * any section-specific actions. Existing so the five pages stop hand-rolling
 * four different layouts of the same furniture.
 */
function SectionHeader({
  live,
  label,
  loading,
  onRefresh,
  children,
}: {
  live: boolean;
  label: string;
  loading?: boolean;
  onRefresh?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LiveBadge live={live} label={label} />
      {loading && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      )}
      <div className="ml-auto flex gap-2">
        {onRefresh && (
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            Refresh
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

function relativeTime(millis: number | null) {
  if (millis === null) return "never";
  const delta = millis - Date.now();
  const ahead = delta > 0;
  const minutes = Math.round(Math.abs(delta) / 60_000);
  if (minutes < 1) return ahead ? "in under a minute" : "just now";
  if (minutes < 60) return ahead ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ahead ? `in ${hours}h` : `${hours}h ago`;
  return ahead
    ? `in ${Math.round(hours / 24)}d`
    : `${Math.round(hours / 24)}d ago`;
}

// ── Memory ──────────────────────────────────────────────────────────────────

export function MemorySection() {
  const memory = useAgentMemory();
  useRefreshOnFocus(memory.refresh);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={memory.harnessLive}
        label="user model · live"
        loading={memory.isLoading}
        onRefresh={() => void memory.refresh()}
      />

      {memory.entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">Nothing remembered yet</p>
            <Note>
              The agent writes here when it learns something durable about you.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {memory.entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm">
                  {entry.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {entry.content || "No description recorded."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!memory.canWrite && (
        <Note>
          Read-only by design: the agent curates memory through
          injection-scanned tool calls, so a value typed here would reach the
          model&rsquo;s context without passing that check. Ask it to remember
          or forget something instead.
        </Note>
      )}
    </div>
  );
}

// ── Schedules ───────────────────────────────────────────────────────────────

/**
 * The last fire's actual deliverable, shown IN the schedule card. A scheduled
 * run's output otherwise just sits in the session store where nobody looks —
 * the card is where you check on a schedule, so the result belongs here.
 */
function LastRunOutput({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<TranscriptEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setEntries(null);
    setFailed(false);
    void (async () => {
      try {
        const next = await fetchHarnessTranscript(sessionId, controller.signal);
        if (!controller.signal.aborted) setEntries(next);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [sessionId]);

  if (failed) return null;
  const finalText = entries
    ?.filter((entry) => entry.role === "assistant")
    .at(-1)?.text;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Last run output
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={() => setShowTranscript(true)}
        >
          Full transcript
        </Button>
      </div>
      {entries === null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Reading the run&rsquo;s session…
        </div>
      ) : finalText ? (
        <p className="line-clamp-6 whitespace-pre-wrap text-sm">{finalText}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The run recorded no final text — open the transcript for what
          happened.
        </p>
      )}
      {showTranscript && (
        <TranscriptDialog
          sessionId={sessionId}
          label="last run"
          onClose={() => setShowTranscript(false)}
        />
      )}
    </div>
  );
}

function ScheduleCard({
  job,
  live,
  onToggle,
  onRun,
  onDelete,
}: {
  job: CronJob;
  live: boolean;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const running = job.status === "running";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="font-mono text-sm">{job.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {job.schedule} · last {relativeTime(job.lastRunAt)}
            {job.output ? ` · ${job.output}` : ""}
          </p>
        </div>
        <Badge variant={job.enabled ? "default" : "secondary"}>
          {running ? "running" : job.enabled ? "armed" : "paused"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* A schedule prompt can be many paragraphs of operating instructions;
            clamped so one verbose job cannot crowd out the rest of the page. */}
        <p className="line-clamp-4 text-sm text-muted-foreground">
          {job.instruction}
        </p>
        {live && job.lastRunSessionId && (
          <LastRunOutput sessionId={job.lastRunSessionId} />
        )}
        {live &&
          (confirming ? (
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">
                Delete {job.name}? Past run transcripts stay in the session
                store.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    onDelete();
                  }}
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onToggle}>
                {job.enabled ? "Pause" : "Resume"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onRun}
                disabled={running}
                title="Fires immediately; the request stays open for the whole run"
              >
                {running ? "Running…" : "Run now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(true)}
              >
                Delete…
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function ScheduleCreateCard({
  onCreate,
}: {
  onCreate: (name: string, cron: string, prompt: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !cron.trim() || !prompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate(name.trim(), cron.trim(), prompt.trim());
      setName("");
      setPrompt("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">New scheduled run</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-name">Name</Label>
              <Input
                id="sched-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="morning-summary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-cron">Cron</Label>
              <Input
                id="sched-cron"
                value={cron}
                onChange={(event) => setCron(event.target.value)}
                placeholder="0 9 * * *"
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sched-prompt">Instruction</Label>
            <Textarea
              id="sched-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What should the agent do on each run?"
              className="min-h-24"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Created in plan mode — it can read and report, never edit files.
              The cadence must be no tighter than the daemon&rsquo;s floor (1
              minute by default).
            </p>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SchedulesSection() {
  const cron = useAgentCron();
  useRefreshOnFocus(cron.refresh);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={cron.harnessLive}
        label="registry · live"
        loading={cron.isLoading}
        onRefresh={() => void cron.refresh()}
      />

      {cron.jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">Nothing scheduled</p>
            <Note>
              Create one below, or ask the agent in chat to schedule work.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {cron.jobs.map((job) => (
            <ScheduleCard
              key={job.id}
              job={job}
              live={cron.harnessLive}
              onToggle={() =>
                job.enabled
                  ? void cron.pauseJob(job.id)
                  : void cron.resumeJob(job.id)
              }
              onRun={() => void cron.runJob(job.id)}
              onDelete={() => void cron.deleteJob(job.id)}
            />
          ))}
        </div>
      )}

      {cron.harnessLive && (
        <ScheduleCreateCard
          onCreate={async (name, schedule, instruction) => {
            await cron.createJob({ name, schedule, instruction });
          }}
        />
      )}
    </div>
  );
}

// ── Skills ──────────────────────────────────────────────────────────────────

function SkillEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: ManagedSkill | null;
  busy: boolean;
  onSave: (skill: {
    name: string;
    description: string;
    body: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    await onSave({ name: name.trim(), description: description.trim(), body });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {editing ? `Edit ${initial?.name}` : "New skill"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                disabled={editing}
                onChange={(event) => setName(event.target.value)}
                placeholder="release-checklist"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and dashes — it becomes a directory
                name, so it is fixed once created.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill-description">Summary</Label>
              <Input
                id="skill-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Use when cutting a release…"
              />
              <p className="text-xs text-muted-foreground">
                The only thing the model sees before deciding to load it — say
                WHEN to use it.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-body">Instructions</Label>
            <Textarea
              id="skill-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={"## Steps\n\n1. …"}
              className="min-h-40 font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              A SKILL.md steers the model like AGENTS.md — whatever you write
              becomes instructions the agent follows.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SkillCard({
  skill,
  busy,
  onEdit,
  onDelete,
}: {
  skill: ManagedSkill;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardTitle className="min-w-0 font-mono text-sm">
          {skill.name}
        </CardTitle>
        {!skill.loaded && (
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            not loaded yet
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {skill.description ||
            "No summary — the model has nothing to match on."}
        </p>
        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              Delete {skill.name}? Its directory is removed from disk.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                Keep
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirming(true)}
            >
              Delete…
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SkillsSection() {
  const skills = useAgentSkills();
  useRefreshOnFocus(skills.refresh);
  const [editing, setEditing] = useState<ManagedSkill | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={skills.live}
        label="workspace · live"
        loading={skills.isLoading}
        onRefresh={() => void skills.refresh()}
      >
        {" "}
        {skills.live && !creating && !editing && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New skill
          </Button>
        )}
        {skills.live && skills.pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={skills.busy === "reload"}
            onClick={() => void skills.reloadAgent()}
          >
            {skills.busy === "reload"
              ? "Reloading…"
              : `Load ${skills.pendingCount} change${skills.pendingCount === 1 ? "" : "s"} into agent`}
          </Button>
        )}
      </SectionHeader>

      <Note>
        The agent sees only each skill&rsquo;s name and summary until it chooses
        to load one — then the full <code>SKILL.md</code> enters context for
        that task.
      </Note>

      {skills.pendingCount > 0 && (
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          {skills.pendingCount} skill
          {skills.pendingCount === 1 ? " is" : "s are"} on disk but not in the
          running agent&rsquo;s inventory — it resolves skills once at startup,
          so a reload is what makes them usable.
        </p>
      )}

      {(creating || editing) && (
        <SkillEditor
          initial={editing}
          busy={skills.busy.startsWith("save:")}
          onSave={async (skill) => {
            await skills.saveSkill(skill);
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {skills.skills.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No skills yet</p>
            <Note>
              Create one above, or drop a <code>&lt;name&gt;/SKILL.md</code>{" "}
              into the skills directory.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.skills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              busy={skills.busy === `delete:${skill.name}`}
              onEdit={() => {
                setCreating(false);
                setEditing(skill);
              }}
              onDelete={() => void skills.removeSkill(skill.name)}
            />
          ))}
        </div>
      )}

      {skills.error && (
        <p className="text-sm text-destructive">{skills.error}</p>
      )}
      {skills.notice && <Note>{skills.notice}</Note>}

      {skills.dir && (
        <p className="text-xs text-muted-foreground">
          Scoped to this workspace only:{" "}
          <code className="font-mono">{skills.dir}</code>. A SKILL.md steers the
          model like AGENTS.md, so user-global directories are deliberately not
          loaded.
        </p>
      )}
    </div>
  );
}

// ── Gateways & routing ──────────────────────────────────────────────────────

export function GatewaysSection() {
  const runtime = useHarnessRuntime();
  useRefreshOnFocus(runtime.refresh);
  const [gatewayToken, setGatewayToken] = useState("");
  const [providerKey, setProviderKey] = useState("");

  if (!runtime.live) {
    return (
      <div className="flex flex-col gap-4">
        <LiveBadge live={false} label="controller · live" />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No local controller</p>
            <Note>
              Provider, routing and MCP gateway wiring are managed by the Studio
              controller on this machine. Start it to manage them here.
            </Note>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={runtime.live}
        label="controller · live"
        loading={Boolean(runtime.busy)}
        onRefresh={() => void runtime.refresh()}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI gateway</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Current provider: <strong>{runtime.status?.provider}</strong> ·{" "}
            {runtime.models.length} model
            {runtime.models.length === 1 ? "" : "s"} available to the agent.
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!providerKey.trim()) return;
              void runtime.saveProviderKey(providerKey.trim());
              setProviderKey("");
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="provider-key">OpenRouter API key</Label>
              <Input
                id="provider-key"
                type="password"
                autoComplete="off"
                value={providerKey}
                onChange={(event) => setProviderKey(event.target.value)}
                placeholder="sk-or-…"
              />
            </div>
            <Button type="submit" disabled={runtime.busy === "provider"}>
              {runtime.busy === "provider" ? "Saving…" : "Connect"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Sent to the loopback controller only — never stored or echoed by
            this UI. Saving restarts the daemon, which ends any run in flight.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">MCP gateway</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Gateway endpoint</p>
            <code className="mt-0.5 block break-all font-mono text-xs">
              {MCP_GATEWAY_URL}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            {runtime.status?.gateway
              ? `Connected as "${runtime.status.gateway.name}".`
              : "Not connected — the agent has only its built-in tools."}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={runtime.busy === "gateway"}
              onClick={() => {
                // Opened synchronously: a popup created after an await is blocked.
                const popup = window.open(
                  "about:blank",
                  "mecatl-gateway-oauth",
                  "width=520,height=680",
                );
                if (!popup) return;
                void runtime.connectGatewayOAuth({
                  setUrl: (url) => {
                    popup.location.href = url;
                  },
                  isClosed: () => popup.closed,
                });
              }}
            >
              {runtime.busy === "gateway"
                ? "Waiting for sign-in…"
                : "Sign in to gateway"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The gateway answers <code>401</code> without a credential, so
              sign-in is the normal path: the controller registers a client,
              takes you to the provider, then exchanges the code and reconnects
              the daemon.
            </p>
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Or paste a bearer token
            </summary>
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void runtime.connectGateway(gatewayToken.trim() || undefined);
                setGatewayToken("");
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="gw-token">Bearer token</Label>
                <Input
                  id="gw-token"
                  type="password"
                  autoComplete="off"
                  value={gatewayToken}
                  onChange={(event) => setGatewayToken(event.target.value)}
                  placeholder="for a token you already hold"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={runtime.busy === "gateway"}
              >
                Connect
              </Button>
            </form>
          </details>

          <p className="text-xs text-muted-foreground">
            The endpoint is fixed for this deployment. The token goes to the
            loopback controller only, is never echoed back, and connecting
            restarts the daemon; a failed handshake rolls the previous gateway
            back.
          </p>
        </CardContent>
      </Card>

      {runtime.error && (
        <p className="text-sm text-destructive">{runtime.error}</p>
      )}
      {runtime.notice && <Note>{runtime.notice}</Note>}
    </div>
  );
}

// ── Agent definitions ───────────────────────────────────────────────────────

function AgentEditor({
  initial,
  busy,
  models,
  onSave,
  onCancel,
}: {
  initial: ManagedAgent | null;
  busy: boolean;
  models: { id: string; displayName: string }[];
  onSave: (agent: {
    name: string;
    description: string;
    model: string;
    body: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      model,
      body,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {editing ? `Edit ${initial?.name}` : "New agent"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={name}
                disabled={editing}
                onChange={(event) => setName(event.target.value)}
                placeholder="release-auditor"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and dashes — it becomes the file
                name.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-model">Model</Label>
              <Input
                id="agent-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="inherit from the parent session"
                list="agent-model-options"
                className="font-mono"
              />
              <datalist id="agent-model-options">
                {models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Leave blank to inherit — a pinned model that is unavailable
                makes the definition unusable.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-description">When to delegate to it</Label>
            <Input
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Use when auditing a release for missing changelog entries…"
            />
            <p className="text-xs text-muted-foreground">
              This is the field that decides delegation — describe the trigger,
              not the implementation.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-body">Instructions</Label>
            <Textarea
              id="agent-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={"You are a focused specialist that…"}
              className="min-h-40 font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              A definition steers the model like AGENTS.md. This editor writes
              name, description, model and instructions only — it never writes a
              <code className="mx-1">hooks:</code> map, which would run ungated
              shell on this machine.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AgentCard({
  agent,
  busy,
  onEdit,
  onDelete,
}: {
  agent: ManagedAgent;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="font-mono text-sm">{agent.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {agent.source}
            {agent.model ? ` · ${agent.model}` : " · inherits model"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!agent.loaded && (
            <Badge variant="secondary" className="text-[11px]">
              not loaded yet
            </Badge>
          )}
          {agent.hasHooks && (
            <Badge variant="outline" className="text-[11px]">
              has hooks
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-4 text-sm text-muted-foreground">
          {agent.description || "No description — nothing decides delegation."}
        </p>
        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              Delete {agent.name}? Its file is removed from disk.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                Keep
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              {agent.writable ? "Edit" : "View"}
            </Button>
            {agent.writable ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(true)}
              >
                Delete…
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Shared with Claude Code — read-only here.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AgentsSection() {
  const defs = useAgentDefs();
  useRefreshOnFocus(defs.refresh);
  const runtime = useHarnessRuntime();
  const [editing, setEditing] = useState<ManagedAgent | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={defs.live}
        label="definitions · live"
        loading={defs.isLoading}
        onRefresh={() => void defs.refresh()}
      >
        {defs.live && !creating && !editing && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New agent
          </Button>
        )}
        {defs.live && defs.pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={defs.busy === "reload"}
            onClick={() => void defs.reloadAgent()}
          >
            {defs.busy === "reload"
              ? "Reloading…"
              : `Load ${defs.pendingCount} change${defs.pendingCount === 1 ? "" : "s"} into daemon`}
          </Button>
        )}
      </SectionHeader>

      <Note>
        An agent is a named specialist the main agent can hand work to — its
        description is what decides when that happens.
      </Note>

      {defs.pendingCount > 0 && (
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          {defs.pendingCount} definition
          {defs.pendingCount === 1 ? " is" : "s are"} written but not in the
          running daemon&rsquo;s inventory — it resolves definitions once at
          startup, so a reload is what makes them delegatable.
        </p>
      )}

      {defs.unresolvedSharedCount > 0 && (
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          {defs.unresolvedSharedCount} shared definition
          {defs.unresolvedSharedCount === 1 ? "" : "s"} under{" "}
          <code>.claude/agents</code>{" "}
          {defs.unresolvedSharedCount === 1 ? "is" : "are"} on disk but not
          resolved by the daemon. Project-scoped definitions are a trust
          boundary: a reload will not load them unless the daemon runs with
          project trust.
        </p>
      )}

      {(creating || editing) && (
        <AgentEditor
          initial={editing}
          busy={defs.busy.startsWith("save:")}
          models={runtime.models}
          onSave={async (agent) => {
            await defs.saveAgent(agent);
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {defs.agents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No agent definitions yet</p>
            <Note>
              Create one above — it lands in <code>.mecatl/agents</code>.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {defs.agents.map((agent) => (
            <AgentCard
              key={`${agent.source}/${agent.name}`}
              agent={agent}
              busy={defs.busy === `delete:${agent.name}`}
              onEdit={() => {
                setCreating(false);
                setEditing(agent);
              }}
              onDelete={() => void defs.removeAgent(agent.name)}
            />
          ))}
        </div>
      )}

      {defs.error && <p className="text-sm text-destructive">{defs.error}</p>}
      {defs.notice && <Note>{defs.notice}</Note>}

      {defs.dir && (
        <p className="text-xs text-muted-foreground">
          Writes land in <code className="font-mono">{defs.dir}</code>.
          Definitions under <code>.claude/agents</code> are listed read-only —
          they are shared with Claude Code, so this UI does not rewrite them.
        </p>
      )}
    </div>
  );
}

// ── Agent runs (live instances) ─────────────────────────────────────────────

function RunLauncher({
  definitions,
  onLaunch,
}: {
  definitions: { name: string; loaded: boolean }[];
  onLaunch: (input: {
    name: string;
    agentType?: string;
    goal: string;
    mutating: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("");
  const [goal, setGoal] = useState("");
  const [mutating, setMutating] = useState(false);
  const [launching, setLaunching] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !goal.trim()) return;
    setLaunching(true);
    try {
      await onLaunch({
        name: name.trim(),
        agentType: agentType || undefined,
        goal: goal.trim(),
        mutating,
      });
      setGoal("");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Run an agent</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="run-name">Instance name</Label>
              <Input
                id="run-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="nightly-audit"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="run-type">Definition</Label>
              <select
                id="run-type"
                value={agentType}
                onChange={(event) => setAgentType(event.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">None — a general-purpose agent</option>
                {definitions.map((definition) => (
                  <option
                    key={definition.name}
                    value={definition.name}
                    disabled={!definition.loaded}
                  >
                    {definition.name}
                    {definition.loaded ? "" : " (not loaded)"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-goal">What should it do?</Label>
            <Textarea
              id="run-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Audit the changelog against the last release tag and report gaps."
              className="min-h-20"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                id="run-mutating"
                checked={mutating}
                onCheckedChange={setMutating}
                aria-label="Allow this run to modify files"
              />
              <Label htmlFor="run-mutating" className="text-xs font-normal">
                Allow file edits — off means it can read and report only
              </Label>
            </div>
            <Button type="submit" disabled={launching}>
              {launching ? "Launching…" : "Launch"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RunRow({ run, onStop }: { run: ActiveRun; onStop: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="font-mono text-sm">{run.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {run.agentType || "general-purpose"} · {run.eventCount} event
            {run.eventCount === 1 ? "" : "s"} · {run.lastEvent}
          </p>
        </div>
        <Badge
          variant={
            run.status === "error"
              ? "destructive"
              : run.status === "done"
                ? "secondary"
                : "default"
          }
        >
          {run.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="line-clamp-2 text-sm text-muted-foreground">{run.goal}</p>
        {run.sessionId && (
          <code className="block break-all text-xs text-muted-foreground">
            {run.sessionId}
          </code>
        )}
        {run.error && <p className="text-sm text-destructive">{run.error}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onStop}>
            {run.status === "running" ? "Stop" : "Dismiss"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentRunsSection() {
  const runs = useAgentRuns();
  const defs = useAgentDefs();
  useRefreshOnFocus(runs.refresh);
  const [openTranscript, setOpenTranscript] = useState<{
    sessionId: string;
    label: string;
  } | null>(null);

  const agentInstances = runs.instances.filter(
    (instance) => instance.kind !== "chat",
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={runs.live}
        label="harness · live"
        loading={runs.isLoading}
        onRefresh={() => void runs.refresh()}
      />

      {!runs.live ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No harness running</p>
            <Note>
              Agent runs execute in a local mecatl daemon. Start one to launch
              and watch them here.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <>
          <RunLauncher
            definitions={defs.agents.map((agent) => ({
              name: agent.name,
              loaded: agent.loaded,
            }))}
            onLaunch={runs.launch}
          />

          {runs.error && (
            <p className="text-sm text-destructive">{runs.error}</p>
          )}

          {runs.runs.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Launched from here</h3>
              {runs.runs.map((run) => (
                <RunRow
                  key={run.teamId}
                  run={run}
                  onStop={() => void runs.stop(run.teamId)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              Instances in the session store
            </h3>
            <Note>
              Every run the harness performs is a session — launched agents,
              scheduled fires, and the subagents a chat spawns. Click one to
              read its transcript. This list survives reloads; the launch
              handles above do not.
            </Note>
            {agentInstances.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm font-medium">No agent runs recorded</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {agentInstances.slice(0, 25).map((instance) => (
                  <button
                    type="button"
                    key={instance.sessionId}
                    className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2.5 text-left hover:bg-muted/50"
                    onClick={() =>
                      setOpenTranscript({
                        sessionId: instance.sessionId,
                        label: instance.label,
                      })
                    }
                    title="Open the run's transcript"
                  >
                    <Badge variant="outline" className="text-[11px]">
                      {instance.kind}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      {instance.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {instance.state} · {instance.turns}t ·{" "}
                      {relativeTime(instance.modifiedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {openTranscript && (
            <TranscriptDialog
              sessionId={openTranscript.sessionId}
              label={openTranscript.label}
              onClose={() => setOpenTranscript(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Semantic model routing ──────────────────────────────────────────────────

interface DraftCategory {
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
    return "Routing needs between 2 and 8 tiers.";
  }
  const seen = new Set<string>();
  for (const category of draft.categories) {
    const name = category.name.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name)) {
      return `"${category.name || "(unnamed)"}" is not a valid tier name — start with a letter, then letters, numbers, dashes or underscores.`;
    }
    if (seen.has(name)) return `Tier "${name}" is duplicated.`;
    seen.add(name);
    if (!category.description.trim() || category.description.length > 300) {
      return `Tier "${name}" needs a distinct description of at most 300 characters — it is what the classifier matches on.`;
    }
    if (!category.model.trim()) return `Tier "${name}" needs a model.`;
  }
  if (!seen.has(draft.defaultCategory.trim().toLowerCase())) {
    return "The fallback tier must be one of the tiers above.";
  }
  return null;
}

export function RoutingSection() {
  const runtime = useHarnessRuntime();
  useRefreshOnFocus(runtime.refresh);
  const router = runtime.router;

  const [draft, setDraft] = useState<{
    enabled: boolean;
    classifierModel: string;
    defaultCategory: string;
    categories: DraftCategory[];
  } | null>(null);

  // The daemon owns this config; the draft is seeded from it once loaded and
  // discarded on save so the page never diverges from what is actually running.
  const editing = draft !== null;
  const view = draft ?? {
    enabled: router?.enabled ?? false,
    classifierModel: router?.classifierModel ?? "",
    defaultCategory: router?.defaultCategory ?? "",
    categories: router?.categories ?? [],
  };
  const problem = editing ? routingProblem(view) : null;

  const patch = (next: Partial<typeof view>) =>
    setDraft((prev) => ({ ...(prev ?? view), ...next }));

  const patchCategory = (index: number, next: Partial<DraftCategory>) =>
    patch({
      categories: view.categories.map((category, position) =>
        position === index ? { ...category, ...next } : category,
      ),
    });

  if (!runtime.live) {
    return (
      <div className="flex flex-col gap-4">
        <LiveBadge live={false} label="controller · live" />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No local controller</p>
            <Note>
              Routing is configured by the Studio controller on this machine.
              Start it to manage tiers here.
            </Note>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        live={runtime.live}
        label="controller · live"
        loading={runtime.busy === "router"}
        onRefresh={() => void runtime.refresh()}
      />

      {router?.managedByOperator ? (
        <Card>
          <CardContent className="flex flex-col gap-2 py-6">
            <p className="text-sm font-medium">
              Managed by an operator settings file
            </p>
            <Note>
              This daemon was started with an imported settings file that owns
              routing along with its aliases, slots and guardrails. Saving from
              here would drop those, so the controller refuses it — change the
              settings file instead. The current tiers are shown below.
            </Note>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Classifier</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="routing-enabled" className="text-xs font-normal">
                {view.enabled ? "On" : "Off"}
              </Label>
              <Switch
                id="routing-enabled"
                checked={view.enabled}
                onCheckedChange={(checked) => patch({ enabled: checked })}
                aria-label="Enable semantic model routing"
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Note>
              Before each prompt runs, a small classifier model reads it and
              picks a tier — so cheap work lands on a cheap model without you
              choosing per message.
            </Note>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="routing-classifier">Classifier model</Label>
                <Input
                  id="routing-classifier"
                  value={view.classifierModel}
                  onChange={(event) =>
                    patch({ classifierModel: event.target.value })
                  }
                  list="routing-model-options"
                  placeholder="a small, fast model"
                  className="font-mono"
                />
                <datalist id="routing-model-options">
                  {runtime.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="routing-default">Fallback tier</Label>
                <select
                  id="routing-default"
                  value={view.defaultCategory}
                  onChange={(event) =>
                    patch({ defaultCategory: event.target.value })
                  }
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Choose a tier…</option>
                  {view.categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Used when the classifier cannot decide.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Tiers ({view.categories.length})
          </h3>
          {!router?.managedByOperator && view.categories.length < 8 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch({
                  categories: [
                    ...view.categories,
                    { name: "", description: "", model: "" },
                  ],
                })
              }
            >
              Add tier
            </Button>
          )}
        </div>

        {view.categories.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm font-medium">No tiers configured</p>
              <Note>Routing is off until at least two tiers exist.</Note>
            </CardContent>
          </Card>
        ) : (
          view.categories.map((category, index) => (
            <Card
              key={
                category.name ||
                `unnamed-tier-${view.categories.length}-${index}`
              }
            >
              <CardContent className="flex flex-col gap-3 pt-6">
                {router?.managedByOperator ? (
                  <>
                    <p className="font-mono text-sm font-medium">
                      {category.name}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {category.model || "no model pinned"}
                    </p>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`tier-name-${index}`}>Name</Label>
                        <Input
                          id={`tier-name-${index}`}
                          value={category.name}
                          onChange={(event) =>
                            patchCategory(index, { name: event.target.value })
                          }
                          placeholder="routine"
                          className="font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`tier-model-${index}`}>Model</Label>
                        <Input
                          id={`tier-model-${index}`}
                          value={category.model}
                          onChange={(event) =>
                            patchCategory(index, { model: event.target.value })
                          }
                          list="routing-model-options"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`tier-desc-${index}`}>
                        What belongs in this tier
                      </Label>
                      <Textarea
                        id={`tier-desc-${index}`}
                        value={category.description}
                        onChange={(event) =>
                          patchCategory(index, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Mechanical edits, quick lookups, formatting…"
                        className="min-h-16 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        This is what the classifier matches a prompt against —
                        distinct descriptions route better than clever names.
                      </p>
                    </div>
                    {view.categories.length > 2 && (
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch({
                              categories: view.categories.filter(
                                (_, position) => position !== index,
                              ),
                            })
                          }
                        >
                          Remove tier
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {!router?.managedByOperator && (
        <div className="flex flex-col gap-2">
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saving restarts the daemon, which ends any run in flight.
            </p>
            <div className="flex gap-2">
              {editing && (
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Discard changes
                </Button>
              )}
              <Button
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
      )}

      {runtime.error && (
        <p className="text-sm text-destructive">{runtime.error}</p>
      )}
      {runtime.notice && <Note>{runtime.notice}</Note>}
    </div>
  );
}
