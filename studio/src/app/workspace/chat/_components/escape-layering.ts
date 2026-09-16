/**
 * What a bare Esc does in the chat view, in priority order (the TUI's esc
 * layering: a selection is dropped before anything else, a panel closes
 * before a run is interrupted). The dispatcher only delivers Esc once every
 * closer layer — a Radix dialog/menu, the composer's autocomplete — has
 * declined it, so this table is the fallback beneath them.
 *
 * `clear-draft` exists for the composer's draft guard (it decides whether a
 * typed-but-unsent draft should be cleared before a run is cancelled); the
 * chat view itself always passes `hasDraft: false`.
 */
export type EscapeAction =
  | "clear-selection"
  | "close-panel"
  | "cancel-run"
  | "clear-draft"
  | "none";

export interface EscapeState {
  /** A non-empty text selection sits inside the transcript. */
  hasSelection: boolean;
  /** The right-hand side panel (artifact, thread, tool call, agents…) is open. */
  panelOpen: boolean;
  /** A run is streaming and could be interrupted. */
  isStreaming: boolean;
  /** The composer holds an unsent draft the guard may want to clear first. */
  hasDraft: boolean;
}

/** Resolve one Esc press to exactly one action — never two. */
export function resolveEscapeAction(state: EscapeState): EscapeAction {
  if (state.hasSelection) return "clear-selection";
  if (state.panelOpen) return "close-panel";
  if (state.isStreaming) return "cancel-run";
  if (state.hasDraft) return "clear-draft";
  return "none";
}
