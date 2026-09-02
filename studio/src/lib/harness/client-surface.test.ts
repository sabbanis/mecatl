// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import type { HarnessResolvedModel, HarnessRouterCategory } from "./client";
import {
  apiError,
  cancelHarnessRun,
  cancelHarnessSteer,
  compactHarnessSession,
  connectHarnessGateway,
  createHarnessSession,
  createHarnessSkill,
  createHarnessSkillFiles,
  createThreadHarnessSession,
  deleteHarnessSession,
  deleteHarnessSkill,
  fetchAllSessions,
  fetchHarnessCompatibility,
  fetchHarnessControlStatus,
  fetchHarnessRouter,
  fetchHarnessSessionDetail,
  fetchHarnessSessionMode,
  fetchHarnessSkillBody,
  fetchHarnessSkillFile,
  fetchHarnessUserModel,
  fetchSessionTranscriptMessages,
  forkHarnessSessionToModel,
  HARNESS_API,
  HarnessApiError,
  harnessScheduleAction,
  listDisabledHarnessSkills,
  listHarnessAgents,
  listHarnessCommands,
  listHarnessModels,
  listHarnessProviders,
  listHarnessSkillFiles,
  listHarnessSkills,
  listKnownHarnessProviders,
  listScheduleFires,
  listScheduleRows,
  probeHarness,
  removeHarnessProvider,
  renameHarnessSession,
  respondToHarnessApproval,
  restartHarnessDaemon,
  retryHarnessRun,
  saveHarnessRouter,
  saveHarnessSchedule,
  saveHarnessSkillBody,
  setActiveHarnessProvider,
  setHarnessSessionMode,
  setHarnessSkillEnabled,
  startHarnessGatewayOAuth,
  steerHarnessRun,
  streamHarnessPrompt,
  ThreadSourceBusyError,
  testHarnessProviderKey,
  waitForHarnessGateway,
} from "./client";
import { fetchLearnedSkill } from "./learned-skills";
import { undoLearningPromotion } from "./learning";

/**
 * Export-surface pin for the transport monolith. client.ts lands whole and
 * final ahead of some of its UI consumers (they arrive later in the stacked
 * series that split PR #618), so knip cannot see every export consumed yet.
 * This test is the honest, PERMANENT guard that replaces a temporary knip
 * ignore: every public value export is enumerated here, so an accidental
 * export rename/removal fails vitest, and knip counts each as consumed by a
 * test entry. Removing a genuine export means updating this list — a visible
 * decision, exactly like the harness-token exemption maps on the Go side.
 */
describe("client.ts public surface", () => {
  it("exports every transport entry point", () => {
    // Type-only surface consumed by later PRs in the series (model router,
    // resolved-model echo) — referencing them here keeps knip honest.
    const typeSurface: {
      category?: HarnessRouterCategory;
      resolved?: HarnessResolvedModel;
    } = {};
    expect(typeSurface).toBeDefined();
    const surface = {
      fetchLearnedSkill,
      undoLearningPromotion,
      HARNESS_API,
      HarnessApiError,
      ThreadSourceBusyError,
      apiError,
      cancelHarnessRun,
      cancelHarnessSteer,
      compactHarnessSession,
      connectHarnessGateway,
      createHarnessSession,
      createHarnessSkill,
      createHarnessSkillFiles,
      createThreadHarnessSession,
      deleteHarnessSession,
      deleteHarnessSkill,
      fetchAllSessions,
      fetchHarnessCompatibility,
      fetchHarnessControlStatus,
      fetchHarnessRouter,
      fetchHarnessSessionDetail,
      fetchHarnessSessionMode,
      fetchHarnessSkillBody,
      fetchHarnessSkillFile,
      fetchHarnessUserModel,
      fetchSessionTranscriptMessages,
      forkHarnessSessionToModel,
      harnessScheduleAction,
      listDisabledHarnessSkills,
      listHarnessAgents,
      listHarnessCommands,
      listHarnessModels,
      listHarnessProviders,
      listHarnessSkillFiles,
      listHarnessSkills,
      listKnownHarnessProviders,
      listScheduleFires,
      listScheduleRows,
      probeHarness,
      removeHarnessProvider,
      renameHarnessSession,
      respondToHarnessApproval,
      restartHarnessDaemon,
      retryHarnessRun,
      saveHarnessRouter,
      saveHarnessSchedule,
      saveHarnessSkillBody,
      setActiveHarnessProvider,
      setHarnessSessionMode,
      setHarnessSkillEnabled,
      startHarnessGatewayOAuth,
      steerHarnessRun,
      streamHarnessPrompt,
      testHarnessProviderKey,
      waitForHarnessGateway,
    };
    for (const [name, value] of Object.entries(surface)) {
      expect(value, name).toBeDefined();
    }
  });
});
