import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentPill,
  commandMenuItems,
  matchLocalCommand,
  resolveComposerAction,
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
 * `/help` is Studio's own command: typed as the whole message it opens the
 * reference page instead of reaching the agent, and the `/` menu lists it
 * ahead of the daemon's commands. Both halves are pure and tested here.
 */
describe("matchLocalCommand", () => {
  it("matches a lone /help, case-insensitively, with trailing whitespace", () => {
    expect(matchLocalCommand("/help")).toBe("help");
    expect(matchLocalCommand("/HELP ")).toBe("help");
    expect(matchLocalCommand("/Help\n")).toBe("help");
  });

  it("leaves anything else to the agent", () => {
    expect(matchLocalCommand("/helpme")).toBeNull();
    expect(matchLocalCommand("help")).toBeNull();
    expect(matchLocalCommand("/help now")).toBeNull();
    expect(matchLocalCommand("")).toBeNull();
    expect(matchLocalCommand("/review")).toBeNull();
  });
});

describe("commandMenuItems", () => {
  const STUDIO_HELP = "Keyboard shortcuts and daemon features (Studio)";

  beforeEach(() => {
    daemon.commands = [{ name: "review", description: "Review a diff" }];
  });

  it("lists the Studio /help builtin first, then the daemon's commands", () => {
    const items = commandMenuItems("");
    expect(items.map((i) => i.id)).toEqual(["help", "review"]);
    expect(items[0]?.primary).toBe("/help");
    expect(items[0]?.secondary).toBe(STUDIO_HELP);
  });

  it("keeps /help while the prefix matches and drops it otherwise", () => {
    expect(commandMenuItems("he").map((i) => i.id)).toEqual(["help"]);
    expect(commandMenuItems("re").map((i) => i.id)).toEqual(["review"]);
  });

  it("shadows a daemon command named like a builtin — the Studio row wins", () => {
    daemon.commands = [
      { name: "help", description: "daemon help" },
      { name: "review", description: "Review a diff" },
    ];
    const items = commandMenuItems("");
    expect(items.map((i) => i.id)).toEqual(["help", "review"]);
    expect(items[0]?.secondary).toBe(STUDIO_HELP);
  });

  it("omits the builtins for a surface with no local-command handler", () => {
    daemon.commands = [{ name: "help", description: "daemon help" }];
    const items = commandMenuItems("", { builtins: false });
    expect(items.map((i) => i.id)).toEqual(["help"]);
    expect(items[0]?.secondary).toBe("daemon help");
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
