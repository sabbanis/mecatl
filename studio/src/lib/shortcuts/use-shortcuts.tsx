"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { comboUsesMod, matchCombo, SHORTCUTS } from "./registry";

type Registry = {
  register: (id: string, handler: () => void) => void;
  unregister: (id: string) => void;
};

const ShortcutContext = createContext<Registry | null>(null);

function isTyping(el: Element | null): boolean {
  const node = el as HTMLElement | null;
  return (
    !!node &&
    (node.tagName === "INPUT" ||
      node.tagName === "TEXTAREA" ||
      node.isContentEditable)
  );
}

/**
 * Owns the single global keydown listener. Resolves each event against the
 * shortcut registry and calls the handler a component registered for that id.
 * Non-modifier shortcuts are suppressed while the user is typing.
 */
export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef(new Map<string, () => void>());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTyping(document.activeElement);
      for (const def of SHORTCUTS) {
        const handler = handlers.current.get(def.id);
        if (!handler) continue;
        if (typing && !comboUsesMod(def.combo)) continue;
        if (matchCombo(def.combo, e)) {
          e.preventDefault();
          handler();
          return;
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useRef<Registry>({
    register: (id, handler) => handlers.current.set(id, handler),
    unregister: (id) => handlers.current.delete(id),
  }).current;

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}

/**
 * Register a handler for a shortcut id. The latest handler is always used (no
 * re-registration churn), and it's removed on unmount.
 */
export function useShortcut(id: string, handler: () => void) {
  const ctx = useContext(ShortcutContext);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!ctx) return;
    const stable = () => ref.current();
    ctx.register(id, stable);
    return () => ctx.unregister(id);
  }, [id, ctx]);
}
