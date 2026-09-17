import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHarnessClient } from "@/lib/harness/sdk";
import {
  type FetchStub,
  problemResponse,
  type RecordedRequest,
  stubHarnessFetch,
} from "@/lib/harness/sdk-test-stub";
import {
  ConsolidateMemoryCard,
  describeDreamReceipt,
} from "./consolidate-memory";

/**
 * The Consolidate memory card over the SDK-backed dream module (ADR 0227),
 * at parity with mecatui's /dream overlay: capability-gated targets with the
 * daemon's unavailable reason; generation confirmed first (it spends tokens);
 * the operation review with current values; whole-plan apply/dismiss; an
 * open decision (`dream_in_progress` or a dropped connection) locked to
 * retrying the SAME decision; a no-longer-actionable plan (`dream_conflict`,
 * vanished) cleared with the regenerate notice; the receipt counts.
 */

const runtime = vi.hoisted(() => ({
  status: {
    connected: true,
    serverCapabilities: {} as Record<string, unknown>,
  },
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useRuntimeStatus: () => runtime.status,
}));

type TargetCapability = {
  generate: boolean;
  decide: boolean;
  unavailable_reason?: string;
};

function setManualDream(
  manualDream: Partial<
    Record<"user_model" | "project_memory", TargetCapability>
  >,
) {
  runtime.status = {
    connected: true,
    serverCapabilities: { manual_dream: manualDream },
  };
}

const BOTH_AVAILABLE = {
  user_model: { generate: true, decide: true },
  project_memory: { generate: true, decide: true },
};

/** A merge plan expiring a quarter of an hour out, as the daemon sends it. */
const planBody = () => ({
  plan: {
    id: "plan1",
    target: "user_model",
    expires_at: { seconds: Math.floor(Date.now() / 1000) + 15 * 60 },
    planned_operation_count: 1,
    planned_source_count: 2,
    operations: [
      {
        kind: "merge",
        survivor: {
          key: "editor",
          value: "Uses vim",
          description: "Editor preference",
        },
        sources: [
          {
            key: "editor_2",
            value: "Prefers vim keybindings",
            description: "Older note",
          },
        ],
        replacement: {
          value: "Uses vim with vim keybindings",
          description: "Merged editor preference",
        },
        reason: "near-duplicates",
        exact_duplicate_eligible: true,
      },
    ],
  },
});

const receiptBody = (overrides: Record<string, unknown> = {}) => ({
  receipt: {
    id: "plan1",
    target: "user_model",
    disposition: "apply",
    planned_source_count: 2,
    applied_source_count: 1,
    conflicted_source_count: 1,
    skipped_source_count: 0,
    failed_source_count: 0,
    ...overrides,
  },
});

const isDecision = (request: RecordedRequest) =>
  request.path === "/v1/dream/plans/plan1/decision";

/** Answers generate with the plan and routes each decision POST, in order,
 *  to the given answers (the last one repeats). */
function stubDream(...decisionAnswers: Array<() => unknown>): FetchStub {
  let decisions = 0;
  return stubHarnessFetch((request) => {
    if (request.path === "/v1/dream/plans") return planBody();
    if (isDecision(request)) {
      const answer =
        decisionAnswers[Math.min(decisions, decisionAnswers.length - 1)];
      decisions += 1;
      return answer?.();
    }
    return undefined;
  });
}

async function generatePlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Generate plan" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Generate" }));
  await screen.findByTestId("dream-plan-summary");
}

async function applyPlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Apply plan" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));
}

