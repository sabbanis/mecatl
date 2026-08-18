"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fetchHarnessControlStatus,
  type HarnessControlStatus,
  probeHarness,
} from "@/lib/harness/client";
import { refreshComposerCapabilities } from "./composer-capabilities";

const POLL_INTERVAL_MS = 5_000;

export type RuntimeConnectionState = "connecting" | "connected" | "offline";

export interface RuntimeStatus {
  state: RuntimeConnectionState;
  /** True exactly when state === "connected"; the common gate for loads. */
  connected: boolean;
  /** "external" when Studio proxies to MECATL_BASE_URL; "managed" otherwise. */
  mode: "managed" | "external";
  provider: string;
  gateway: { name: string; url: string } | null;
  /** Why the daemon is unreachable, when it is. */
  detail: string;
  /** Forces an immediate re-probe (the offline screen's Retry). */
  refresh: () => Promise<void>;
}

const RuntimeStatusContext = createContext<RuntimeStatus | null>(null);

/**
 * The single connection authority for every daemon-backed surface.
 *
 * Studio is daemon-only: there is no demo fallback, so an unreachable daemon
 * is a real state every surface must render. This provider polls the daemon
 * (via /api/mecatl) and the controller (via /api/mecatl-control) every five
 * seconds and exposes one shared answer, replacing the prototype's
 * per-hook one-shot probes — which could disagree with each other and never
 * noticed a daemon that died after mount.
 */
export function RuntimeStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RuntimeConnectionState>("connecting");
  const [detail, setDetail] = useState("");
  const [control, setControl] = useState<HarnessControlStatus | null>(null);
  const [mode, setMode] = useState<"managed" | "external">("managed");
  const capabilitiesLoaded = useRef(false);

  const probe = useCallback(async (signal?: AbortSignal) => {
    const [daemon, controlStatus] = await Promise.all([
      probeHarness(signal),
      fetchHarnessControlStatus(signal),
    ]);
    if (signal?.aborted) return;
    setControl(controlStatus);
    if (controlStatus?.mode) setMode(controlStatus.mode);
    if (daemon.live) {
      setState("connected");
      setDetail("");
      if (!capabilitiesLoaded.current) {
        capabilitiesLoaded.current = true;
        void refreshComposerCapabilities();
      }
    } else {
      setState("offline");
      setDetail(daemon.detail);
      // The next reconnect re-reads mentions and commands: a restart may have
      // changed the resolved roster.
      capabilitiesLoaded.current = false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void probe(controller.signal);
    const timer = setInterval(() => {
      void probe(controller.signal);
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [probe]);

  const refresh = useCallback(async () => {
    await probe();
  }, [probe]);

  return (
    <RuntimeStatusContext.Provider
      value={{
        state,
        connected: state === "connected",
        mode,
        provider: control?.provider ?? "",
        gateway: control?.gateway ?? null,
        detail,
        refresh,
      }}
    >
      {state === "offline" && (
        <OfflineBanner detail={detail} onRetry={refresh} />
      )}
      {children}
    </RuntimeStatusContext.Provider>
  );
}

function OfflineBanner({
  detail,
  onRetry,
}: {
  detail: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive"
    >
      <span className="font-medium">Mecatl is unreachable.</span>
      <span className="hidden truncate sm:inline">
        {detail || "Run `task build`, then `task studio:dev` to start it."}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-destructive/40 px-2 py-0.5 font-medium hover:bg-destructive/20"
      >
        Retry
      </button>
    </div>
  );
}

export function useRuntimeStatus(): RuntimeStatus {
  const context = useContext(RuntimeStatusContext);
  if (!context) {
    throw new Error(
      "useRuntimeStatus must be used inside RuntimeStatusProvider",
    );
  }
  return context;
}
