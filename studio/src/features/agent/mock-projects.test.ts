import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/formatters";
import { MOCK_PROJECTS, MOCK_PROJECTS_DEFAULT_OPEN_ID } from "./mock-projects";

/**
 * The Labs Projects section exists to demonstrate project-grouped chats, so
 * the data must actually exercise the section's visuals: an expandable
 * default-open project, indented chats, and both right-hand row variants
 * (the unread dot and the muted age label).
 */
describe("mock projects", () => {
  const chats = MOCK_PROJECTS.flatMap((p) => p.chats);

  it("ids are unique and mock-prefixed, so they can never collide with daemon rows", () => {
    const ids = [...MOCK_PROJECTS.map((p) => p.id), ...chats.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, `id ${id}`).toMatch(/^mock-/);
    }
  });

  it("every project carries at least one chat to indent beneath it", () => {
    expect(MOCK_PROJECTS.length).toBeGreaterThan(1);
    for (const project of MOCK_PROJECTS) {
      expect(project.chats.length, project.name).toBeGreaterThan(0);
    }
  });

  it("the default-open project is one of the listed projects", () => {
    expect(MOCK_PROJECTS.map((p) => p.id)).toContain(
      MOCK_PROJECTS_DEFAULT_OPEN_ID,
    );
  });

  it("demonstrates both row variants: unread dots and age labels", () => {
    expect(chats.some((c) => c.unread)).toBe(true);
    expect(chats.some((c) => !c.unread)).toBe(true);
  });

  it("exactly one chat is selected, inside the default-open project", () => {
    // The green project treatment marks the selected chat's project, so the
    // demo needs one — and only one — and it must be visible on first render.
    const selected = chats.filter((c) => c.selected);
    expect(selected.length).toBe(1);
    const home = MOCK_PROJECTS.find((p) => p.chats.some((c) => c.selected));
    expect(home?.id).toBe(MOCK_PROJECTS_DEFAULT_OPEN_ID);
    // Selected and unread are mutually exclusive right-hand slots.
    expect(selected[0].unread).toBe(false);
  });

  it("every read chat's timestamp yields a compact age label", () => {
    for (const chat of chats.filter((c) => !c.unread)) {
      expect(formatRelativeTime(chat.updatedAt), chat.title).toMatch(
        /^\d+[mhd]$/,
      );
    }
  });
});
