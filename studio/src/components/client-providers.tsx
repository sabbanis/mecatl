"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, Suspense } from "react";
import { Toaster } from "sonner";
import { ConnectorStatusProvider } from "@/contexts/connector-status-context";
import type { Theme } from "./user-menu/theme-menu-items";

interface ClientProvidersProps {
  children: ReactNode;
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme as Theme}
      duration={2000}
      position="bottom-right"
      offset={{ top: 50 }}
      closeButton
    />
  );
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Suspense fallback={null}>
        <ConnectorStatusProvider
          defaultEnabledIds={[
            "github-enterprise",
            "jira",
            "postgres",
            "filesystem",
            "slack",
            "datadog",
            "confluence",
            "internal-wiki",
            "deploy-pipeline",
          ]}
          defaultSignedInIds={[
            "github-enterprise",
            "postgres",
            "filesystem",
            "datadog",
            "confluence",
            "internal-wiki",
            "deploy-pipeline",
          ]}
        >
          {children}
          <ThemedToaster />
        </ConnectorStatusProvider>
      </Suspense>
    </ThemeProvider>
  );
}
