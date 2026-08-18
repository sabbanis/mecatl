import type { SearchEntry, SearchGroup } from "./search-types";

/**
 * Global-search entries for the workspace surfaces.
 *
 * Studio is daemon-only, so there are no fixture-derived entries to index at
 * module load. The live index — built from the session inventory, schedule
 * registry, skill list, and memory keys — lands with the surface wiring;
 * until then the palette searches only the static navigation entries.
 */
export const ATRIUM_SEARCH_ENTRIES: readonly SearchEntry[] = [];

export const ATRIUM_SEARCH_GROUPS: readonly SearchGroup[] = [
  { category: "chat", heading: "Chats", source: "atrium" },
  { category: "memory", heading: "Memory", source: "atrium" },
  { category: "skill", heading: "Skills", source: "atrium" },
  { category: "schedule", heading: "Scheduled", source: "atrium" },
];
