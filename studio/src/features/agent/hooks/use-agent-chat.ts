"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadSentAttachments,
  saveSentAttachments,
} from "@/lib/attachment-store";
import { fileFromToolCall } from "@/lib/file-meta";
import {
  cancelHarnessRun,
  createHarnessSession,
  fetchSessionTranscriptMessages,
  HarnessApiError,
  type PromptPart,
  respondToHarnessApproval,
  retryHarnessRun,
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
  DelegationInfo,
  RetryDisposition,
  StreamEvent,
  ToolCallInfo,
} from "../types";

type ChatStatus =
  | "idle"
  | "streaming"
  | "waiting_approval"
  | "waiting_clarification"
  | "error";

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
              file: fileFromToolCall(call.name, call.args),
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
 * Applies one live child-activity event (`delegation_progress` /
 * `delegation_end`, D1) onto the delegation card it belongs to, searching the
 * transcript backwards for the entry keyed by `childId`. Pure — a new array
 * on a hit, the SAME array when the child has no card (a progress frame whose
 * start this visit never saw updates nothing).
 */
export function applyDelegationUpdate(
  messages: AgentMessage[],
  event: Extract<
    StreamEvent,
    { type: "delegation_progress" | "delegation_end" }
  >,
): AgentMessage[] {
  const apply = (delegation: DelegationInfo): DelegationInfo =>
    event.type === "delegation_progress"
      ? {
          ...delegation,
          toolCount: event.toolCount ?? delegation.toolCount,
          inputTokens: event.inputTokens ?? delegation.inputTokens,
          outputTokens: event.outputTokens ?? delegation.outputTokens,
          lastTool: event.toolName ?? delegation.lastTool,
        }
      : {
          ...delegation,
          toolCount: event.toolCount ?? delegation.toolCount,
          inputTokens: event.inputTokens ?? delegation.inputTokens,
          outputTokens: event.outputTokens ?? delegation.outputTokens,
          stop: event.stop || "end_turn",
          durationMs: event.durationMs,
          cause: event.cause,
        };
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      !message.delegations?.some(
        (delegation) => delegation.childId === event.childId,
      )
    ) {
      continue;
    }
    const updated: AgentMessage = {
      ...message,
      delegations: message.delegations.map((delegation) =>
        delegation.childId === event.childId ? apply(delegation) : delegation,
      ),
    };
    return [...messages.slice(0, index), updated, ...messages.slice(index + 1)];
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
    /** The composer's pending model pick ("" = auto-routed); read at mint
     *  time like createMode. */
    createModel?: () => { modelId: string; providerId: string } | null;
  },
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
  // The last failed terminal's typed disposition (ADR 0239), captured from
  // run_result frames: "retryable" routes retryLast through the retry
  // endpoint instead of re-sending the prompt. Cleared when a run starts.
  const lastDispositionRef = useRef<RetryDisposition | undefined>(undefined);
  // Attachments sent this visit, keyed by session: the daemon's transcript
  // carries no attachment bytes, so every rehydrate would strip the chips —
  // this ref re-attaches them by matching user turns in send order.
  const sentAttachmentsRef = useRef(
    new Map<string, { content: string; attachments: Attachment[] }[]>(),
  );

  const onSessionCreatedRef = useRef(options?.onSessionCreated);
  onSessionCreatedRef.current = options?.onSessionCreated;
  const createModeRef = useRef(options?.createMode);
  createModeRef.current = options?.createMode;
  const createModelRef = useRef(options?.createModel);
  createModelRef.current = options?.createModel;

  /**
   * Rebuilds the message list from the daemon's authoritative transcript,
   * re-attaching this visit's sent-attachment bytes.
   */
  const rehydrate = useCallback(async (id: string, signal?: AbortSignal) => {
    const transcript = await fetchSessionTranscriptMessages(id, signal);
    if (signal?.aborted) return;
    const rebuilt = messagesFromTranscript(transcript);
    let sent = sentAttachmentsRef.current.get(id);
    if (!sent?.length) {
      // A fresh visit: the bytes live only in IndexedDB.
      const stored = await loadSentAttachments(id);
      if (signal?.aborted) return;
      if (stored.length) {
        sentAttachmentsRef.current.set(id, stored);
        sent = stored;
      }
    }
    if (sent?.length) {
      const pool = [...sent];
      for (const message of rebuilt) {
        if (message.role !== "user") continue;
        const index = pool.findIndex(
          (record) => record.content === message.content,
        );
        if (index !== -1) {
          message.attachments = pool[index].attachments;
          pool.splice(index, 1);
        }
      }
    }
    setMessages(rebuilt);
  }, []);

  // Opening a chat (or switching chats) rehydrates from the daemon.
  useEffect(() => {
    daemonIdRef.current = sessionId;
    lastDispositionRef.current = undefined;
    setMessages([]);
    setPendingApproval(null);
    setError(null);
    setStatus("idle");
    // Usage is per-visit, per-chat: the context meter must not carry one
    // chat's spend into the next.
    setUsage({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      estimatedCost: null,
    });
    if (!sessionId || !connected) return;
    const controller = new AbortController();
    void rehydrate(sessionId, controller.signal).catch((caught) => {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    });
    return () => controller.abort();
  }, [sessionId, connected, rehydrate]);

  /**
   * Builds the per-run stream-event handler shared by the prompt stream and
   * the failed-step retry relay (ADR 0239) — both drive the SAME translated
   * event switch.
   */
  const makeStreamHandler = useCallback(
    (daemonId: string, ids: { assistant: string }) => {
      // Every update is a functional setState: tokens and tool results arrive
      // faster than React commits, so reading the previous array from the
      // closure would drop frames (rerender-functional-setstate).
      const patch = (apply: (message: AgentMessage) => AgentMessage) =>
        setMessages((prev) =>
          prev.map((message) =>
            message.id === ids.assistant ? apply(message) : message,
          ),
        );
      return (event: StreamEvent) => {
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
              file: event.file,
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
              sessionId: daemonId,
              toolName: event.toolName,
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
                  childId: event.childId,
                  background: event.background,
                  routingReason: event.routingReason,
                },
              ],
            }));
            break;
          case "delegation_progress":
          case "delegation_end":
            // Live child cards (D1): counters tick while the child works;
            // the terminal stamps stop/duration/cause onto the card.
            setMessages((prev) => applyDelegationUpdate(prev, event));
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
              // The typed disposition routes the Retry button (ADR 0239).
              lastDispositionRef.current = event.retryDisposition;
              const detail =
                event.errorText || "The run failed without a specific error.";
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
      };
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (!connected) return;
      if (status === "streaming" || status === "waiting_approval") return;

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
      // Each image attachment carries the SAME bytes the wire part holds (a
      // data: URL), so the chip's thumbnail and the canvas preview work on
      // the live message. Rehydrated transcripts have no bytes — the daemon
      // never echoes attachment content — so old messages stay preview-less.
      const attachments: Attachment[] | undefined =
        images.length > 0
          ? images.map((file, index) => {
              const part = parts[index];
              return {
                name: file.name,
                type: file.type,
                url: part
                  ? `data:${part.mime_type};base64,${part.data}`
                  : undefined,
              };
            })
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
      if (attachments && daemonIdRef.current) {
        const log = sentAttachmentsRef.current.get(daemonIdRef.current) ?? [];
        log.push({ content, attachments });
        sentAttachmentsRef.current.set(daemonIdRef.current, log);
        void saveSentAttachments(daemonIdRef.current, log);
      }
      setError(null);
      lastPromptRef.current = content;

      const ids = { assistant: `assistant-${Date.now()}` };
      setMessages((prev) => [
        ...prev,
        {
          id: ids.assistant,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      // Failure patches outside the stream handler target the assistant
      // bubble.
      const patch = (apply: (message: AgentMessage) => AgentMessage) =>
        setMessages((prev) =>
          prev.map((message) =>
            message.id === ids.assistant ? apply(message) : message,
          ),
        );

      let daemonId = daemonIdRef.current;
      try {
        if (!daemonId) {
          const createModel = createModelRef.current?.() ?? null;
          daemonId = await createHarnessSession(
            encodeSessionPermissionMode(createModeRef.current?.() ?? "default"),
            createModel
              ? {
                  modelId: createModel.modelId,
                  providerId: createModel.providerId,
                }
              : {},
          );
          daemonIdRef.current = daemonId;
          // The pre-mint record above keyed nothing; re-key it now.
          if (attachments) {
            const log = sentAttachmentsRef.current.get(daemonId) ?? [];
            if (
              !log.some(
                (r) => r.content === content && r.attachments === attachments,
              )
            ) {
              log.push({ content, attachments });
            }
            sentAttachmentsRef.current.set(daemonId, log);
            void saveSentAttachments(
              daemonId,
              sentAttachmentsRef.current.get(daemonId) ?? [],
            );
          }
          onSessionCreatedRef.current?.(daemonId);
        }
        lastDispositionRef.current = undefined;
        await streamHarnessPrompt(
          daemonId,
          content,
          parts,
          makeStreamHandler(daemonId, ids),
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
    [status, connected, makeStreamHandler],
  );

  /** Re-sends the last prompt after a failure — the legacy Retry path, kept
   *  for permanent/unknown dispositions and older daemons. */
  const resendLast = useCallback(async () => {
    const prompt = lastPromptRef.current;
    if (!prompt) return;
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
  }, [sendMessage]);

  /**
   * The error banner's Retry. When the failed terminal was typed RETRYABLE
   * (ADR 0239), this drives `POST .../retry`: the daemon re-drives the
   * recorded failed step itself and relays the run as SSE — no user message
   * is re-sent, which is exactly the duplicate-effects path the endpoint
   * exists to prevent. A 409 `failed_step_retry_ineligible` (the intent
   * raced away) falls back to the resend path; a PERMANENT or untyped
   * failure keeps the resend path (and the composer's edit-and-resend).
   */
  const retryLast = useCallback(async () => {
    if (status === "streaming") return;
    const daemonId = daemonIdRef.current;
    if (lastDispositionRef.current !== "retryable" || !daemonId || !connected) {
      await resendLast();
      return;
    }
    // Drop the failed assistant bubble — the retried step streams into a
    // fresh one; the user message stays (nothing is re-sent).
    setMessages((prev) => {
      const trimmed = [...prev];
      while (trimmed.length) {
        const last = trimmed[trimmed.length - 1];
        if (last.role === "assistant" && (last.failed || !last.content)) {
          trimmed.pop();
          continue;
        }
        break;
      }
      return trimmed;
    });
    setError(null);
    setStatus("streaming");

    const ids = { assistant: `assistant-${Date.now()}` };
    setMessages((prev) => [
      ...prev,
      {
        id: ids.assistant,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    lastDispositionRef.current = undefined;
    let ineligible = false;
    try {
      await retryHarnessRun(
        daemonId,
        makeStreamHandler(daemonId, ids),
        controller.signal,
      );
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
      if (
        caught instanceof HarnessApiError &&
        (caught.code === "failed_step_retry_ineligible" ||
          caught.status === 409)
      ) {
        // The retry intent is gone daemon-side (another client acted, or
        // the state moved on): quietly fall back to re-sending the prompt.
        ineligible = true;
      } else {
        const message =
          caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
    if (ineligible) await resendLast();
  }, [status, connected, resendLast, makeStreamHandler]);

  const cancelChat = useCallback(async () => {
    abortRef.current?.abort();
    if (daemonIdRef.current) {
      await cancelHarnessRun(daemonIdRef.current);
    }
    setStatus("idle");
  }, []);

  const respondToApproval = useCallback(
    async (choice: ApprovalChoice) => {
      const daemonId = daemonIdRef.current;
      const approvalId = pendingApproval?.approvalId;
      setPendingApproval(null);
      // The verdict resumes the SAME run — the prompt stream stays open and
      // keeps delivering (the daemon acks the approve; only the run's end
      // closes the stream). Mirror the retract handler: back to streaming,
      // never idle. The stream's own end handler owns the eventual idle.
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

  /** Re-fetches the authoritative transcript (e.g. after a manual compaction
   *  rewrote the model history, B1.3). No-op on a draft with no session. */
  const refreshTranscript = useCallback(async () => {
    const daemonId = daemonIdRef.current;
    if (!daemonId) return;
    await rehydrate(daemonId);
  }, [rehydrate]);

  return {
    messages,
    // A parked approval is still an in-flight run daemon-side; the composer
    // treats both as "run active".
    isStreaming: status === "streaming" || status === "waiting_approval",
    status,
    error,
    harnessLive: connected,
    sendMessage,
    retryLast,
    refreshTranscript,
    cancelChat,
    pendingApproval,
    pendingClarification,
    respondToApproval,
    respondToClarification,
    usage,
  };
}
