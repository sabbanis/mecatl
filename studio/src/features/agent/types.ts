// ── Sessions ────────────────────────────────────────────────────────────────

export interface AgentSession {
  id: string;
  title: string;
  projectId: string | null;
  /** Enabled agent this chat belongs to, if any. Mutually exclusive with a project. */
  agentId?: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  messageCount: number;
  isStreaming: boolean;
  inputTokens: number;
  outputTokens: number;
  unread: boolean;
  estimatedCost: number | null;
  contextLength: number | null;
  lastPromptTokens: number | null;
  thresholdTokens: number | null;
  /** Daemon lifecycle state (idle/running/awaiting/completed/failed/cancelled). */
  state?: string;
  workspace?: string;
  /**
   * Action eligibility comes from the daemon row's capabilities, never
   * re-derived client-side; an omitted capability is a denial, and the closed
   * reason strings explain a disabled action.
   */
  canRename?: boolean;
  canDelete?: boolean;
  renameReason?: string;
  deleteReason?: string;
}

export interface CreateSessionOpts {
  workspace?: string;
  model?: string;
  projectId?: string;
  /** Enabled agent this chat belongs to, if any. Mutually exclusive with a project. */
  agentId?: string;
}

// ── Messages ────────────────────────────────────────────────────────────────

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  toolCalls?: ToolCallInfo[];
  reasoning?: string;
  artifact?: Artifact;
  /**
   * When set on an assistant message, names the specific agent that authored
   * that turn. This lets a single conversation surface several different agents
   * (e.g. a project chat where a Code Reviewer, Security Auditor, and Docs
   * Writer each contribute), rather than a single assistant identity. Falls back
   * to the chat's default bot name when unset.
   */
  agentName?: string;
  /**
   * A focused reply thread branched off this message. When present, the message
   * shows a reply indicator; opening it reveals the root message and these
   * replies in the side thread panel (mirrors the teams view's threading).
   */
  replies?: AgentMessage[];
  /** One-line advisories from the daemon (tool progress, unrendered events). */
  notices?: string[];
  /** Delegation badges: work this turn handed to child agents. */
  delegations?: Array<{
    kind: "subagent" | "team" | "parallel";
    label: string;
    detail: string;
  }>;
  /**
   * The turn ended with result.stop === "error". A failed turn renders as
   * failed — never as an empty success.
   */
  failed?: boolean;
  failureDetail?: string;
}

export interface ToolCallInfo {
  callId: string;
  name: string;
  input: unknown;
  output?: string;
  isError?: boolean;
  status: "running" | "completed" | "failed";
}

export interface Attachment {
  name: string;
  type: string;
  url?: string;
  content?: string;
}

// ── Stream Events ───────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; name: string; callId: string; input: unknown }
  | {
      type: "tool_result";
      callId: string;
      output: string;
      isError?: boolean;
    }
  | {
      type: "approval";
      approvalId: string;
      sessionId: string;
      toolName: string;
      description: string;
      details: string;
    }
  | {
      type: "clarify";
      clarifyId: string;
      sessionId: string;
      question: string;
    }
  | { type: "reasoning"; text: string }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      reasoningTokens?: number;
      estimatedCost: number | null;
    }
  | { type: "title"; title: string }
  | {
      type: "done";
      session: AgentSession;
      messages: AgentMessage[];
    }
  | { type: "error"; message: string; details?: string }
  /** A previously surfaced permission ask was withdrawn by the daemon. */
  | { type: "retract"; approvalId: string }
  /**
   * Mid-run steer drain echo: the daemon merged the pending steer bundle into
   * the in-flight run. `text` is the drained bundle; `messageId` is the
   * watermark — the client-minted id of the LAST message the bundle absorbed.
   */
  | { type: "steer"; text: string; messageId: string }
  /** A one-line advisory (tool progress, compaction, unrendered event kinds). */
  | { type: "notice"; text: string }
  /** Delegation activity: the run handed work to a child agent. */
  | {
      type: "delegation";
      kind: "subagent" | "team" | "parallel";
      label: string;
      detail: string;
    }
  /**
   * The run's terminal frame. `stop === "error"` is a FAILED turn and must
   * render as one, even when no token ever streamed.
   */
  | {
      type: "run_result";
      stop: string;
      text: string;
      errorText: string;
      permanent: boolean;
    };

// ── Projects ────────────────────────────────────────────────────────────────

export interface ProjectMemory {
  id: string;
  content: string;
  source: string;
}

export interface ProjectSuggestion {
  id: string;
  label: string;
}

export interface AgentProject {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  summary?: string;
  status?: string;
  memories?: ProjectMemory[];
  suggestions?: ProjectSuggestion[];
  outputFiles?: Artifact[];
}

// ── Agents ──────────────────────────────────────────────────────────────────

export interface AgentRoster {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

// ── Approvals ───────────────────────────────────────────────────────────────

export type ApprovalChoice = "once" | "session" | "always" | "deny";

export interface ApprovalRequest {
  approvalId: string;
  sessionId: string;
  /** The tool being authorized ("" when the daemon did not name one). */
  toolName?: string;
  description: string;
  details: string;
}

// ── Clarifications ──────────────────────────────────────────────────────────

export interface ClarificationRequest {
  clarifyId: string;
  sessionId: string;
  question: string;
}

// ── Models ──────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

// ── Memory ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  section: string;
  updatedAt: number;
}

// ── Skills ──────────────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  category: string;
  content?: string;
}

// ── Cron ────────────────────────────────────────────────────────────────────

export interface CronRunRecord {
  id: string;
  startedAt: string;
  durationMs: number;
  status: "success" | "error" | "retrying";
  message: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  instruction: string;
  enabled: boolean;
  status: "idle" | "running" | "error";
  lastRunAt: number | null;
  output: string | null;
  /** Live harness only: session id of the last completed fire. */
  lastRunSessionId?: string;
  prompt?: string;
  skills?: string[];
  tools?: string[];
  targetChannel?: string;
  history?: CronRunRecord[];
}

export interface CreateCronOpts {
  name: string;
  schedule: string;
  instruction: string;
  deliver?: string;
  skills?: string[];
  model?: string;
}

// ── Files ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  size: number | null;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  lines: number;
}

export interface GitInfo {
  isGit: boolean;
  branch: string | null;
  dirty: number;
  modified: number;
  untracked: number;
  ahead: number;
  behind: number;
}

// ── Artifacts (UI-level) ────────────────────────────────────────────────────

export interface Artifact {
  name: string;
  type: "spreadsheet" | "document" | "code" | "image" | "pdf" | "markdown";
  content?: string;
  /** Binary payloads (images, PDFs) that don't fit `content` as text ride a
   *  URL — a data: URI or a fetchable location. */
  url?: string;
  createdAt?: string;
}
