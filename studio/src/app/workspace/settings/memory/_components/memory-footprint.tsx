import type { MemoryStoreFootprint } from "@/features/agent";

/**
 * "3 facts · 64 bytes · sha256 ffffffffffff" — the TUI viewer's dim aggregate
 * line (cmd/mecatui/ui/usermodel.go renderUserModelMeta). A part the daemon
 * did not report (0 / "") is omitted rather than rendered as a zero.
 */
export function formatMemoryFootprint(store: MemoryStoreFootprint): string {
  const parts: string[] = [];
  if (store.count > 0) {
    parts.push(`${store.count} ${store.count === 1 ? "fact" : "facts"}`);
  }
  if (store.sizeBytes > 0) parts.push(`${store.sizeBytes} bytes`);
  if (store.sha256) parts.push(`sha256 ${store.sha256.slice(0, 12)}`);
  return parts.join(" · ");
}

/** The footprint line above the memory table; renders nothing when empty. */
export function MemoryFootprint({ store }: { store: MemoryStoreFootprint }) {
  const text = formatMemoryFootprint(store);
  if (!text) return null;
  return (
    <p
      data-testid="memory-footprint"
      className="font-mono text-xs text-muted-foreground"
      title={store.sha256 ? `sha256 ${store.sha256}` : undefined}
    >
      {text}
    </p>
  );
}
