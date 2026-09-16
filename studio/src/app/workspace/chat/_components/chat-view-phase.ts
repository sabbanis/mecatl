/**
 * What the run is parked on, when it is parked: the streaming indicator's
 * phase names the wait instead of a tool/writing phase that is not moving.
 * "approval" is a permission ask; a plan-review ask is a sibling value for
 * the plan surface to add.
 */
export type AwaitingPhase = "approval";

/**
 * The activity-line label while the daemon waits on the operator, or null
 * when the run is not parked — the caller then falls back to the derived
 * phase (`streamingPhaseLabel`, which names the running tool). The wait wins
 * over every derived phase: "Running Bash" while the daemon is actually
 * waiting on the operator misreports who is holding the run.
 */
export function awaitingPhaseLabel(awaiting?: AwaitingPhase): string | null {
  return awaiting === "approval" ? "Awaiting approval" : null;
}

/** The header spinner's accessible name while a run is live. */
export function streamingSpinnerLabel(awaiting?: AwaitingPhase): string {
  return awaiting === "approval"
    ? "Awaiting your approval"
    : "Generating a response";
}
