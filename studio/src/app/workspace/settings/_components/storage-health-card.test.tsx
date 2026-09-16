import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StorageHealth } from "@/lib/harness/storage";
import { StorageHealthCard, storageHealthStatus } from "./storage-health-card";

/**
 * The always-visible health card: a HEALTHY store renders too (unlike the
 * workspace banner), with the aggregate counts, "n/a" for sizes the store
 * cannot report, the degraded pill and its reason, and a Refresh that
 * re-reads. Unsupported, offline and unread states render notes.
 */

const healthy: StorageHealth = {
  available: true,
  unavailableReason: "",
  sessionCount: 12,
  corruptCount: 0,
  v1Count: 2,
  v2Count: 10,
  mainCount: 5,
  childCount: 4,
  scheduledCount: 2,
  unknownCount: 1,
  fileCount: 31,
  currentBytes: 20_480,
  reclaimableBytes: null,
  policy: null,
  lastSweepAt: null,
  nextSweepAt: null,
  lastFailure: "",
  activeJob: "",
};

describe("storageHealthStatus", () => {
  it("is Healthy with a legacy-layout hint, Degraded for unavailable / corrupt / failed", () => {
    expect(storageHealthStatus(healthy)).toEqual({
      label: "Healthy",
      detail: "2 legacy-layout families can be optimized.",
    });
    expect(storageHealthStatus({ ...healthy, v1Count: 0 }).detail).toBe("");
    expect(
      storageHealthStatus({
        ...healthy,
        available: false,
        unavailableReason: "permission denied",
      }),
    ).toEqual({
      label: "Degraded",
      detail: "The session store cannot be read: permission denied",
    });
    expect(storageHealthStatus({ ...healthy, corruptCount: 1 }).detail).toBe(
      "1 stored session can no longer be loaded.",
    );
    expect(
      storageHealthStatus({ ...healthy, lastFailure: "sweep: disk full" })
        .detail,
    ).toBe("Last background job failed: sweep: disk full");
  });
});

describe("StorageHealthCard", () => {
  it("renders a healthy store's pill and every aggregate, with n/a for an unknown size", () => {
    render(
      <StorageHealthCard live supported health={healthy} onRefresh={vi.fn()} />,
    );
    expect(screen.getByTestId("storage-health-status")).toHaveTextContent(
      "Healthy",
    );
    expect(screen.getByTestId("storage-health-sessions")).toHaveTextContent(
      "12Main 5 · Child runs 4 · Scheduled 2 · Unknown 1",
    );
    expect(screen.getByTestId("storage-health-files")).toHaveTextContent("31");
    expect(screen.getByTestId("storage-health-size")).toHaveTextContent(
      "20 KB",
    );
    expect(screen.getByTestId("storage-health-reclaimable")).toHaveTextContent(
      "n/a",
    );
    expect(screen.getByTestId("storage-health-layout")).toHaveTextContent(
      "v2 10 · v1 (legacy) 2",
    );
    expect(screen.getByTestId("storage-health-corrupt")).toHaveTextContent("0");
    expect(screen.getByTestId("storage-health-active-job")).toHaveTextContent(
      "none",
    );
    expect(screen.getByTestId("storage-health-last-failure")).toHaveTextContent(
      "none",
    );
    expect(screen.queryByTestId("storage-health-ownerless")).toBeNull();
  });

  it("shows the active job, the last failure and the ownerless preflight when present", () => {
    render(
      <StorageHealthCard
        live
        supported
        health={{
          ...healthy,
          activeJob: "migration",
          lastFailure: "cleanup: backend timeout",
          reclaimableBytes: 4_096,
          ownerless: {
            sessions: 3,
            sessionsUnavailableReason: "",
            schedules: null,
            schedulesUnavailableReason: "no schedule store",
          },
        }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByTestId("storage-health-status")).toHaveTextContent(
      "Degraded",
    );
    expect(screen.getByTestId("storage-health-detail")).toHaveTextContent(
      "Last background job failed: cleanup: backend timeout",
    );
    expect(screen.getByTestId("storage-health-active-job")).toHaveTextContent(
      "migration",
    );
    expect(screen.getByTestId("storage-health-reclaimable")).toHaveTextContent(
      "4 KB",
    );
    expect(screen.getByTestId("storage-health-ownerless")).toHaveTextContent(
      "3 sessions · n/a schedules",
    );
  });

  it("an unreadable store shows Degraded with the reason and no counts", () => {
    render(
      <StorageHealthCard
        live
        supported
        health={{
          ...healthy,
          available: false,
          unavailableReason: "permission denied",
        }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByTestId("storage-health-status")).toHaveTextContent(
      "Degraded",
    );
    expect(screen.getByTestId("storage-health-detail")).toHaveTextContent(
      "permission denied",
    );
    expect(screen.queryByTestId("storage-health-sessions")).toBeNull();
  });

  it("Refresh re-reads; an unread health shows a note with the same button", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <StorageHealthCard live supported health={null} onRefresh={onRefresh} />,
    );
    expect(
      screen.getByText(/Storage health is not available right now/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("says so when the daemon lacks the capability, and when the runtime is offline", () => {
    const { unmount } = render(
      <StorageHealthCard
        live
        supported={false}
        health={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/does not report storage health/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    unmount();

    render(
      <StorageHealthCard
        live={false}
        supported
        health={healthy}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/runtime is offline/)).toBeInTheDocument();
  });
});
