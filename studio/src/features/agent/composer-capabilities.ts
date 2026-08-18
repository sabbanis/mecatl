import { MOCK_AGENTS } from "@/features/agent/mock-data";

/**
 * What the chat composer can pull into a message: the `@agent` mentions and the
 * `/slash` commands its autocomplete offers.
 *
 * This lives in the agent feature domain (not the composer UI) so the composer
 * doesn't reach across into other pages' internals — it depends on this
 * capability surface, and the mapping from the underlying agent roster lives
 * here in one place. Swapping the source (e.g. to a live API) touches only this
 * file.
 */

export interface AgentMention {
  /** Handle inserted after `@` (the agent slug). */
  readonly handle: string;
  readonly name: string;
  readonly description: string;
}

/** Turns an agent name into an `@`-mention handle, e.g. "Code Reviewer" → "code-reviewer". */
function toHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Enabled agents from the roster, offered as `@`-mention autocomplete. */
export const AGENT_MENTIONS: readonly AgentMention[] = MOCK_AGENTS.filter(
  (a) => a.enabled,
).map((a) => ({
  handle: toHandle(a.name),
  name: a.name,
  description: a.description ?? "",
}));

export interface SlashCommand {
  /** Name inserted after `/`. */
  readonly name: string;
  readonly description: string;
}

/** Slash commands / skills, offered as `/`-command autocomplete. */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: "plan", description: "Draft an implementation plan before coding" },
  { name: "review", description: "Review the pending changes" },
  { name: "security-review", description: "Security review of the changes" },
  { name: "test", description: "Write or run tests" },
  { name: "explain", description: "Explain code or a concept" },
  { name: "summarize", description: "Summarize this conversation" },
  { name: "fix", description: "Diagnose and fix a bug" },
  { name: "refactor", description: "Refactor for clarity and reuse" },
  { name: "docs", description: "Write or update documentation" },
];
