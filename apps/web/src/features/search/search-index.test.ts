// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  buildGlobalSearchIndex,
  type GlobalSearchItem,
  globalSearchPages,
  groupSearchResults,
  searchGlobalIndex,
} from "./search-index";

describe("global search index", () => {
  it("always includes the static pages, even with every inventory empty", () => {
    const index = buildGlobalSearchIndex({
      configuredSkills: [],
      learnedSkills: [],
      memory: [],
      schedules: [],
      sessions: [],
    });
    expect(searchGlobalIndex(index, "shortcuts").map((item) => item.id)).toEqual([
      "page:shortcuts",
    ]);
    expect(searchGlobalIndex(index, "about").map((item) => item.id)).toEqual(["page:about"]);
  });

  it("indexes every browser-owned inventory", () => {
    const index = buildGlobalSearchIndex({
      configuredSkills: [
        {
          activeVersion: "1.0.0",
          description: "Draft release notes",
          name: "release-writer",
          ownerAgent: "writer",
        },
      ],
      learnedSkills: [
        {
          description: "Triages incidents",
          id: "skill-1",
          name: "incident-triage",
          ownerAgent: "operator",
          state: "staged",
          version: "2",
        },
      ],
      memory: [{ description: "Prefers concise answers", key: "writing-style" }],
      schedules: [
        {
          modelId: "gpt-5",
          name: "weekly-review",
          owner: "user",
          prompt: "Summarize the launch project",
          status: "scheduled",
        },
      ],
      sessions: [{ id: "session-1", modelId: "gpt-5", state: "idle", title: "Launch plan" }],
    });

    expect(searchGlobalIndex(index, "launch").map((item) => item.id)).toEqual([
      "chat:session-1",
      "schedule:weekly-review",
    ]);
    expect(searchGlobalIndex(index, "release notes")[0]?.target).toEqual({
      item: "release-writer",
      kind: "skill",
      view: "configured",
    });
    expect(searchGlobalIndex(index, "triages")[0]?.target).toEqual({
      item: "skill-1",
      kind: "skill",
      view: "learned",
    });
    expect(searchGlobalIndex(index, "concise")[0]?.target).toEqual({
      item: "writing-style",
      kind: "memory",
    });
  });

  it("ranks exact and title-prefix matches ahead of description matches", () => {
    const item = (id: string, title: string, description = ""): GlobalSearchItem => ({
      description,
      id,
      keywords: "",
      section: "Chats",
      target: { kind: "chat", sessionId: id },
      title,
    });
    const items = [
      item("description", "Elsewhere", "Plan the launch"),
      item("prefix", "Launch retrospective"),
      item("exact", "Launch"),
    ];

    expect(searchGlobalIndex(items, "launch").map((result) => result.id)).toEqual([
      "exact",
      "prefix",
      "description",
    ]);
  });

  it("matches all query terms, ignores accents, and observes the result limit", () => {
    const items: GlobalSearchItem[] = [
      {
        description: "Résumé from weekly planning",
        id: "first",
        keywords: "",
        section: "Memory",
        target: { item: "first", kind: "memory" },
        title: "One",
      },
      {
        description: "Weekly planning without the other term",
        id: "second",
        keywords: "",
        section: "Memory",
        target: { item: "second", kind: "memory" },
        title: "Two",
      },
    ];

    expect(searchGlobalIndex(items, "resume weekly", 1).map((result) => result.id)).toEqual([
      "first",
    ]);
    expect(searchGlobalIndex(items, "  ")).toEqual([]);
  });
});

describe("groupSearchResults", () => {
  it("buckets by section in the fixed section order, dropping empty sections", () => {
    const chat: GlobalSearchItem = {
      description: "",
      id: "chat:1",
      keywords: "",
      section: "Chats",
      target: { kind: "chat", sessionId: "1" },
      title: "A chat",
    };
    const page = globalSearchPages[0] as GlobalSearchItem;
    const memory: GlobalSearchItem = {
      description: "",
      id: "memory:1",
      keywords: "",
      section: "Memory",
      target: { item: "1", kind: "memory" },
      title: "A fact",
    };

    // Deliberately out of section order — grouping must reorder to Chats, Memory, Pages.
    const groups = groupSearchResults([page, memory, chat]);

    expect(groups.map((group) => group.section)).toEqual(["Chats", "Memory", "Pages"]);
    expect(groups[0]?.items).toEqual([chat]);
    expect(groups[1]?.items).toEqual([memory]);
    expect(groups[2]?.items).toEqual([page]);
  });

  it("returns an empty array for no results", () => {
    expect(groupSearchResults([])).toEqual([]);
  });
});
