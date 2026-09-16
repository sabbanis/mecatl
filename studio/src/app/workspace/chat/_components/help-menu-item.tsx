"use client";

import { Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** The help reference route — the same page `?`, ⌘/ and `/help` open. */
export const HELP_ROUTE = "/workspace/shortcuts";

const HELP_MENU_LABEL = "Keyboard shortcuts & features";

/**
 * The chat ··· menu's entry point to the help reference (desktop dropdown).
 * Must render inside a `DropdownMenuContent`.
 */
export function HelpMenuItem() {
  const router = useRouter();
  return (
    <DropdownMenuItem onClick={() => router.push(HELP_ROUTE)}>
      <Keyboard className="size-4 mr-2 text-muted-foreground" />
      {HELP_MENU_LABEL}
    </DropdownMenuItem>
  );
}

/**
 * The same entry point for the mobile bottom-sheet menu, styled like its
 * sibling rows. `onSelect` lets the sheet close itself after navigating.
 */
export function HelpSheetItem({ onSelect }: { onSelect?: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        router.push(HELP_ROUTE);
        onSelect?.();
      }}
      className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
    >
      <Keyboard className="size-4 text-muted-foreground" />
      {HELP_MENU_LABEL}
    </button>
  );
}
