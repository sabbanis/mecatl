import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CleanupController } from "@/features/agent/hooks/use-storage-maintenance";
import type {
  SessionCleanupJob,
  SessionCleanupPlan,
} from "@/lib/harness/storage";
import {
  cleanupConfirmDescription,
  describeCounts,
  StorageCleanupCard,
} from "./storage-cleanup-card";

/**
 * The Clean up sessions card over a fake controller: capability-gated; the
 * kind picker (main unticked by default) → Plan clean-up with the ticked
 * kinds → eligible / protected summary and the candidates table → the
 * destructive button opens the typed CLEAN UP confirmation, which gates
 * apply → the job panel; a stale plan offers Re-plan; a management refusal
 * renders read-only copy.
 */

const plan: SessionCleanupPlan = {
  confirmationToken: "token-1",
  available: true,
  unavailableReason: "",
  generation: "g1",
  policyVersion: "p1",
  eligible: [
    {
      sessionId: "subagent-1",
      kind: "subagent",
      state: "completed",
      reason: "age",
      modifiedAt: Date.now() - 3 * 86_400_000,
      estimatedBytes: 2_048,
    },
    {
      sessionId: "sched-1",
      kind: "scheduled",
      state: "completed",
      reason: "cap",
      modifiedAt: null,
      estimatedBytes: 1_024,
    },
  ],
  eligibleCounts: {
    total: 2,
    byKind: { subagent: 1, scheduled: 1 },
    byState: { completed: 2 },
    byReason: { age: 1, cap: 1 },
  },
  protected: {
    total: 3,
    byKind: { main: 2, subagent: 1 },
    byState: { idle: 2, running: 1 },
    byReason: { live: 2, active_state: 1 },
  },
  estimatedBytes: 3_072,
  plannedJobId: "cleanup-1",
};

const job = (
  overrides: Partial<SessionCleanupJob> = {},
): SessionCleanupJob => ({
  jobId: "cleanup-1",
  state: "running",
  processed: 1,
  deleted: 1,
  skipped: 0,
  stale: 0,
  failed: 0,
  errors: [],
  ...overrides,
});

function controller(
  overrides: Partial<CleanupController> = {},
): CleanupController {
  return {
    phase: "idle",
    kinds: [],
    plan: null,
    job: null,
    error: null,
    planCleanup: vi.fn(async () => {}),
    beginConfirm: vi.fn(),
    abortConfirm: vi.fn(),
    apply: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    replan: vi.fn(async () => {}),
    reset: vi.fn(),
    ...overrides,
  };
}

const renderCard = (
  cleanup: CleanupController,
  props: Partial<{ live: boolean; supported: boolean }> = {},
) =>
  render(
    <StorageCleanupCard
      live={props.live ?? true}
      supported={props.supported ?? true}
      cleanup={cleanup}
    />,
  );

describe("helpers", () => {
  it("describeCounts lists non-zero entries, sorted, through the describer", () => {
    expect(describeCounts({ b: 2, a: 1, c: 0 })).toBe("1 a · 2 b");
    expect(describeCounts({})).toBe("");
  });
  it("cleanupConfirmDescription names what is deleted and what stays", () => {
    expect(cleanupConfirmDescription(plan)).toBe(
      "2 stored sessions (about 3 KB) will be deleted permanently, with their transcripts and event logs: 1 Scheduled fires · 1 Subagent runs. The 3 protected sessions stay. This cannot be undone.",
    );
  });
});

