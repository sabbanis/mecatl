/**
 * Studio's client-owned slash commands — the web analogue of the TUI's
 * always-present built-in layer (cmd/mecatui/ui/builtins.go). They sit ahead
 * of the daemon's per-session commands in the composer's `/` palette and are
 * intercepted locally on send: a bare `/clear` never reaches the model.
 *
 * Pure module: the list, its capability gates, and the classifier the
 * composer runs on every submission. No daemon call lives here — the daemon's
 * own command list stays in composer-capabilities.ts.
 *
 * `/quit` and `/exit` have no web analogue and are deliberately omitted.
 */

export type StudioBuiltinCommand =
  | "clear"
  | "help"
  | "session"
  | "retry"
  | "diagnostics"
  | "compact";

/** What the daemon enables; a hidden built-in typed anyway is refused with
 *  a local warning rather than sent to the model. */
export interface BuiltinGates {
  /** `serverCapabilities.manual_compaction === true` (ADR 0244). */
  readonly manualCompaction: boolean;
}

/** Fail-closed default: every gated built-in hidden. */
export const CLOSED_BUILTIN_GATES: BuiltinGates = { manualCompaction: false };

export interface BuiltinSlashCommand {
  readonly name: StudioBuiltinCommand;
  readonly description: string;
  /** Marks the row for the palette (Terminal glyph) and the send path. */
  readonly builtin: true;
}

/** The fixed palette order — the TUI's, minus `/quit`. */
const BUILTIN_ORDER: readonly StudioBuiltinCommand[] = [
  "clear",
  "help",
  "session",
  "retry",
  "diagnostics",
  "compact",
];

/** Descriptions mirror builtins.go so the two clients read alike. */
const BUILTIN_DESCRIPTIONS: Readonly<Record<StudioBuiltinCommand, string>> = {
  clear: "clear the conversation",
  help: "show keys & features",
  session: "show active session details and copy its exact ID",
  retry:
    "retry the last eligible failed model step without resending its prompt",
  diagnostics: "send a concise client and server diagnostics report",
  compact: "compact this session's model history",
};

/**
 * Every built-in, in palette order, gates applied or not. The ungated list
 * is what the help reference documents; the gated one is what the palette
 * offers.
 */
export const STUDIO_BUILTIN_COMMANDS: readonly BuiltinSlashCommand[] =
  BUILTIN_ORDER.map((name) => ({
    name,
    description: BUILTIN_DESCRIPTIONS[name],
    builtin: true,
  }));

/** True when `name` is one of Studio's own slash commands. */
export function isStudioBuiltinCommand(
  name: string,
): name is StudioBuiltinCommand {
  return (BUILTIN_ORDER as readonly string[]).includes(name);
}

/** A built-in the daemon's capabilities hide from the palette. */
function isGatedOff(name: StudioBuiltinCommand, gates: BuiltinGates): boolean {
  return name === "compact" && !gates.manualCompaction;
}

/** The palette rows: built-ins in fixed order, gated ones hidden. */
export function builtinSlashCommands(
  gates: BuiltinGates,
): readonly BuiltinSlashCommand[] {
  return STUDIO_BUILTIN_COMMANDS.filter(
    (command) => !isGatedOff(command.name, gates),
  );
}

export type SlashLineClass =
  /** Not a built-in: the text goes to the daemon as an ordinary prompt
   *  (workspace commands keep their server-side expansion). */
  | { readonly kind: "pass" }
  /** A bare built-in: run it locally, never send it. */
  | { readonly kind: "builtin"; readonly name: StudioBuiltinCommand }
  /** A built-in the daemon hides: refuse with a local warning. */
  | {
      readonly kind: "gated";
      readonly name: StudioBuiltinCommand;
      readonly reason: string;
    }
  /** A built-in with trailing text: hold it — no built-in takes arguments. */
  | {
      readonly kind: "held";
      readonly name: StudioBuiltinCommand;
      readonly reason: string;
    };

/** The warning shown when a built-in is typed with text after it. */
export function heldReason(name: StudioBuiltinCommand): string {
  return `/${name} takes no arguments — remove the text to run it`;
}

/** The warning shown when a capability-hidden built-in is typed anyway. */
export function gatedReason(name: StudioBuiltinCommand): string {
  return `/${name} is not available on this daemon`;
}

/**
 * Classifies one composer submission. Only the FIRST line is read: it must be
 * exactly `/name` or `/name args` (whitespace-trimmed, name case-insensitive)
 * to be a candidate at all. Every built-in is argument-free, so `/name args`
 * — or a second line — is `held`, a hidden built-in is `gated`, an unknown
 * `/x` (a daemon workspace command) or any other text is `pass`.
 */
export function classifySlashLine(
  text: string,
  gates: BuiltinGates,
): SlashLineClass {
  const newline = text.indexOf("\n");
  const firstLine = (newline === -1 ? text : text.slice(0, newline)).trim();
  const rest = newline === -1 ? "" : text.slice(newline + 1).trim();
  const match = /^\/(\S+)(?:\s+(.*))?$/.exec(firstLine);
  if (!match) return { kind: "pass" };
  const name = (match[1] ?? "").toLowerCase();
  if (!isStudioBuiltinCommand(name)) return { kind: "pass" };
  if (isGatedOff(name, gates)) {
    return { kind: "gated", name, reason: gatedReason(name) };
  }
  const args = (match[2] ?? "").trim();
  if (args || rest) return { kind: "held", name, reason: heldReason(name) };
  return { kind: "builtin", name };
}

/**
 * What a built-in dispatcher reports back to the composer: `ok` clears the
 * editor; a refusal keeps the text in place and shows `warning` above it.
 */
export type BuiltinOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly warning: string };
