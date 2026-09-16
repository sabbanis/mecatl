"use client";

import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useStorageHealth } from "@/features/agent/hooks/use-storage-health";
import { useStorageMaintenance } from "@/features/agent/hooks/use-storage-maintenance";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { StorageCleanupCard } from "./storage-cleanup-card";
import { StorageHealthCard } from "./storage-health-card";
import { StorageMigrationCard } from "./storage-migration-card";

type Runtime = ReturnType<typeof useHarnessRuntime>;

/**
 * The Storage page's maintenance block: the always-visible health card and
 * the two capability-gated job flows, sharing ONE storage-health read so a
 * finished job's `refreshHealth` updates the numbers the person is looking
 * at (each `useStorageHealth` call is its own read; the Retention card above
 * keeps its own for the policy table).
 */
export function StorageMaintenanceSection({ runtime }: { runtime: Runtime }) {
  const { serverCapabilities } = useRuntimeStatus();
  const storage = useStorageHealth();
  const maintenance = useStorageMaintenance({
    refreshHealth: storage.refresh,
  });
  return (
    <>
      <StorageHealthCard
        live={runtime.live}
        supported={storage.supported}
        health={storage.health}
        onRefresh={storage.refresh}
      />
      <StorageMigrationCard
        live={runtime.live}
        supported={serverCapabilities.storage_migration === true}
        activeJob={storage.health?.activeJob ?? ""}
        onRefreshHealth={storage.refresh}
        migration={maintenance.migration}
      />
      <StorageCleanupCard
        live={runtime.live}
        supported={serverCapabilities.storage_cleanup === true}
        cleanup={maintenance.cleanup}
      />
    </>
  );
}
