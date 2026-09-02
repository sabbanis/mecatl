"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionProps } from "@tiptap/suggestion";
import { ArrowUp, Bot, Check, ChevronDown, Mic } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getAgentMentions,
  getSlashCommands,
} from "@/features/agent/composer-capabilities";
import { cn } from "@/lib/utils";
import {
  type ComposerMenuItem,
  composerText,
  createComposerMentions,
  setComposerText,
} from "./composer-mentions";

interface ChatInputProps {
  placeholder?: string;
  rows?: number;
  compact?: boolean;
  onSend?: (content: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  appendText?: string | null;
  onAppendConsumed?: () => void;
  /** Plain-text seed dropped into an empty composer (e.g. a "next step" chip
      that pre-fills a prompt without sending it). Unlike `appendText`, it is
      not quoted and replaces rather than appends. */
  initialText?: string | null;
  onInitialTextConsumed?: () => void;
}

/**
 * Ghost-style trigger used by dropdowns rendered BELOW the input box
 * (matches the "Build / Claude Opus 5 / Default" reference design).
 * No pill background; subtle hover; small chevron via the trigger itself.
 */
const GHOST_TRIGGER_CLASS =
  "h-7 gap-1 rounded-full px-2.5 text-sm font-normal text-foreground bg-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700 border-0 shadow-none";

/**
 * Controls whether the agent draws on (and writes to) its long-term memory for
 * this conversation. A pill matching the model selector, opening a small On/Off
 * menu; on by default.
 */
function MemoryToggle() {
  const [on, setOn] = useState(true);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className={GHOST_TRIGGER_CLASS}
          title={`Memory ${on ? "On" : "Off"}`}
        >
          Memory
          <span className="text-muted-foreground @max-md:hidden">
            {on ? "On" : "Off"}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        align="start"
        className="w-40"
      >
        {[true, false].map((value) => (
          <DropdownMenuItem
            key={String(value)}
            className="gap-2"
            onClick={() => setOn(value)}
          >
            <Check
              className={cn(
                "size-4",
                on === value ? "text-foreground" : "text-transparent",
              )}
            />
            {value ? "On" : "Off"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<ReturnType<
    SpeechRecognitionType["prototype"]["constructor"]
  > | null>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setIsSupported(!!SR);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      onTranscript(finalText + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalText) onTranscript(finalText);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onTranscript]);

  return { isListening, isSupported, toggle };
}

type SpeechRecognitionType = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType;
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}

const DEFAULT_PLACEHOLDER =
  "Pull in tools and expertise by including @agent or +Files";

/** Filter the agent list for the `@`-mention menu by handle or name. */
function agentMenuItems(query: string): ComposerMenuItem[] {
  const q = query.toLowerCase();
  return getAgentMentions()
    .filter((a) => a.handle.startsWith(q) || a.name.toLowerCase().includes(q))
    .map((a) => ({
      id: a.handle,
      label: a.handle,
      primary: a.name,
      secondary: a.description,
    }));
}

/** Filter the slash-command list for the `/`-command menu by name prefix. */
function commandMenuItems(query: string): ComposerMenuItem[] {
  const q = query.toLowerCase();
  return getSlashCommands()
    .filter((c) => c.name.startsWith(q))
    .map((c) => ({
      id: c.name,
      label: c.name,
      primary: `/${c.name}`,
      secondary: c.description,
    }));
}

/** Open autocomplete menu state, mirrored from TipTap's suggestion lifecycle. */
interface ComposerMenu {
  kind: "agent" | "command";
  items: ComposerMenuItem[];
  index: number;
  select: (item: ComposerMenuItem) => void;
}

/**
 * Drive the open autocomplete menu from a keydown. Returns true when the key
 * was for the menu (arrows move the highlight, Enter/Tab pick the row, Escape
 * closes it). Selection is deferred a microtask so the chip insert lands after
 * ProseMirror finishes dispatching the key.
 */
function handleMenuNavKey(
  event: KeyboardEvent,
  menu: ComposerMenu,
  setMenu: React.Dispatch<React.SetStateAction<ComposerMenu | null>>,
): boolean {
  if (menu.items.length === 0) return false;
  switch (event.key) {
    case "ArrowDown":
      setMenu((m) => (m ? { ...m, index: (m.index + 1) % m.items.length } : m));
      return true;
    case "ArrowUp":
      setMenu((m) =>
        m
          ? { ...m, index: (m.index - 1 + m.items.length) % m.items.length }
          : m,
      );
      return true;
    case "Enter":
    case "Tab": {
      const item = menu.items[menu.index];
      if (item) queueMicrotask(() => menu.select(item));
      return true;
    }
    case "Escape":
      setMenu(null);
      return true;
    default:
      return false;
  }
}

export function ChatInput({
  placeholder: placeholderProp,
  compact = false,
  onSend,
  disabled = false,
  appendText,
  onAppendConsumed,
  initialText,
  onInitialTextConsumed,
}: ChatInputProps) {
  const placeholder = placeholderProp ?? DEFAULT_PLACEHOLDER;
  // Plain-text mirror of the editor, kept in sync via onUpdate. Used only for
  // "is there something to send" checks; the editor document is the source of
  // truth for the message itself.
  const [text, setText] = useState("");

  // Autocomplete menu, mirrored from TipTap's suggestion lifecycle so we can
  // render the same full-width popover the pre-TipTap composer used. `menuRef`
  // gives the suggestion keydown handler a synchronous read of current state.
  const [menu, setMenu] = useState<ComposerMenu | null>(null);

  // Wire each mention's TipTap suggestion to the shared menu state. `command`
  // (from the suggestion props) inserts the atomic chip at the trigger range.
  // Keyboard navigation is handled by the editor's handleKeyDown (below), not
  // here, so the suggestion's own onKeyDown is intentionally omitted.
  const makeRender = useCallback(
    (kind: "agent" | "command") => () => ({
      onStart: (props: SuggestionProps<ComposerMenuItem>) => {
        setMenu({
          kind,
          items: props.items,
          index: 0,
          select: (item) => props.command(item),
        });
      },
      onUpdate: (props: SuggestionProps<ComposerMenuItem>) => {
        setMenu((m) => {
          if (!m || m.kind !== kind) return m;
          const index = props.items.length
            ? Math.min(m.index, props.items.length - 1)
            : 0;
          return {
            kind,
            items: props.items,
            index,
            select: (item) => props.command(item),
          };
        });
      },
      onExit: () => setMenu((m) => (m && m.kind === kind ? null : m)),
    }),
    [],
  );

  const mentions = useMemo(
    () =>
      createComposerMentions({
        agentItems: agentMenuItems,
        commandItems: commandMenuItems,
        makeRender,
      }),
    [makeRender],
  );

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    extensions: [
      // A deliberately plain field: keep the editing primitives (undo, hard
      // break, drop/gap cursors) but drop every rich-text mark and block so
      // typing `# `, `**`, `- ` etc. stays literal, exactly like the textarea.
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder }),
      ...mentions,
    ],
    onUpdate: ({ editor }) => setText(editor.getText({ blockSeparator: "\n" })),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (appendText && editor) {
      const raw = editor.getText({ blockSeparator: "\n" });
      const sep = raw && !raw.endsWith("\n") ? "\n" : "";
      setComposerText(editor, `${raw}${sep}> ${appendText}\n`);
      setText(editor.getText({ blockSeparator: "\n" }));
      onAppendConsumed?.();
      requestAnimationFrame(() => editor.commands.focus("end"));
    }
  }, [appendText, onAppendConsumed, editor]);

  useEffect(() => {
    if (initialText && editor) {
      setComposerText(editor, initialText);
      setText(editor.getText({ blockSeparator: "\n" }));
      onInitialTextConsumed?.();
      requestAnimationFrame(() => editor.commands.focus("end"));
    }
  }, [initialText, onInitialTextConsumed, editor]);

  const voice = useVoiceInput(
    useCallback(
      (transcript: string) => {
        if (editor) setComposerText(editor, transcript);
        setText(transcript);
      },
      [editor],
    ),
  );

  const handleSend = useCallback(() => {
    const trimmed = editor ? composerText(editor) : "";
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    editor?.commands.clearContent();
    setText("");
  }, [editor, disabled, onSend]);

  // Menu nav + Enter-to-send are wired with a native capture-phase keydown
  // listener on the editor DOM, re-subscribed each render with fresh closures
  // over `menu`/`handleSend`. Capture phase runs before ProseMirror's own
  // (bubble-phase) handler, and stopPropagation keeps the base keymap and the
  // suggestion plugins from also acting. This sidesteps both TipTap re-syncing
  // its editorProps and the React Compiler not preserving render-phase refs.
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (menu) {
        if (handleMenuNavKey(event, menu, setMenu)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        handleSend();
      }
    };
    dom.addEventListener("keydown", onKeyDown, true);
    return () => dom.removeEventListener("keydown", onKeyDown, true);
  }, [editor, menu, handleSend]);

  const hasText = text.trim().length > 0;

  return (
    <div className="relative rounded-2xl bg-zinc-50 dark:bg-zinc-900">
      {/* Autocomplete popover (agent @-mentions or slash commands), floating
          above the input box. Driven by TipTap's suggestion lifecycle. */}
      {menu && menu.items.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {menu.items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() =>
                  setMenu((m) => (m ? { ...m, index: i } : m))
                }
                // Use onMouseDown + preventDefault so selecting a row doesn't
                // blur the editor (which would close the suggestion first).
                onMouseDown={(e) => {
                  e.preventDefault();
                  item && menu.select(item);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left",
                  i === menu.index ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {menu.kind === "command" ? (
                  <span className="font-mono text-sm">/{item.id}</span>
                ) : (
                  <>
                    <Bot className="size-4 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 text-sm font-medium">
                      {item.primary}
                    </span>
                  </>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {item.secondary}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Input box: textarea + inline toolbar (+, mic) + send button.
          Has its own rounded border. The toolbar row below has a matching
          border on its top/sides/bottom; the two borders meet along the
          input box's bottom edge, sharing a single visible line. */}
      <div className="relative rounded-2xl border bg-background transition-colors focus-within:border-zinc-400 dark:focus-within:border-zinc-600 border-zinc-300 dark:border-zinc-700">
        {voice.isListening && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <span className="size-2 rounded-full bg-brand animate-pulse" />
            <span className="text-xs font-medium text-brand dark:text-brand">
              Listening
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-1.5 px-4 pt-4 pb-2">
          {/* TipTap composer: resolved @agent / /skill mentions are atomic
              green chips (Backspace removes a whole chip); Enter sends and
              Shift+Enter inserts a newline (handled in the editor keymap). */}
          <div
            className={cn(
              "relative flex-1 min-w-[120px] self-center",
              disabled && "opacity-50",
            )}
          >
            <EditorContent editor={editor} className="composer-editor" />
          </div>
        </div>
        {/* Bottom row: mic on the left; send right */}
        <div className="flex items-center gap-1 px-2 pb-2">
          {voice.isSupported && (
            <Button
              size="icon"
              className={cn(
                "size-8 rounded-full border-0 shadow-none",
                voice.isListening
                  ? "bg-brand/10 text-brand hover:bg-brand/20"
                  : "bg-transparent text-muted-foreground hover:bg-muted/60",
              )}
              onClick={voice.toggle}
              disabled={disabled}
              aria-label={voice.isListening ? "Stop listening" : "Voice input"}
            >
              <Mic className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            className="ml-auto size-8 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            onClick={handleSend}
            disabled={disabled || !hasText}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
      {/* Toolbar sits BEHIND the input box: negative top margin pulls it up
          so its top edge overlaps the input box's bottom rounded corners,
          making the two boxes appear to share a single outline. */}
      {/* @container: the Model/Memory pills collapse their value labels via
          container queries when THIS row runs narrow (a ~400px side-panel
          composer), independent of the viewport width. */}
      <div className="@container -mt-4 pt-5 px-2 pb-1.5 flex items-center gap-1 rounded-b-2xl border border-t-0 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 overflow-x-auto hide-scrollbar">
        {!compact && <MemoryToggle />}
      </div>
    </div>
  );
}
