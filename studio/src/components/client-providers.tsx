"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, Suspense } from "react";
import { Toaster } from "sonner";

interface ClientProvidersProps {
  children: ReactNode;
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme as "light" | "dark" | undefined}
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
        {children}
        <ThemedToaster />
      </Suspense>
    </ThemeProvider>
  );
}
