import { redirect } from "next/navigation";

/** Memory moved under Settings; keep old bookmarks working. */
export default async function LegacyMemoryDetailPage({
  params,
}: {
  params: Promise<{ memoryId: string }>;
}) {
  const { memoryId } = await params;
  redirect(`/workspace/settings/memory/${memoryId}`);
}
