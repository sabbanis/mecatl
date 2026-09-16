import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentPill,
  commandMenuItems,
  resolveComposerAction,
  resolveComposerSubmission,
} from "./chat-input";

// The composer's `/` menu reads the daemon's command list through this
// module-level getter; the local-command tests swap it for a fixed roster
// and keep every other export (the Studio builtins) real.
const daemon = vi.hoisted(() => ({
  commands: [] as { name: string; description: string }[],
}));
vi.mock("@/features/agent/composer-capabilities", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/agent/composer-capabilities")
  >()),
  getSlashCommands: () => daemon.commands,
}));

/**
 * Studio's built-ins (`/clear /help /session /retry /diagnostics /compact`)
 * are intercepted on send: a bare one runs locally instead of reaching the
 * agent, a held one (arguments, a second line) or a gated-off one stays in
 * the editor with a warning, and the `/` menu lists them ahead of the
 * daemon's commands. Both halves are pure and tested here — interception
 * through `resolveComposerSubmission`, the helper performAction runs BEFORE
 * its steer/queue/send branches, so a built-in typed mid-stream is
 * intercepted identically (never queued or steered).
 */
describe("resolveComposerSubmission", () => {
  const OPEN = { manualCompaction: true };

  it("runs a bare built-in, case-insensitively, with trailing whitespace", () => {
    for (const text of ["/help", "/HELP ", "/Help\n", "/clear"]) {
      expect(
        resolveComposerSubmission({ text, gates: OPEN, hasHandler: true }),
      ).toEqual({
        action: "builtin",
        name: text.trim().toLowerCase().slice(1),
      });
    }
  });

  it("holds a built-in with arguments, even while streaming", () => {
    expect(
      resolveComposerSubmission({
        text: "/clear now",
        gates: OPEN,
        hasHandler: true,
        isStreaming: true,
      }),
    ).toEqual({
      action: "hold",
      warning: "/clear takes no arguments — remove the text to run it",
    });
  });

  it("holds a gated-off built-in with the daemon warning", () => {
    expect(
      resolveComposerSubmission({
        text: "/compact",
        gates: { manualCompaction: false },
        hasHandler: true,
      }),
    ).toEqual({
      action: "hold",
      warning: "/compact is not available on this daemon",
    });
    // No gates at all fails closed the same way.
    expect(
      resolveComposerSubmission({ text: "/compact", hasHandler: true }),
    ).toMatchObject({ action: "hold" });
  });

  it("passes everything else to the agent", () => {
    for (const text of ["/helpme", "help", "", "/review", "/deploy prod"]) {
      expect(
        resolveComposerSubmission({ text, gates: OPEN, hasHandler: true }),
      ).toEqual({ action: "pass" });
    }
  });

  it("passes even a bare built-in where no handler is wired", () => {
    expect(
      resolveComposerSubmission({
        text: "/help",
        gates: OPEN,
        hasHandler: false,
      }),
    ).toEqual({ action: "pass" });
  });
});

