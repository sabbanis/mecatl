import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Workspace" };

/**
 * Workspace navigation lives in the shared shell sidebar (see
 * `components/app/nav-items.ts`); on small screens the topbar drawer replaces
 * the old bottom bar. Pages in this section are full-height experiences that
 * manage their own scrolling and padding, so this layout only pins the height.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="h-full min-h-0 overflow-hidden">{children}</div>;
}
