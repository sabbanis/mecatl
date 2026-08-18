import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Inter, Merriweather } from "next/font/google";
import { ClientProviders } from "@/components/client-providers";
import { ServerProviders } from "@/components/server-providers";
import "./globals.css";

const shouldShowMockScenarioPanel = process.env.NODE_ENV === "development";

const MockScenarioPanel = shouldShowMockScenarioPanel
  ? dynamic(() =>
      import("@/components/dev/mock-scenario-panel").then(
        (m) => m.MockScenarioPanel,
      ),
    )
  : null;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s — Stacklok",
    default: "Stacklok",
  },
  description: "ToolHive Cloud UI for managing MCP servers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${merriweather.variable} text-sm antialiased`}
      >
        <ServerProviders>
          <ClientProviders>
            {children}
            {shouldShowMockScenarioPanel && MockScenarioPanel && (
              <MockScenarioPanel />
            )}
          </ClientProviders>
        </ServerProviders>
      </body>
    </html>
  );
}
