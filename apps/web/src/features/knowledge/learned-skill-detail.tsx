// SPDX-License-Identifier: Apache-2.0

import type { GetLearnedSkillResponse } from "@mecatl-studio/contracts/generated";
import {
  actOnLearnedSkillMutation,
  diffLearnedSkillVersionsOptions,
  getLearnedSkillOptions,
  listLearnedSkillChangesOptions,
  listLearnedSkillChangesQueryKey,
  listLearnedSkillsOptions,
  listLearnedSkillsQueryKey,
} from "@mecatl-studio/contracts/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
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
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

type Action = "activate" | "archive" | "reject" | "rollback";

export function LearnedSkillDetail({ skillId }: { skillId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inventory = useQuery(listLearnedSkillsOptions());
  const summary = inventory.data?.items.find((skill) => skill.id === skillId);
  const locator = {
    ownerAgent: summary?.ownerAgent || "pending",
    version: summary?.version || "pending",
  };
  const detail = useQuery({
    ...getLearnedSkillOptions({ path: { skillId }, query: locator }),
    enabled: Boolean(summary),
  });
  const skill = detail.data ?? summary;
  const comparison = useQuery({
    ...diffLearnedSkillVersionsOptions({
      path: { skillId },
      query: {
        fromVersion: skill?.supersedes || "pending",
        ownerAgent: skill?.ownerAgent || "pending",
        toVersion: skill?.version || "pending",
      },
    }),
    enabled: Boolean(skill?.supersedes),
  });
  const changes = useQuery(listLearnedSkillChangesOptions());
  const mutation = useMutation(actOnLearnedSkillMutation());
  const [pendingAction, setPendingAction] = useState<Action>();

  async function act(action: Action) {
    if (!skill) return;
    try {
      await mutation.mutateAsync({
        body: {
          action,
          expectedRevision: skill.revision,
          ownerAgent: skill.ownerAgent,
          ...(action === "rollback" ? { targetVersion: skill.supersedes } : {}),
          version: skill.version,
        },
        path: { skillId },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listLearnedSkillsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: listLearnedSkillChangesQueryKey() }),
      ]);
      await navigate({ search: { item: undefined, view: "learned" }, to: "/workspace/skills" });
    } catch {
      await Promise.all([inventory.refetch(), detail.refetch(), changes.refetch()]);
    } finally {
      setPendingAction(undefined);
    }
  }

  const error = inventory.error ?? detail.error;
  if (inventory.isPending) return <DetailState text="Loading learned skill…" />;
  if (error) return <DetailState error text={errorMessage(error)} />;
  if (!inventory.data) return <DetailState text="Learned-skill inventory unavailable." />;
  if (!inventory.data.supported)
    return <DetailState text={inventory.data.reason} title="Learned skills unavailable" />;
  if (!summary)
    return (
      <DetailState
        text="This learned skill no longer exists or is not visible to you."
        title="Learned skill not found"
      />
    );
  if (detail.isPending || !skill) return <DetailState text="Loading complete skill body…" />;

  const history = (changes.data?.items ?? []).filter((change) => change.skillId === skill.id);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
        <Button asChild size="sm" variant="outline">
          <Link search={{ item: undefined, view: "learned" }} to="/workspace/skills">
            <ArrowLeft />
            Back to learned skills
          </Link>
        </Button>

        <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                {skill.name}
              </h1>
              <span className="font-mono text-sm text-muted-foreground">{skill.version}</span>
              <SkillState state={skill.state} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {skill.description || "No description recorded."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {skill.actions.reject && (
              <Button
                disabled={mutation.isPending}
                onClick={() => setPendingAction("reject")}
                size="sm"
                variant="outline"
              >
                Reject
              </Button>
            )}
            {skill.actions.activate && (
              <Button
                disabled={mutation.isPending}
                onClick={() => setPendingAction("activate")}
                size="sm"
                variant="action"
              >
                Activate
              </Button>
            )}
            {skill.actions.rollback && (
              <Button
                disabled={mutation.isPending}
                onClick={() => setPendingAction("rollback")}
                size="sm"
                variant="outline"
              >
                <RotateCcw />
                Roll back to {skill.supersedes}
              </Button>
            )}
            {skill.actions.archive && (
              <Button
                disabled={mutation.isPending}
                onClick={() => setPendingAction("archive")}
                size="sm"
                variant="outline"
              >
                <Archive />
                Archive
              </Button>
            )}
          </div>
        </div>

        {mutation.isError && (
          <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage(mutation.error)} Refresh the skill and review its current revision before
            trying again.
          </p>
        )}

        <dl className="mt-7 grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Owner" value={skill.ownerAgent || "Unknown"} />
          <Fact label="Evidence" value={String(skill.evidenceCount)} />
          <Fact label="Revision" value={skill.revision || "Unknown"} />
          <Fact label="Updated" value={skill.updatedAt ? formatDate(skill.updatedAt) : "Unknown"} />
        </dl>

        <div className="mt-8 grid gap-7 lg:grid-cols-2">
          <section className="min-w-0">
            <h2 className="font-semibold">Skill body</h2>
            <pre className="mt-3 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl border bg-card p-4 font-mono text-xs leading-5">
              {skill.body || "No body recorded."}
            </pre>
          </section>
          <section className="min-w-0">
            <h2 className="font-semibold">
              {skill.supersedes ? `Changes since ${skill.supersedes}` : "Version comparison"}
            </h2>
            {!skill.supersedes ? (
              <EmptyPanel text="This is the first recorded version." />
            ) : comparison.isPending ? (
              <EmptyPanel text="Comparing versions…" />
            ) : comparison.isError ? (
              <EmptyPanel text="The version diff is unavailable; review the complete body instead." />
            ) : comparison.data.diff ? (
              <DiffBlock diff={comparison.data.diff} />
            ) : (
              <EmptyPanel text="The daemon reported no textual differences." />
            )}
          </section>
        </div>

        <section className="mt-8">
          <h2 className="font-semibold">Lifecycle history</h2>
          {changes.isPending ? (
            <EmptyPanel text="Loading lifecycle history…" />
          ) : changes.isError ? (
            <EmptyPanel text={errorMessage(changes.error)} />
          ) : history.length === 0 ? (
            <EmptyPanel text="No lifecycle receipts are available for this skill." />
          ) : (
            <ol className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">
              {history.map((change) => (
                <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center" key={change.id}>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{humanize(change.operation)}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {change.version}
                    </span>
                    {change.fromState && change.toState && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {change.fromState} → {change.toState}
                      </span>
                    )}
                  </span>
                  {change.verdict && <Badge variant="outline">{change.verdict}</Badge>}
                  <time className="text-xs text-muted-foreground">
                    {change.at ? formatDate(change.at) : "Time unavailable"}
                  </time>
                </li>
              ))}
            </ol>
          )}
          {changes.data && !changes.data.complete && (
            <p className="mt-2 text-xs text-warning">
              Showing the 100 most recent lifecycle changes.
            </p>
          )}
        </section>
      </div>

      <AlertDialog
        onOpenChange={(open) => !open && setPendingAction(undefined)}
        open={Boolean(pendingAction)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this action</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction && actionConfirmation(pendingAction, skill)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={() => pendingAction && void act(pendingAction)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="mt-3 max-h-[34rem] overflow-auto rounded-xl border bg-card py-2 font-mono text-xs">
      {diff.split("\n").map((line, index) => (
        <span
          className={`block min-h-5 whitespace-pre-wrap px-4 ${diffLineClass(line)}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: unified diff lines are positional
          key={index}
        >
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

export function diffLineKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "addition";
  if (line.startsWith("-") && !line.startsWith("---")) return "deletion";
  if (line.startsWith("@@") || line.startsWith("+++") || line.startsWith("---")) return "metadata";
  return "context";
}

function diffLineClass(line: string) {
  const kind = diffLineKind(line);
  if (kind === "addition") return "bg-success/10 text-success";
  if (kind === "deletion") return "bg-destructive/10 text-destructive";
  if (kind === "metadata") return "text-muted-foreground";
  return "";
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function SkillState({ state }: { state: string }) {
  const variant =
    state === "active"
      ? "success"
      : state === "rejected"
        ? "destructive"
        : state === "staged"
          ? "warning"
          : "muted";
  return <Badge variant={variant}>{state || "unknown"}</Badge>;
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{text}</p>
  );
}

function DetailState({ error, text, title }: { error?: boolean; text: string; title?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div
        className={`max-w-md rounded-xl border border-dashed p-8 ${error ? "border-destructive/40" : ""}`}
      >
        {title && <h1 className="font-semibold">{title}</h1>}
        <p className={`mt-2 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {text}
        </p>
        <Button asChild className="mt-5" size="sm" variant="outline">
          <Link search={{ item: undefined, view: "learned" }} to="/workspace/skills">
            Back to learned skills
          </Link>
        </Button>
      </div>
    </div>
  );
}

function actionConfirmation(action: Action, skill: GetLearnedSkillResponse) {
  if (action === "activate")
    return `Activate ${skill.name} ${skill.version}? It will be published into the live skill inventory.`;
  if (action === "reject")
    return `Reject ${skill.name} ${skill.version}? The version will remain inspectable in lifecycle history.`;
  if (action === "rollback")
    return `Roll ${skill.name} back to ${skill.supersedes}? The current version will be retired.`;
  return `Archive ${skill.name} ${skill.version}? It will be withdrawn from the live inventory but remain inspectable.`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "detail" in error) return String(error.detail);
  return error instanceof Error ? error.message : "The request could not be completed.";
}
