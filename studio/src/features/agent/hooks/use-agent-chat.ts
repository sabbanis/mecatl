"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelHarnessRun,
  cancelHarnessSteer,
  createHarnessSession,
  fetchSessionTranscriptMessages,
  type PromptPart,
  respondToHarnessApproval,
  steerHarnessRun,
  streamHarnessPrompt,
} from "@/lib/harness/client";
import {
  encodeSessionPermissionMode,
  type SessionPermissionMode,
  type SessionTranscript,
} from "@/lib/protocol";
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

/** A steer the daemon accepted but has not yet drained into the run. */
export interface PendingSteer {
  id: string;
  text: string;
}

/**
 * Splits the ordered pending-steer list on the drain echo's watermark: every
 * steer up to AND including the matching id was merged into the drained
 * bundle and drops. An empty or unmatched id clears the whole list — the
 * daemon's correlation FIFO is authoritative, so an echo we cannot correlate
 * means the local list is stale. Never text-match.
 */
export function splitPendingSteersOnWatermark(
  pending: readonly PendingSteer[],
  messageId: string,
): PendingSteer[] {
  if (!messageId) return [];
  const index = pending.findIndex((steer) => steer.id === messageId);
  if (index === -1) return [];
  return pending.slice(index + 1);
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
  options?: {
    onSessionCreated?: (sessionId: string) => void;
    /** The permission mode a draft's lazily-minted session is created with
     *  (the composer's pending Mode selection). Read at mint time — a ref-like
     *  getter, because the selection can change after this render's closure. */
    createMode?: () => SessionPermissionMode;
  },
) {
  const { connected } = useRuntimeStatus();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const [pendingClarification] = useState<ClarificationRequest | null>(null);
  /** Steers the daemon accepted but has not yet drained into the run, in send
   *  order. The stream's `steer` echo splits this list on its watermark id. */
  const [pendingSteers, setPendingSteers] = useState<PendingSteer[]>([]);
  const steerSerialRef = useRef(0);
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
  const createModeRef = useRef(options?.createMode);
  createModeRef.current = options?.createMode;

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
          daemonId = await createHarnessSession(
            encodeSessionPermissionMode(createModeRef.current?.() ?? "default"),
          );
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
              case "steer":
                // The daemon drained the pending steer bundle into the run:
                // show the merged text as a user turn and drop every pending
                // steer up to and including the watermark id.
                if (event.text) {
                  const echo: AgentMessage = {
                    id: `steer-echo-${Date.now()}`,
                    role: "user",
                    content: event.text,
                    timestamp: Date.now(),
                  };
                  setMessages((prev) => [...prev, echo]);
                }
                setPendingSteers((prev) =>
                  splitPendingSteersOnWatermark(prev, event.messageId),
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

  /**
   * Binds this hook to an ALREADY-CREATED daemon session without re-keying it.
   * The thread panel mints its own seeded session (source_session_id must be
   * carried, and the 412-busy case has to keep the composer text), then
   * adopts the id here so the first send streams against it. Re-keying the
   * hook instead would refetch the transcript mid-stream and wipe the
   * optimistic messages — the same reason a draft keeps its null hook id
   * after minting.
   */
  const adoptSession = useCallback((id: string) => {
    daemonIdRef.current = id;
  }, []);

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

  /**
   * Injects a message into the in-flight run at the next turn boundary.
   * accepted/appended park it on the pending list until the drain echo;
   * too_late (or a failed request) falls back to the queue so the text is
   * never lost — the queue drains it as a normal prompt.
   */
  const steerMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const daemonId = daemonIdRef.current;
      if (!daemonId) {
        queueMessage(trimmed);
        return;
      }
      steerSerialRef.current += 1;
      const id = `steer-${Date.now()}-${steerSerialRef.current}`;
      try {
        const { outcome } = await steerHarnessRun(daemonId, trimmed, id);
        if (outcome === "accepted" || outcome === "appended") {
          setPendingSteers((prev) => [...prev, { id, text: trimmed }]);
          return;
        }
        queueMessage(trimmed);
      } catch (caught) {
        queueMessage(trimmed);
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [queueMessage],
  );

  /** "Steer": pull a queued message and inject it into the in-flight run at
   *  the next turn boundary; on an idle chat it just sends. */
  const steerQueued = useCallback(
    (id: string) => {
      const text = takeQueued(id);
      if (!text) return;
      if (status === "streaming" || status === "waiting_approval") {
        void steerMessage(text);
        return;
      }
      void sendMessage(text);
    },
    [status, takeQueued, steerMessage, sendMessage],
  );

  /**
   * Retracts the pending steer bundle. The daemon models one bundle per run —
   * only the whole thing can be retracted, not a single message. On
   * `none_pending` the bundle already drained (the echo reconciles the list),
   * so the pending list clears on either outcome.
   */
  const cancelPendingSteers = useCallback(async () => {
    const daemonId = daemonIdRef.current;
    if (!daemonId) {
      setPendingSteers([]);
      return;
    }
    try {
      await cancelHarnessSteer(daemonId);
      setPendingSteers([]);
    } catch (caught) {
      // Unknown daemon state: keep the list rather than pretend it retracted.
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  // On run end, steers that never drained were dropped with the run (the
  // daemon's steer buffer is run-scoped, best-effort): move them to the FRONT
  // of the queue, in order, so the drain below sends them as normal prompts —
  // never lose text. Runs on error too: the texts wait visibly in the strip.
  useEffect(() => {
    if (status !== "idle" && status !== "error") return;
    if (pendingSteers.length === 0) return;
    const orphaned = pendingSteers;
    setPendingSteers([]);
    setQueuedMessages((prev) => [
      ...orphaned.map((steer) => ({
        id: `queued-${steer.id}`,
        text: steer.text,
      })),
      ...prev,
    ]);
  }, [status, pendingSteers]);

  // Drain the queue one message per completed run. Only a clean idle flushes:
  // an error waits for the user (retry/edit), a parked approval waits for the
  // verdict, and orphaned pending steers get requeued (above) before anything
  // sends. flushingRef bridges the async gap before sendMessage flips the
  // status, so a re-render can't double-send.
  useEffect(() => {
    if (
      status !== "idle" ||
      !connected ||
      queuedMessages.length === 0 ||
      pendingSteers.length > 0 ||
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
  }, [status, connected, queuedMessages, pendingSteers, sendMessage]);

  const respondToApproval = useCallback(
    async (choice: ApprovalChoice) => {
      const daemonId = daemonIdRef.current;
      const approvalId = pendingApproval?.approvalId;
      setPendingApproval(null);
      // The verdict resumes the SAME run — the prompt stream stays open and
      // keeps delivering (the daemon acks the approve; only the run's end
      // closes the stream). Mirror the retract handler: back to streaming,
      // never idle — a premature idle here let the steer-requeue and queue
      // drain effects fire against the still-live run (a pending steer got
      // re-sent as a prompt that 412s). The stream's own end handler owns
      // the eventual idle.
      setStatus((current) =>
        current === "waiting_approval" ? "streaming" : current,
      );
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
    pendingSteers,
    steerMessage,
    cancelPendingSteers,
    status,
    error,
    harnessLive: connected,
    sendMessage,
    adoptSession,
    retryLast,
    cancelChat,
    pendingApproval,
    pendingClarification,
    respondToApproval,
    respondToClarification,
    usage,
  };
}
