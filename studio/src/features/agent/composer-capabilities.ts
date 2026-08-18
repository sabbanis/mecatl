import { listHarnessAgents, listHarnessCommands } from "@/lib/harness/client";

/**
 * What the chat composer can pull into a message: the `@agent` mentions and
 * the `/slash` commands its autocomplete offers.
 *
 * Both come from the daemon — the resolved subagent inventory
 * (`GET /v1/agents`) and the workspace's discovered slash commands
 * (`GET /v1/commands`) — refreshed by the runtime-status provider on every
 * (re)connect, because a daemon restart can change either.
 *
 * A module-level registry rather than React state: tiptap's suggestion
 * plugins read these lists per keystroke from plain callbacks that live
 * outside the component tree.
 */

export interface AgentMention {
  /** Handle inserted after `@` (the agent slug). */
  readonly handle: string;
  readonly name: string;
  readonly description: string;
}

export interface SlashCommand {
  /** Name inserted after `/`. */
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

let agentMentions: readonly AgentMention[] = [];
let slashCommands: readonly SlashCommand[] = [];

export function getAgentMentions(): readonly AgentMention[] {
  return agentMentions;
}

export function getSlashCommands(): readonly SlashCommand[] {
  return slashCommands;
}

/**
 * Re-reads both capability lists from the daemon. Either list failing leaves
 * the previous value in place — an autocomplete that briefly lags a restart
 * beats one that flickers empty on every transient error.
 */
export async function refreshComposerCapabilities(): Promise<void> {
  const [agents, commands] = await Promise.allSettled([
    listHarnessAgents(),
    listHarnessCommands(),
  ]);
  if (agents.status === "fulfilled") {
    agentMentions = agents.value.map((agent) => ({
      handle: toHandle(agent.name),
      name: agent.name,
      description: agent.description,
    }));
  }
  if (commands.status === "fulfilled") {
    slashCommands = commands.value
      .filter((command) => command.name)
      .map((command) => ({
        name: command.name,
        description: command.description,
      }));
  }
}
