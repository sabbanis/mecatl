import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MigrationController } from "@/features/agent/hooks/use-storage-maintenance";
import type {
  StorageMigrationJob,
  StorageMigrationPlan,
} from "@/lib/harness/storage";
import {
  migrationProgressPercent,
  migrationRunningElsewhere,
  parseBatchSize,
  StorageMigrationCard,
} from "./storage-migration-card";

/**
 * The Optimize storage card over a fake controller: capability-gated,
 * Estimate → plan summary → Optimize now with the typed batch size → job
 * panel (progress, Cancel while running, Resume from cancelled/failed,
 * per-item errors); an unavailable plan and a conflicting job read
 * honestly; a management refusal renders read-only copy.
 */

const plan: StorageMigrationPlan = {
  planId: "plan-1",
  available: true,
  unavailableReason: "",
  v1Families: 4,
  v2Families: 6,
  invalidFamilies: 1,
  skippedFamilies: 0,
  currentBytes: 20_480,
  reclaimableBytes: 4_096,
  temporaryBytes: 8_192,
};

const job = (
  overrides: Partial<StorageMigrationJob> = {},
): StorageMigrationJob => ({
  jobId: "job-1",
  state: "running",
  v1Families: 4,
  v2Families: 6,
  invalidFamilies: 1,
  skippedFamilies: 0,
  currentBytes: 20_480,
  reclaimableBytes: 4_096,
  temporaryBytes: 8_192,
  processed: 2,
  migrated: 1,
  failed: 1,
  errors: [
    {
      itemHandle: "family-7",
      reasonCode: "invalid_family",
      message: "family cannot be read",
    },
  ],
  ...overrides,
});