describe("commandMenuItems", () => {
  const STUDIO_HELP = "show keys & features";
  const OPEN = { manualCompaction: true };

  beforeEach(() => {
    daemon.commands = [{ name: "review", description: "Review a diff" }];
  });

  it("lists the Studio builtins first, in fixed order, then the daemon's commands", () => {
    const items = commandMenuItems("", { gates: OPEN });
    expect(items.map((i) => i.id)).toEqual([
      "clear",
      "help",
      "session",
      "retry",
      "diagnostics",
      "compact",
      "review",
    ]);
    expect(items[1]?.primary).toBe("/help");
    expect(items[1]?.secondary).toBe(STUDIO_HELP);
    // Builtin rows carry the mark the palette renders as a terminal glyph;
    // daemon rows do not.
    expect(items.slice(0, 6).every((i) => i.builtin === true)).toBe(true);
    expect(items[6]?.builtin).toBeUndefined();
  });

  it("hides /compact unless the daemon enables manual compaction", () => {
    expect(
      commandMenuItems("", { gates: { manualCompaction: false } }).map(
        (i) => i.id,
      ),
    ).not.toContain("compact");
    // No gates at all fails closed.
    expect(commandMenuItems("").map((i) => i.id)).not.toContain("compact");
  });

  it("filters both layers by prefix", () => {
    expect(commandMenuItems("he", { gates: OPEN }).map((i) => i.id)).toEqual([
      "help",
    ]);
    expect(commandMenuItems("re", { gates: OPEN }).map((i) => i.id)).toEqual([
      "retry",
      "review",
    ]);
  });

  it("shadows a daemon command named like a builtin — the Studio row wins", () => {
    daemon.commands = [
      { name: "help", description: "daemon help" },
      { name: "review", description: "Review a diff" },
    ];
    const items = commandMenuItems("", { gates: OPEN });
    expect(items.filter((i) => i.id === "help")).toHaveLength(1);
    expect(items.find((i) => i.id === "help")?.secondary).toBe(STUDIO_HELP);
    expect(items.at(-1)?.id).toBe("review");
  });

  it("omits the builtins for a surface with no local-command handler", () => {
    daemon.commands = [{ name: "help", description: "daemon help" }];
    const items = commandMenuItems("", { builtins: false, gates: OPEN });
    expect(items.map((i) => i.id)).toEqual(["help"]);
    expect(items[0]?.secondary).toBe("daemon help");
    expect(items[0]?.builtin).toBeUndefined();
  });
});

/**
 * The Enter matrix is tested through `resolveComposerAction`, the pure
 * decision function the composer's keydown handler and send button both call.
 * Driving the TipTap editor's ProseMirror view with synthetic keydowns in
 * jsdom is impractical (the editor mounts asynchronously and owns its own
 * capture-phase handlers), so the decision table is extracted and tested
 * exhaustively instead; "newline" means the key is NOT intercepted — the
 * editor's own hardBreak inserts the newline and onSend is never called.
 */
describe("resolveComposerAction", () => {
  const resolve = (
    shift: boolean,
    isStreaming: boolean,
    behavior: "queue" | "steer",
  ) => resolveComposerAction({ shift, isStreaming, behavior });

  it("sends on idle Enter, whatever the preference", () => {
    expect(resolve(false, false, "queue")).toBe("send");
    expect(resolve(false, false, "steer")).toBe("send");
  });

  it("keeps idle Shift+Enter as a newline (the key is not intercepted, so onSend is never called)", () => {
    expect(resolve(true, false, "queue")).toBe("newline");
    expect(resolve(true, false, "steer")).toBe("newline");
  });

  it("queues on streaming Enter with the default preference", () => {
    expect(resolve(false, true, "queue")).toBe("queue");
  });

  it("steers on streaming Shift+Enter with the default preference", () => {
    expect(resolve(true, true, "queue")).toBe("steer");
  });

  it("inverts both keys when the preference is steer", () => {
    expect(resolve(false, true, "steer")).toBe("steer");
    expect(resolve(true, true, "steer")).toBe("queue");
  });

  // Attachments no longer force the queue path: a steer carries staged image
  // parts (ADR 0251). Availability is the handler's business — performAction
  // degrades steer→queue when onSteer is absent, keeping the files attached.
});

describe("AttachmentPill", () => {
  // jsdom has no object-URL implementation; stub the pair the pill uses.
  const createObjectURL = vi.fn(() => "blob:thumb");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a thumbnail for an image file and revokes its object URL on unmount", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const { container, unmount } = render(
      <AttachmentPill file={file} onRemove={() => {}} />,
    );
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:thumb",
      ),
    );
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:thumb");
  });

  it("shows a file-kind glyph, not a thumbnail, for a non-image file", () => {
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    const { container } = render(
      <AttachmentPill file={file} onRemove={() => {}} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="PDF"]')).toBeTruthy();
    expect(container.textContent).toContain("report.pdf");
  });
});
