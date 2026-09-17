/**
 * Context-window arithmetic shared by the Agents panel's per-member meter
 * (delegation-panel.tsx). The main chat no longer renders a context meter
 * or pill of its own.
 */

/**
 * Fraction of the context window the occupancy occupies, clamped to [0, 1].
 * Null when the window is unknown (<= 0) — a meter must not render against a
 * made-up denominator.
 */
export function contextUtilisation(
  occupancyTokens: number,
  contextWindow: number,
): number | null {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null;
  return Math.min(1, Math.max(0, occupancyTokens) / contextWindow);
}