function controller(
  overrides: Partial<MigrationController> = {},
): MigrationController {
  return {
    phase: "idle",
    plan: null,
    job: null,
    error: null,
    estimate: vi.fn(async () => {}),
    apply: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderCard(
  migration: MigrationController,
  props: Partial<{
    live: boolean;
    supported: boolean;
    activeJob: string;
    onRefreshHealth: () => void;
  }> = {},
) {
  return render(
    <StorageMigrationCard
      live={props.live ?? true}
      supported={props.supported ?? true}
      activeJob={props.activeJob ?? ""}
      onRefreshHealth={props.onRefreshHealth ?? vi.fn()}
      migration={migration}
    />,
  );
}

describe("helpers", () => {
  it("migrationRunningElsewhere reads the health activeJob kinds", () => {
    expect(migrationRunningElsewhere("")).toBe(false);
    expect(migrationRunningElsewhere("cleanup")).toBe(false);
    expect(migrationRunningElsewhere("migration")).toBe(true);
    expect(migrationRunningElsewhere("cleanup(2),migration")).toBe(true);
  });
  it("migrationProgressPercent is processed / v1 families, clamped", () => {
    expect(migrationProgressPercent(job({ processed: 2, v1Families: 4 }))).toBe(
      50,
    );
    expect(migrationProgressPercent(job({ processed: 9, v1Families: 4 }))).toBe(
      100,
    );
    expect(migrationProgressPercent(job({ processed: 0, v1Families: 0 }))).toBe(
      0,
    );
  });
  it("parseBatchSize accepts a positive whole number, else the default", () => {
    expect(parseBatchSize("25")).toBe(25);
    expect(parseBatchSize("0")).toBe(50);
    expect(parseBatchSize("abc")).toBe(50);
  });
});

describe("StorageMigrationCard", () => {
  it("renders nothing without the storage_migration capability", () => {
    const { container } = renderCard(controller(), { supported: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("idle: Estimate runs the read-only plan; a migration running elsewhere offers Refresh instead", async () => {
    const user = userEvent.setup();
    const migration = controller();
    const { unmount } = renderCard(migration);
    await user.click(screen.getByRole("button", { name: "Estimate" }));
    expect(migration.estimate).toHaveBeenCalledTimes(1);
    unmount();

    const onRefreshHealth = vi.fn();
    renderCard(controller(), { activeJob: "migration", onRefreshHealth });
    expect(
      screen.getByText(/A migration job is already running/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Estimate" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Refresh health" }));
    expect(onRefreshHealth).toHaveBeenCalledTimes(1);
  });

  it("planned: shows the estimate and Optimize now applies with the typed batch size", async () => {
    const user = userEvent.setup();
    const migration = controller({ phase: "planned", plan });
    renderCard(migration);
    const summary = screen.getByTestId("storage-migration-plan");
    expect(summary).toHaveTextContent("Legacy (v1) families4");
    expect(summary).toHaveTextContent("Unreadable families1 (left untouched)");
    expect(summary).toHaveTextContent("Temporary space needed8 KB");

    const batch = screen.getByLabelText("Batch size");
    expect(batch).toHaveValue(50);
    await user.clear(batch);
    await user.type(batch, "20");
    await user.click(screen.getByRole("button", { name: "Optimize now" }));
    expect(migration.apply).toHaveBeenCalledWith(20);

    await user.click(screen.getByRole("button", { name: "Discard estimate" }));
    expect(migration.reset).toHaveBeenCalledTimes(1);
  });

  it("planned but unavailable, or nothing legacy, offers no Optimize", () => {
    const { unmount } = renderCard(
      controller({
        phase: "planned",
        plan: {
          ...plan,
          available: false,
          unavailableReason: "maintenance_exclusion_unavailable",
        },
      }),
    );
    expect(
      screen.getByText(/cannot take the maintenance lock/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Optimize now" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Estimate again" }),
    ).toBeInTheDocument();
    unmount();

    renderCard(
      controller({ phase: "planned", plan: { ...plan, v1Families: 0 } }),
    );
    expect(screen.getByText(/Nothing to optimize/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Optimize now" })).toBeNull();
  });

  it("running: progress, per-item errors and Cancel; no Resume", async () => {
    const user = userEvent.setup();
    const migration = controller({ phase: "running", plan, job: job() });
    renderCard(migration);
    expect(screen.getByTestId("storage-migration-job-state")).toHaveTextContent(
      "Running",
    );
    expect(screen.getByTestId("storage-migration-progress")).toHaveTextContent(
      "2 of 4 families processed · 1 migrated · 1 failed",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(
      screen.getByRole("table", { name: "Migration item failures" }),
    ).toHaveTextContent("family-7");
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(migration.cancel).toHaveBeenCalledTimes(1);
  });

  it("done: a cancelled or failed job offers Resume with the batch size; a completed one does not", async () => {
    const user = userEvent.setup();
    const cancelled = controller({
      phase: "done",
      plan,
      job: job({ state: "cancelled" }),
    });
    const { unmount } = renderCard(cancelled);
    expect(screen.getByTestId("storage-migration-job-state")).toHaveTextContent(
      "Cancelled",
    );
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(cancelled.resume).toHaveBeenCalledWith(50);
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(cancelled.reset).toHaveBeenCalledTimes(1);
    unmount();

    const failed = controller({
      phase: "failed",
      plan,
      job: job({ state: "failed" }),
    });
    const second = renderCard(failed);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    second.unmount();

    renderCard(
      controller({
        phase: "done",
        plan,
        job: job({ state: "completed", processed: 4, migrated: 3 }),
      }),
    );
    expect(screen.getByTestId("storage-migration-job-state")).toHaveTextContent(
      "Completed",
    );
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("failed without a job: migration_conflict is framed and offers Refresh health", async () => {
    const user = userEvent.setup();
    const onRefreshHealth = vi.fn();
    const migration = controller({
      phase: "failed",
      plan,
      error: { code: "migration_conflict", message: "job running" },
    });
    renderCard(migration, { onRefreshHealth });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Another migration job is already running/,
    );
    await user.click(screen.getByRole("button", { name: "Refresh health" }));
    expect(onRefreshHealth).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(migration.reset).toHaveBeenCalledTimes(1);
  });

  it("a management refusal renders read-only copy; offline renders the offline note", () => {
    const { unmount } = renderCard(
      controller({
        phase: "failed",
        error: { code: "management_unauthorized", message: "forbidden" },
      }),
    );
    expect(
      screen.getByText(/requires management authorization/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    renderCard(controller(), { live: false });
    expect(screen.getByText(/runtime is offline/)).toBeInTheDocument();
  });
});
