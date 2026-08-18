"use client";

import { useState } from "react";
import { MOCK_AGENTS } from "../mock-data";
import type { AgentRoster } from "../types";

/**
 * The roster of agents available in the workspace. Demo-simple: it just surfaces
 * the mock roster. Backed by a `useState` initializer so the reference is stable
 * across renders, mirroring the other agent-feature hooks.
 */
export function useAgentRoster(): { agents: AgentRoster[] } {
  const [agents] = useState<AgentRoster[]>(() => MOCK_AGENTS);
  return { agents };
}
