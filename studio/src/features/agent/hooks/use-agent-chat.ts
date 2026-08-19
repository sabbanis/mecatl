"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelHarnessRun,
  createHarnessSession,
  fetchSessionTranscriptMessages,
  type PromptPart,
  respondToHarnessApproval,
  streamHarnessPrompt,
} from "@/lib/harness/client";
import type { SessionTranscript } from "@/lib/protocol";
import { useRuntimeStatus } from "../runtime-status";
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

/** Rebuilds the message list from the daemon's authoritative transcript. */
export interface QueuedMessage {
  id: string;
  text: string;
}

/** Formats every vision provider accepts; anything else gets re-encoded. */
const WIRE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
/** Above this, re-encode: phone photos are 4–12 MB and base64 inflates by
 *  a third — big payloads 413 at the daemon's byte budget. */
const MAX_INLINE_BYTES = 1_500_000;
/** Longest edge after a re-encode; ample for vision models. */
const MAX_IMAGE_EDGE = 1600;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Encode one picked image as a daemon prompt part. A small image in a
 * provider-friendly format goes as-is; everything else — big photos, HEIC
 * from iPhones — is downscaled onto a canvas and re-encoded as JPEG (the
 * browser decodes whatever the platform can, so Safari transcodes HEIC
 * here; a browser that cannot decode the format fails loudly instead).
 */
async function imageToPart(file: File): Promise<PromptPart> {
  if (WIRE_IMAGE_TYPES.has(file.type) && file.size <= MAX_INLINE_BYTES) {
    return {
      kind: "image",
      mime_type: file.type,
      data: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            `${file.name}: this browser cannot decode ${file.type || "that format"} — attach a JPEG or PNG instead.`,
          ),
        );
      el.src = url;
    });
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error(`${file.name}: could not encode the image.`);
    return {
      kind: "image",
      mime_type: "image/jpeg",
      data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function messagesFromTranscript(transcript: SessionTranscript): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let sequence = 0;
  for (const entry of transcript.messages) {
    sequence += 1;
    if (entry.role === "user") {
      messages.push({
        id: `history-user-${sequence}`,
        role: "user",
        content: entry.text,
        timestamp: 0,
      });
      continue;
    }
    if (entry.role === "assistant") {
      messages.push({
        id: `history-assistant-${sequence}`,
        role: "assistant",
        content: entry.text,
        timestamp: 0,
        toolCalls: entry.toolCalls.length
          ? entry.toolCalls.map((call) => ({
              callId: call.id,
              name: call.name,
              input: call.args,
              status: "completed" as const,
            }))
          : undefined,
      });
      continue;
    }
    // A tool entry resolves the matching call on the latest assistant turn.
    const result = entry.toolResult;
    if (!result) continue;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const call = message.toolCalls?.find(
        (candidate) => candidate.callId === result.callId,
      );
      if (call) {
        call.output = result.content;
        call.isError = result.isError;
        call.status = result.isError ? "failed" : "completed";
        break;
      }
    }
  }
  if (!transcript.complete && messages.length) {
    messages[0] = {
      ...messages[0],
      notices: [
        "This transcript could not be proven complete; earlier turns may be missing.",
        ...(messages[0].notices ?? []),
      ],
    };
  }
  return messages;
}

/**
 * Chat state for one daemon session. Daemon-only: the sidebar id IS the
 * daemon session id — there is no client-side session mapping and no demo
 * fallback. Opening a chat rehydrates its history from the authoritative
 * transcript endpoint; a null id is a draft whose daemon session is minted on
 * the first send.
 */
