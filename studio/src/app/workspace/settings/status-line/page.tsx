"use client";

import { StatusLineSection } from "../_components/status-line-section";

/**
 * Settings → Status line: the TUI's `status_customization` for the browser —
 * header and footer templates over live session facts, three width variants
 * each, plus the clock's refresh interval. Stored in this browser.
 */
export default function StatusLineSettingsPage() {
  return <StatusLineSection />;
}
