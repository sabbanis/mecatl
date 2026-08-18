import { describe, expect, it } from "vitest";
import {
  ATRIUM_SEARCH_ENTRIES,
  ATRIUM_SEARCH_GROUPS,
} from "./atrium-search-data";

describe("ATRIUM_SEARCH_ENTRIES", () => {
  it("produces entries", () => {
    expect(ATRIUM_SEARCH_ENTRIES.length).toBeGreaterThan(0);
  });

  it("every entry is structurally valid and deep-linkable", () => {
    for (const entry of ATRIUM_SEARCH_ENTRIES) {
      expect(entry.id, `id for ${entry.title}`).toBeTruthy();
      expect(entry.title, `title for ${entry.id}`).toBeTruthy();
      // A resolvable in-app route.
      expect(entry.href, `href for ${entry.id}`).toMatch(/^\/[\w[-]/);
    }
  });

  it("has unique ids", () => {
    const ids = ATRIUM_SEARCH_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every category is represented by at least one entry", () => {
    for (const group of ATRIUM_SEARCH_GROUPS) {
      const has = ATRIUM_SEARCH_ENTRIES.some(
        (e) => e.category === group.category,
      );
      expect(has, `no entries for group ${group.category}`).toBe(true);
    }
  });

  it("chats fold message text into the searchable keywords", () => {
    const chat = ATRIUM_SEARCH_ENTRIES.find((e) => e.category === "chat");
    expect(chat).toBeDefined();
    // At least one chat should carry body text beyond its title.
    const withBody = ATRIUM_SEARCH_ENTRIES.filter(
      (e) => e.category === "chat" && (e.keywords ?? []).join("").length > 0,
    );
    expect(withBody.length).toBeGreaterThan(0);
  });
});
