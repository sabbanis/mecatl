// SPDX-License-Identifier: Apache-2.0
import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/{page,layout,loading,error,not-found,global-error,route}.{ts,tsx}",
    "src/app/**/__tests__/**/*.{ts,tsx}",
    "src/components/**/__tests__/**/*.{ts,tsx}",
    "src/hooks/**/__tests__/**/*.{ts,tsx}",
    "src/**/*.test.{ts,tsx}",
    "playwright.config.mts",
  ],
  project: ["src/**/*.{ts,tsx}"],
  paths: {
    "@/*": ["src/*"],
    "@api/*": ["src/generated/*"],
    "@mocks": ["src/mocks"],
    "@mocks/*": ["src/mocks/*"],
  },
  ignore: [
    // Auto-generated files from hey-api
    "src/generated/**",
    // shadcn/ui components export all variants by convention — only a subset
    // is used at any given time
    "src/components/ui/**",
    // Reusable AI prompt-input component (same library pattern as shadcn/ui)
    "src/components/ai-elements/**",
    // MSW mock utilities — consumed dynamically in tests and dev server
    "src/mocks/**",
    // Context providers export hooks for downstream consumer components
    "src/contexts/**",
    // Shared lib utilities consumed by feature modules
    "src/lib/zod-v4-resolver.ts",
    // Feature modules: internal exports consumed within the feature
    "src/features/**",
  ],
  ignoreDependencies: [
    // Tailwind v4 is imported via CSS (@import "tailwindcss"), not JS
    "tailwindcss",
    // Used by shadcn/ui Form and Label components (in src/components/ui/ which knip ignores)
    "react-hook-form",
    "@radix-ui/react-label",
  ],
};

export default config;
