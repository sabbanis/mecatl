"use client";

import { FolderX, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HarnessPlacement } from "@/lib/harness/sessions";
import { shortRevision } from "@/lib/harness/worktrees";
import { cn } from "@/lib/utils";

/** A no-filesystem session's placement kinds: the `no-fs` profile/selector
 *  spelling and the environment-ref `nofs` spelling (issue #55). */
const NO_FS_PLACEMENT_KINDS: ReadonlySet<string> = new Set(["no-fs", "nofs"]);

/** The badge's visible text: "No filesystem" for a no-fs placement, else
 *  the label and the branch joined by " · " (whichever the daemon set);
 *  "" when there is nothing displayable. */
export function placementBadgeText(placement: HarnessPlacement): string {
  if (NO_FS_PLACEMENT_KINDS.has(placement.kind)) return "No filesystem";
  return [placement.label, placement.branch].filter(Boolean).join(" · ");
}

/** The hover detail: the placement kind word and the abbreviated revision
 *  (the `/session` dialog carries the full one). */
export function placementBadgeTitle(placement: HarnessPlacement): string {
  if (NO_FS_PLACEMENT_KINDS.has(placement.kind))
    return "Placement: no filesystem — this chat has no workspace";
  const kind = placement.kind || "placement";
  const revision = placement.revision
    ? ` @ ${shortRevision(placement.revision)}`
    : "";
  return `Placement: ${kind}${revision}`;
}

/**
 * The chat header's placement badge — the TUI's startup placement line
 * (`--resume` prints the worktree/branch the chat runs in) as a persistent
 * header segment: which worktree and branch this chat's session is bound
 * to, read off the session snapshot the daemon owns (ADR 0291; display
 * metadata only, never a path). Renders nothing when the daemon reports no
 * placement (an older daemon) and hides below 500px to keep the header row.
 */
export function PlacementBadge({
  placement,
  className,
}: {
  placement: HarnessPlacement | null | undefined;
  className?: string;
}) {
  if (!placement) return null;
  const text = placementBadgeText(placement);
  if (!text) return null;
  const noFs = NO_FS_PLACEMENT_KINDS.has(placement.kind);
  const Icon = noFs ? FolderX : GitBranch;
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 select-none max-[499px]:hidden", className)}
      title={placementBadgeTitle(placement)}
      data-testid="placement-badge"
      data-placement-kind={placement.kind || undefined}
    >
      <Icon aria-hidden="true" />
      <span className="sr-only">Placement: </span>
      <span className="max-w-[16rem] truncate">{text}</span>
    </Badge>
  );
}