beforeEach(() => {
  setManualDream(BOTH_AVAILABLE);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

describe("describeDreamReceipt", () => {
  it("lists every bucket, planned first", () => {
    expect(
      describeDreamReceipt({
        id: "p",
        target: "user_model",
        disposition: "apply",
        planned: 4,
        applied: 2,
        conflicted: 1,
        skipped: 1,
        failed: 0,
      }),
    ).toBe("4 planned · 2 applied · 1 conflicted · 1 skipped · 0 failed");
  });
});

describe("ConsolidateMemoryCard", () => {
  it("renders nothing without the manual_dream capability", () => {
    runtime.status = { connected: true, serverCapabilities: {} };
    const { container } = render(<ConsolidateMemoryCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists a target the daemon cannot generate for as disabled with its reason, and picks a capable one by default", async () => {
    const user = userEvent.setup();
    setManualDream({
      user_model: {
        generate: false,
        decide: false,
        unavailable_reason: "target store is unavailable",
      },
      project_memory: { generate: true, decide: true },
    });
    stubHarnessFetch(() => undefined);
    render(<ConsolidateMemoryCard />);

    const picker = screen.getByRole("combobox", {
      name: "Memory to consolidate",
    });
    expect(picker).toHaveTextContent("Project memory");
    expect(screen.queryByTestId("dream-unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeEnabled();

    await user.click(picker);
    const disabled = await screen.findByRole("option", {
      name: /User model .* \(unavailable\)/,
    });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute(
      "title",
      "This memory store is not available on this daemon.",
    );
    expect(
      screen.getByRole("option", { name: "Project memory" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("shows the daemon's reason and disables Generate when the only target cannot generate", () => {
    setManualDream({
      user_model: {
        generate: false,
        decide: false,
        unavailable_reason: "dream planner is unavailable",
      },
    });
    render(<ConsolidateMemoryCard />);
    expect(screen.getByTestId("dream-unavailable")).toHaveTextContent(
      "Plans cannot be generated for this memory: No consolidation planner is configured on this daemon — it needs a model to review memories.",
    );
    const generate = screen.getByRole("button", { name: "Generate plan" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAttribute(
      "title",
      "No consolidation planner is configured on this daemon — it needs a model to review memories.",
    );
  });

  it("confirms before generating (it spends tokens), then POSTs the target; a shown plan turns the button into Regenerate", async () => {
    const user = userEvent.setup();
    setManualDream({ user_model: { generate: true, decide: true } });
    const stub = stubDream();
    render(<ConsolidateMemoryCard />);

    await user.click(screen.getByRole("button", { name: "Generate plan" }));
    let dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Generate a consolidation plan?");
    expect(dialog).toHaveTextContent("spends tokens");
    expect(dialog).not.toHaveTextContent("discarded");
    expect(stub.requests).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(stub.requests).toHaveLength(0);

    await generatePlan(user);
    expect(stub.last()).toMatchObject({
      method: "POST",
      path: "/v1/dream/plans",
      body: { target: "user_model" },
    });
    expect(screen.getByTestId("dream-plan-summary")).toHaveTextContent(
      /1 operation over 2 memories\. .*Expires in 1[45]m\./,
    );

    const regenerate = screen.getByRole("button", { name: "Regenerate plan" });
    await user.click(regenerate);
    dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Regenerate the consolidation plan?");
    expect(dialog).toHaveTextContent("The plan shown now is discarded.");
    expect(
      within(dialog).getByRole("button", { name: "Regenerate" }),
    ).toBeInTheDocument();
  });

  it("shows each operation's detail: the exact-duplicate badge, the replacement description, and the current values of survivor and sources", async () => {
    const user = userEvent.setup();
    stubDream();
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);

    const operation = screen.getByRole("listitem");
    expect(within(operation).getByText("exact duplicate")).toBeInTheDocument();
    expect(operation).toHaveTextContent("near-duplicates");
    expect(operation).toHaveTextContent("Keeps editor — absorbs editor_2");
    expect(operation).toHaveTextContent("Uses vim with vim keybindings");
    expect(operation).toHaveTextContent("Merged editor preference");

    const summary = within(operation).getByText("Show current values");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    await user.click(summary);
    expect(details).toHaveTextContent("Keeps editor");
    expect(details).toHaveTextContent("Uses vim");
    expect(details).toHaveTextContent("Editor preference");
    expect(details).toHaveTextContent("Absorbs editor_2");
    expect(details).toHaveTextContent("Prefers vim keybindings");
    expect(details).toHaveTextContent("Older note");
  });

  it("dream_in_progress keeps the plan, disables the opposite decision, and the relabelled button re-POSTs the identical decision to fetch the receipt", async () => {
    const user = userEvent.setup();
    const stub = stubDream(
      () => problemResponse(409, "dream_in_progress", "still running"),
      () => receiptBody(),
    );
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);

    await applyPlan(user);
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      "The daemon is still applying that plan — retry the same decision to retrieve its receipt.",
    );
    // The plan stays reviewable; only the same decision is offered.
    expect(screen.getByTestId("dream-plan-summary")).toBeInTheDocument();
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss).toBeDisabled();
    expect(dismiss).toHaveAttribute(
      "title",
      "A decision on this plan is still running.",
    );
    expect(
      screen.getByRole("button", { name: "Regenerate plan" }),
    ).toBeDisabled();
    const decisions = stub.requests.filter(isDecision);
    expect(decisions).toHaveLength(1);

    // The retry: no confirmation dialog, the same {decision} to the same id.
    const retry = screen.getByRole("button", {
      name: "Retry apply — fetch receipt",
    });
    await user.click(retry);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const receipt = await screen.findByTestId("dream-receipt");
    const retried = stub.requests.filter(isDecision);
    expect(retried).toHaveLength(2);
    expect(retried[1]).toMatchObject({
      method: "POST",
      path: "/v1/dream/plans/plan1/decision",
      body: { decision: "apply" },
    });
    expect(retried[1]?.body).toEqual(retried[0]?.body);

    expect(receipt).toHaveTextContent(
      "Applied: 2 planned · 1 applied · 1 conflicted · 0 skipped · 0 failed.",
    );
    expect(receipt).toHaveTextContent(
      "Memory changed after the plan was generated",
    );
    expect(screen.queryByTestId("dream-plan-summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeEnabled();
  });

  it("a connection dropped mid-decision is indeterminate: same-decision retry only, worded as unknown", async () => {
    const user = userEvent.setup();
    stubDream(
      () => {
        throw new TypeError("fetch failed");
      },
      () => receiptBody({ disposition: "dismiss" }),
    );
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      /connection dropped before the daemon answered .* may already be dismissing that plan/,
    );
    expect(screen.getByRole("button", { name: "Apply plan" })).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Retry dismiss — fetch receipt" }),
    );
    const receipt = await screen.findByTestId("dream-receipt");
    expect(receipt).toHaveTextContent("Plan dismissed — nothing changed.");
    // A dismissal carries no per-entry outcome notes.
    expect(receipt).not.toHaveTextContent("Memory changed");
    expect(screen.queryByTestId("dream-plan-summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeEnabled();
  });

  it("dream_conflict clears the plan with the regenerate notice", async () => {
    const user = userEvent.setup();
    stubDream(() => problemResponse(412, "dream_conflict", "conflict"));
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      "A different decision on that plan is already active — it is no longer actionable for this one. Generate a new plan once that decision settles.",
    );
    expect(screen.queryByTestId("dream-plan-summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate plan" })).toBeEnabled();
  });

  it("a vanished plan (dream_not_found) clears with the vanished-plan notice", async () => {
    const user = userEvent.setup();
    stubDream(() => problemResponse(404, "dream_not_found", "unknown plan"));
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);
    await applyPlan(user);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "That plan is no longer valid (the daemon restarted or the plan expired) — generate a new one.",
    );
    expect(screen.queryByTestId("dream-plan-summary")).not.toBeInTheDocument();
  });

  it("an unclassified decide error is shown verbatim with the plan kept and both decisions available", async () => {
    const user = userEvent.setup();
    stubDream(() => problemResponse(500, "internal", "boom"));
    render(<ConsolidateMemoryCard />);
    await generatePlan(user);
    await applyPlan(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByTestId("dream-plan-summary")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply plan" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
  });

  it("decide:false disables Apply with the daemon's reason and notes it under the picker", async () => {
    const user = userEvent.setup();
    setManualDream({
      user_model: {
        generate: true,
        decide: false,
        unavailable_reason: "target store lacks reviewed atomic consolidation",
      },
    });
    stubDream();
    render(<ConsolidateMemoryCard />);
    expect(screen.getByTestId("dream-unavailable")).toHaveTextContent(
      "Plans can be generated but not applied here: This memory store does not support reviewed consolidation.",
    );
    await generatePlan(user);
    const apply = screen.getByRole("button", { name: "Apply plan" });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute(
      "title",
      "This daemon does not permit applying plans: This memory store does not support reviewed consolidation.",
    );
  });
});
