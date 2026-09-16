import { afterEach, describe, expect, it, vi } from "vitest";
import { resetHarnessClient } from "./sdk";
import { sessionSnapshot, stubHarnessFetch } from "./sdk-test-stub";
import { fetchHarnessSessionDetail } from "./sessions";

/**
 * Pins the GET-session projections the context meter and usage facets read:
 * the durable session-cumulative `token_usage["main"].total` bucket (bigint
 * counters → numbers), the `resolved_model.reasoning_effort` echo, and the
 * honest null when a daemon omits the usage map or the main bucket.
 */

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

const snapshotRoute =
  (extra: Record<string, unknown>) =>
  (request: { path: string }): unknown =>
    request.path === "/v1/sessions/s1"
      ? sessionSnapshot("s1", extra)
      : undefined;

describe("fetchHarnessSessionDetail token usage", () => {
  it("projects token_usage.main.total and the reasoning-effort echo", async () => {
    stubHarnessFetch(
      snapshotRoute({
        resolved_model: {
          provider_id: "anthropic",
          model_id: "claude-sonnet",
          context_window: "200000",
          reasoning_effort: "high",
        },
        token_usage: {
          main: {
            total: {
              input_tokens: "120",
              output_tokens: "40",
              cache_read_tokens: "30",
              cache_write_tokens: "5",
              reasoning_tokens: "12",
            },
            models: {},
          },
        },
      }),
    );
    const detail = await fetchHarnessSessionDetail("s1");
    expect(detail.resolvedModel).toEqual({
      providerId: "anthropic",
      modelId: "claude-sonnet",
      contextWindow: 200000,
      reasoningEffort: "high",
    });
    expect(detail.tokenUsage).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      cacheReadTokens: 30,
      cacheWriteTokens: 5,
      reasoningTokens: 12,
    });
  });

  it("returns null tokenUsage when the snapshot omits the usage map", async () => {
    stubHarnessFetch(snapshotRoute({}));
    const detail = await fetchHarnessSessionDetail("s1");
    expect(detail.tokenUsage).toBeNull();
  });

  it("returns null tokenUsage when only non-main buckets are reported", async () => {
    stubHarnessFetch(
      snapshotRoute({
        token_usage: {
          subagent: { total: { input_tokens: "9" }, models: {} },
        },
      }),
    );
    const detail = await fetchHarnessSessionDetail("s1");
    expect(detail.tokenUsage).toBeNull();
  });

  it("zero-fills counters the main total leaves out", async () => {
    stubHarnessFetch(
      snapshotRoute({
        token_usage: {
          main: { total: { input_tokens: "7" }, models: {} },
        },
      }),
    );
    const detail = await fetchHarnessSessionDetail("s1");
    expect(detail.tokenUsage).toEqual({
      inputTokens: 7,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    });
  });
});
