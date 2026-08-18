"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelHarnessRun,
  createHarnessSession,
  probeHarness,
  respondToHarnessApproval,
  streamHarnessPrompt,
} from "@/lib/harness/client";
import { MOCK_MESSAGES } from "../mock-data";
import type {
  AgentMessage,
  ApprovalChoice,
  ApprovalRequest,
  Attachment,
  ClarificationRequest,
  ToolCallInfo,
} from "../types";

type ChatStatus =
  | "idle"
  | "streaming"
  | "waiting_approval"
  | "waiting_clarification"
  | "error";

/**
 * Chat state for one session.
 *
 * Two backends: a locally running mecatl daemon when one answers on loopback
 * (see /api/harness), and the canned mock responses otherwise. The deployed
 * instance has no daemon, so it keeps the mock behaviour it always had — the
 * probe failing is the normal path there, not an error worth surfacing.
 */
export function useAgentChat(sessionId: string | null) {
  const [messages, setMessages] = useState<AgentMessage[]>(
    sessionId ? (MOCK_MESSAGES[sessionId] ?? []) : [],
  );

  useEffect(() => {
    setMessages(sessionId ? (MOCK_MESSAGES[sessionId] ?? []) : []);
  }, [sessionId]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [harnessLive, setHarnessLive] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(
      sessionId === "s2"
        ? {
            approvalId: "apr-1",
            sessionId: "s2",
            description:
              "Asta wants to comment on the failing CI run and block review time on your calendar.",
            details:
              "GitHub: Comment on PR #482 summarizing the lint fixes and asking for re-review.\nGoogle Calendar: Create a Tuesday afternoon review block for the release branch.",
          }
        : null,
    );
  const [pendingClarification] = useState<ClarificationRequest | null>(null);
  const [usage, setUsage] = useState({
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: null as number | null,
  });

  // This UI's session ids are its own (sidebar-owned); a harness session is
  // minted lazily per id and remembered so a follow-up prompt continues the same
  // conversation instead of starting a fresh one.
  const harnessSessions = useRef(new Map<string, string>());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const probe = await probeHarness(controller.signal);
      if (controller.signal.aborted) return;
      setHarnessLive(probe.live);
    })();
    return () => controller.abort();
  }, []);

  const ensureHarnessSession = useCallback(async (key: string) => {
    const existing = harnessSessions.current.get(key);
    if (existing) return existing;
    const created = await createHarnessSession("default");
    harnessSessions.current.set(key, created);
    return created;
  }, []);

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      if (!sessionId || status === "streaming") return;

      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
        attachments,
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus("streaming");
      setError(null);

      if (!harnessLive) {
        // Simulate a brief delay then add mock assistant response
        setTimeout(() => {
          const assistantMessage: AgentMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content:
              "This is a demo environment — agent responses are simulated. In production, this would be a real AI response to your message.",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStatus("idle");
        }, 800);
        return;
      }

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      // Every update is a functional setState: tokens and tool results arrive
      // faster than React commits, so reading the previous array from the
      // closure would drop frames (rerender-functional-setstate).
      const patch = (apply: (message: AgentMessage) => AgentMessage) =>
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? apply(message) : message,
          ),
        );

      try {
        const harnessId = await ensureHarnessSession(sessionId);
        await streamHarnessPrompt(
          harnessId,
          content,
          (event) => {
            switch (event.type) {
              case "token":
                patch((message) => ({
                  ...message,
                  content: message.content + event.text,
                }));
                break;
              case "reasoning":
                patch((message) => ({
                  ...message,
                  reasoning: (message.reasoning ?? "") + event.text,
                }));
                break;
              case "tool_call": {
                const call: ToolCallInfo = {
                  callId: event.callId,
                  name: event.name,
                  input: event.input,
                  status: "running",
                };
                patch((message) => ({
                  ...message,
                  toolCalls: [...(message.toolCalls ?? []), call],
                }));
                break;
              }
              case "tool_result":
                patch((message) => ({
                  ...message,
                  toolCalls: (message.toolCalls ?? []).map((call) =>
                    call.callId === event.callId
                      ? {
                          ...call,
                          output: event.output,
                          isError: event.isError,
                          status: event.isError ? "failed" : "completed",
                        }
                      : call,
                  ),
                }));
                break;
              case "approval":
                setPendingApproval({
                  approvalId: event.approvalId,
                  sessionId,
                  description: event.description,
                  details: event.details,
                });
                setStatus("waiting_approval");
                break;
              case "usage":
                setUsage({
                  inputTokens: event.inputTokens,
                  outputTokens: event.outputTokens,
                  estimatedCost: event.estimatedCost,
                });
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
        // A parked approval keeps its own status: the stream ends while the run
        // is still waiting on the operator, and flipping to idle here would hide
        // the pending prompt.
        setStatus((current) =>
          current === "waiting_approval" ? current : "idle",
        );
      } catch (caught) {
        if (controller.signal.aborted) {
          setStatus("idle");
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [sessionId, status, harnessLive, ensureHarnessSession],
  );

  const cancelChat = useCallback(async () => {
    abortRef.current?.abort();
    const harnessId = sessionId
      ? harnessSessions.current.get(sessionId)
      : undefined;
    if (harnessId) await cancelHarnessRun(harnessId);
    setStatus("idle");
  }, [sessionId]);

  const respondToApproval = useCallback(
    async (choice: ApprovalChoice) => {
      const harnessId = sessionId
        ? harnessSessions.current.get(sessionId)
        : undefined;
      const approvalId = pendingApproval?.approvalId;
      setPendingApproval(null);
      setStatus("idle");
      if (!harnessLive || !harnessId || !approvalId) return;
      try {
        // The daemon's verdict is three-way. "session" and "always" both map
        // to allow_always — the daemon models one persistent grant scope, and
        // splitting hairs the backend does not model would be a lie in the UI.
        await respondToHarnessApproval(
          harnessId,
          approvalId,
          choice === "deny"
            ? "deny"
            : choice === "once"
              ? "allow_once"
              : "allow_always",
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      }
    },
    [harnessLive, pendingApproval, sessionId],
  );

  const respondToClarification = useCallback(async (_response: string) => {
    setStatus("idle");
  }, []);

  return {
    messages,
    isStreaming: status === "streaming",
    status,
    error,
    harnessLive,
    sendMessage,
    cancelChat,
    pendingApproval,
    pendingClarification,
    respondToApproval,
    respondToClarification,
    usage,
  };
}
