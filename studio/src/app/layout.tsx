import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import { ClientProviders } from "@/components/client-providers";
import { ServerProviders } from "@/components/server-providers";
import "./globals.css";

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
    template: "%s — Mecatl Studio",
    default: "Mecatl Studio",
  },
  description: "The web workspace for the Mecatl agent harness",
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
          <ClientProviders>{children}</ClientProviders>
        </ServerProviders>
      </body>
    </html>
  );
}