describe("StorageCleanupCard", () => {
  it("renders nothing without the storage_cleanup capability", () => {
    const { container } = renderCard(controller(), { supported: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("idle: main chats are unticked by default; Plan clean-up sends the ticked kinds", async () => {
    const user = userEvent.setup();
    const cleanup = controller();
    renderCard(cleanup);
    expect(
      screen.getByRole("checkbox", { name: "Main chats" }),
    ).not.toBeChecked();
    for (const name of [
      "Subagent runs",
      "Parallel branches",
      "Team member runs",
      "Scheduled fires",
    ]) {
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    }

    await user.click(screen.getByRole("checkbox", { name: "Subagent runs" }));
    await user.click(screen.getByRole("checkbox", { name: "Main chats" }));
    await user.click(screen.getByRole("button", { name: "Plan clean-up" }));
    expect(cleanup.planCleanup).toHaveBeenCalledTimes(1);
    const kinds = (cleanup.planCleanup as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as string[];
    expect([...kinds].sort()).toEqual([
      "main",
      "parallel_branch",
      "scheduled",
      "team_member",
    ]);
  });

  it("nothing ticked disables Plan clean-up", async () => {
    const user = userEvent.setup();
    renderCard(controller());
    for (const name of [
      "Subagent runs",
      "Parallel branches",
      "Team member runs",
      "Scheduled fires",
    ]) {
      await user.click(screen.getByRole("checkbox", { name }));
    }
    expect(
      screen.getByRole("button", { name: "Plan clean-up" }),
    ).toBeDisabled();
  });

  it("planned: the partition, the candidates table, then the typed CLEAN UP gates apply", async () => {
    const user = userEvent.setup();
    const cleanup = controller({ phase: "planned", plan, kinds: ["subagent"] });
    renderCard(cleanup);
    expect(screen.getByTestId("storage-cleanup-eligible")).toHaveTextContent(
      "21 Scheduled fires · 1 Subagent runs — 1 over the age limit · 1 beyond the count cap — 2 completed",
    );
    expect(
      screen.getByTestId("storage-cleanup-estimated-bytes"),
    ).toHaveTextContent("3 KB");
    expect(screen.getByTestId("storage-cleanup-protected")).toHaveTextContent(
      "32 Main chats · 1 Subagent runs — 1 running or awaiting · 2 live in this daemon",
    );

    const table = screen.getByRole("table", { name: "Clean-up candidates" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("subagent-1");
    expect(rows[0]).toHaveTextContent("over the age limit");
    expect(rows[0]).toHaveTextContent("3d ago");
    expect(rows[1]).toHaveTextContent("unknown");

    await user.click(screen.getByRole("button", { name: "Clean up…" }));
    expect(cleanup.beginConfirm).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete 2 stored sessions permanently?");
    expect(dialog).toHaveTextContent("The 3 protected sessions stay.");
    const confirm = within(dialog).getByRole("button", { name: "Clean up" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "clean up");
    expect(confirm).toBeDisabled();
    expect(cleanup.apply).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByRole("textbox"));
    await user.type(within(dialog).getByRole("textbox"), "CLEAN UP");
    await user.click(confirm);
    expect(cleanup.apply).toHaveBeenCalledTimes(1);
    expect(cleanup.abortConfirm).not.toHaveBeenCalled();
  });

  it("cancelling the typed confirmation aborts without applying", async () => {
    const user = userEvent.setup();
    const cleanup = controller({ phase: "planned", plan });
    renderCard(cleanup);
    await user.click(screen.getByRole("button", { name: "Clean up…" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(cleanup.abortConfirm).toHaveBeenCalledTimes(1);
    expect(cleanup.apply).not.toHaveBeenCalled();
  });

  it("an empty or unavailable plan offers no destructive button", () => {
    const { unmount } = renderCard(
      controller({
        phase: "planned",
        plan: {
          ...plan,
          eligible: [],
          eligibleCounts: { total: 0, byKind: {}, byState: {}, byReason: {} },
        },
      }),
    );
    expect(screen.getByText(/Nothing to clean up/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clean up…" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Plan again" }),
    ).toBeInTheDocument();
    unmount();

    renderCard(
      controller({
        phase: "planned",
        plan: {
          ...plan,
          available: false,
          unavailableReason: "backend_unsupported",
        },
      }),
    );
    expect(
      screen.getByText(/does not support this operation/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clean up…" })).toBeNull();
  });

  it("stale: explains the change and Re-plan re-plans", async () => {
    const user = userEvent.setup();
    const cleanup = controller({
      phase: "stale",
      plan,
      error: { code: "cleanup_plan_stale", message: "stale" },
    });
    renderCard(cleanup);
    expect(
      screen.getByText(/store changed since this plan/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Re-plan" }));
    expect(cleanup.replan).toHaveBeenCalledTimes(1);
  });

  it("running shows the counters and Cancel; done shows the outcome and Plan again", async () => {
    const user = userEvent.setup();
    const running = controller({ phase: "running", plan, job: job() });
    const { unmount } = renderCard(running);
    expect(screen.getByTestId("storage-cleanup-job-state")).toHaveTextContent(
      "Running",
    );
    expect(screen.getByTestId("storage-cleanup-progress")).toHaveTextContent(
      "1 processed · 1 deleted · 0 skipped · 0 stale · 0 failed",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(running.cancel).toHaveBeenCalledTimes(1);
    unmount();

    const done = controller({
      phase: "done",
      plan,
      job: job({
        state: "completed",
        processed: 2,
        deleted: 1,
        stale: 1,
        errors: [
          {
            itemHandle: "sched-1",
            reasonCode: "stale",
            message: "changed since the plan",
          },
        ],
      }),
    });
    renderCard(done);
    expect(screen.getByTestId("storage-cleanup-job-state")).toHaveTextContent(
      "Completed",
    );
    expect(
      screen.getByRole("table", { name: "Clean-up item failures" }),
    ).toHaveTextContent("sched-1");
    await user.click(screen.getByRole("button", { name: "Plan again" }));
    expect(done.reset).toHaveBeenCalledTimes(1);
  });

  it("a plan failure shows the error above the picker; a management refusal is read-only", () => {
    const { unmount } = renderCard(
      controller({
        phase: "failed",
        error: { code: "cleanup_backend", message: "boom" },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /session store refused the clean-up/,
    );
    expect(screen.getByRole("button", { name: "Plan clean-up" })).toBeEnabled();
    unmount();

    renderCard(
      controller({
        phase: "failed",
        error: { code: "management_unauthorized", message: "forbidden" },
      }),
    );
    expect(
      screen.getByText(/requires management authorization/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