export function useAgentChat(
  sessionId: string | null,
  options?: { onSessionCreated?: (sessionId: string) => void },
) {
  const { connected } = useRuntimeStatus();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const [pendingClarification] = useState<ClarificationRequest | null>(null);
  const [usage, setUsage] = useState({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    estimatedCost: null as number | null,
  });

  // The daemon session backing this chat: the route id, or the one minted for
  // a draft on first send. A ref so an in-flight stream keeps its binding
  // while the parent navigates to the new id.
  const daemonIdRef = useRef<string | null>(sessionId);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string | null>(null);
  const onSessionCreatedRef = useRef(options?.onSessionCreated);
  onSessionCreatedRef.current = options?.onSessionCreated;

  // Opening a chat (or switching chats) rehydrates from the daemon.
  useEffect(() => {
    daemonIdRef.current = sessionId;
    setMessages([]);
    setPendingApproval(null);
    setError(null);
    setStatus("idle");
    if (!sessionId || !connected) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const transcript = await fetchSessionTranscriptMessages(
          sessionId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setMessages(messagesFromTranscript(transcript));
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [sessionId, connected]);

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (status === "streaming" || !connected) return;

      // Only images cross the wire — the daemon's prompt parts are
      // image/audio only (documents are a daemon capability gap).
      const images = (files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      let parts: PromptPart[];
      try {
        parts = await Promise.all(images.map(imageToPart));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return;
      }
      const attachments: Attachment[] | undefined =
        images.length > 0
          ? images.map((file) => ({ name: file.name, type: file.type }))
          : undefined;

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
      lastPromptRef.current = content;

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
        let daemonId = daemonIdRef.current;
        if (!daemonId) {
          daemonId = await createHarnessSession("default");
          daemonIdRef.current = daemonId;
          onSessionCreatedRef.current?.(daemonId);
        }
        await streamHarnessPrompt(
          daemonId,
          content,
          parts,
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
                  sessionId: daemonId as string,
                  description: event.description,
                  details: event.details,
                });
                setStatus("waiting_approval");
                break;
              case "retract":
                // The ask was withdrawn (e.g. its child was cancelled); the
                // run is still going.
                setPendingApproval((current) =>
                  current?.approvalId === event.approvalId ? null : current,
                );
                setStatus((current) =>
                  current === "waiting_approval" ? "streaming" : current,
                );
                break;
              case "notice":
                patch((message) => ({
                  ...message,
                  notices: [...(message.notices ?? []), event.text],
                }));
                break;
              case "delegation":
                patch((message) => ({
                  ...message,
                  delegations: [
                    ...(message.delegations ?? []),
                    {
                      kind: event.kind,
                      label: event.label,
                      detail: event.detail,
                    },
                  ],
                }));
                break;
              case "usage":
                // The daemon reports per-run figures; the chat total is
                // their sum. (Lost on reload: the HTTP read surface does
                // not expose the session's cumulative usage yet.)
                setUsage((prev) => ({
                  inputTokens: prev.inputTokens + event.inputTokens,
                  outputTokens: prev.outputTokens + event.outputTokens,
                  cacheReadTokens:
                    prev.cacheReadTokens + (event.cacheReadTokens ?? 0),
                  cacheWriteTokens:
                    prev.cacheWriteTokens + (event.cacheWriteTokens ?? 0),
                  reasoningTokens:
                    prev.reasoningTokens + (event.reasoningTokens ?? 0),
                  estimatedCost: event.estimatedCost,
                }));
                break;
              case "run_result":
                if (event.stop === "error") {
                  const detail =
                    event.errorText ||
                    "The run failed without a specific error.";
                  patch((message) => ({
                    ...message,
                    failed: true,
                    failureDetail: event.permanent
                      ? `${detail} (permanent — retrying the identical request cannot succeed)`
                      : detail,
                    toolCalls: (message.toolCalls ?? []).map((call) =>
                      call.status === "running"
                        ? { ...call, status: "failed" as const }
                        : call,
                    ),
                  }));
                  setError(detail);
                  setStatus("error");
                } else if (event.text) {
                  // A run that produced no deltas (a rehydrated approve, a
                  // recovered run) still carries its final text here.
                  patch((message) => ({
                    ...message,
                    content: message.content || event.text,
                  }));
                }
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
        // A parked approval keeps its own status: the stream ends while the
        // run is still waiting on the operator, and flipping to idle here
        // would hide the pending prompt. A failed turn keeps its error state.
        setStatus((current) =>
          current === "waiting_approval" || current === "error"
            ? current
            : "idle",
        );
      } catch (caught) {
        if (controller.signal.aborted) {
          setStatus("idle");
          return;
        }
        const message =
          caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setStatus("error");
        patch((current) => ({
          ...current,
          failed: true,
          failureDetail: current.failureDetail ?? message,
          toolCalls: (current.toolCalls ?? []).map((call) =>
            call.status === "running"
              ? { ...call, status: "failed" as const }
              : call,
          ),
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [status, connected],
  );

  /** Resends the last prompt after a failure (the error banner's Retry). */
  const retryLast = useCallback(async () => {
    const prompt = lastPromptRef.current;
    if (!prompt || status === "streaming") return;
    // Drop the failed exchange so the retry replaces it instead of stacking.
    setMessages((prev) => {
      const trimmed = [...prev];
      while (trimmed.length) {
        const last = trimmed[trimmed.length - 1];
        if (last.role === "assistant" && (last.failed || !last.content)) {
          trimmed.pop();
          continue;
        }
        if (last.role === "user" && last.content === prompt) {
          trimmed.pop();
        }
        break;
      }
      return trimmed;
    });
    setError(null);
    setStatus("idle");
    await sendMessage(prompt);
  }, [sendMessage, status]);

  /** A message typed while a run was active, held client-side: the daemon is
   *  strictly one-run-at-a-time (a mid-run prompt answers 412), so the queue
   *  lives here and drains one message per completed run. */
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const flushingRef = useRef(false);

  const queueMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQueuedMessages((prev) => [
      ...prev,
      { id: `queued-${Date.now()}-${prev.length}`, text: trimmed },
    ]);
  }, []);

  const deleteQueued = useCallback((id: string) => {
    setQueuedMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Removes the message from the queue and returns its text (for editing). */
  const takeQueued = useCallback(
    (id: string) => {
      const hit = queuedMessages.find((m) => m.id === id);
      if (hit) setQueuedMessages((prev) => prev.filter((m) => m.id !== id));
      return hit?.text ?? null;
    },
    [queuedMessages],
  );

  const cancelChat = useCallback(async () => {
    abortRef.current?.abort();
    if (daemonIdRef.current) await cancelHarnessRun(daemonIdRef.current);
    setStatus("idle");
  }, []);

  /** "Send now": interrupt the in-flight run and let this message continue
   *  the conversation from the partial progress. The daemon has no mid-run
   *  injection — steer is cancel → recover-at-run-entry → prompt. */
  const steerQueued = useCallback(
    (id: string) => {
      if (status === "streaming" || status === "waiting_approval") {
        setQueuedMessages((prev) => {
          const hit = prev.find((m) => m.id === id);
          if (!hit) return prev;
          return [hit, ...prev.filter((m) => m.id !== id)];
        });
        void cancelChat();
        return;
      }
      const text = takeQueued(id);
      if (text) void sendMessage(text);
    },
    [status, cancelChat, takeQueued, sendMessage],
  );

  // Drain the queue one message per completed run. Only a clean idle flushes:
  // an error waits for the user (retry/edit), a parked approval waits for the
  // verdict. flushingRef bridges the async gap before sendMessage flips the
  // status, so a re-render can't double-send.
  useEffect(() => {
    if (
      status !== "idle" ||
      !connected ||
      queuedMessages.length === 0 ||
      flushingRef.current
    ) {
      return;
    }
    flushingRef.current = true;
    const next = queuedMessages[0];
    setQueuedMessages((prev) => prev.filter((m) => m.id !== next.id));
    void sendMessage(next.text).finally(() => {
      flushingRef.current = false;
    });
  }, [status, connected, queuedMessages, sendMessage]);

  const respondToApproval = useCallback(
    async (choice: ApprovalChoice) => {
      const daemonId = daemonIdRef.current;
      const approvalId = pendingApproval?.approvalId;
      setPendingApproval(null);
      setStatus("idle");
      if (!daemonId || !approvalId) return;
      try {
        // The daemon's verdict is three-way. "session" and "always" both map
        // to allow_always — the daemon models one persistent grant scope, and
        // splitting hairs the backend does not model would be a lie in the UI.
        await respondToHarnessApproval(
          daemonId,
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
    [pendingApproval],
  );

  const respondToClarification = useCallback(async (_response: string) => {
    setStatus("idle");
  }, []);

  return {
    messages,
    isStreaming: status === "streaming",
    queuedMessages,
    queueMessage,
    deleteQueued,
    takeQueued,
    steerQueued,
    status,
    error,
    harnessLive: connected,
    sendMessage,
    retryLast,
    cancelChat,
    pendingApproval,
    pendingClarification,
    respondToApproval,
    respondToClarification,
    usage,
  };
}
