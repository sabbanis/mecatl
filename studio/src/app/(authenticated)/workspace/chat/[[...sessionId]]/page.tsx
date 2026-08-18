import { ChatWorkspace } from "../_components/chat-workspace";

/**
 * `/workspace/chat` (no conversation) and `/workspace/chat/<sessionId>` are
 * served by one optional-catch-all route, so moving between them keeps
 * `ChatWorkspace` mounted. Its selection and project state survive the
 * navigation — switching to the project overview (which drops the sessionId
 * from the URL) no longer remounts the tree and re-runs the default-select.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ sessionId?: string[] }>;
}) {
  const { sessionId } = await params;
  return <ChatWorkspace sessionId={sessionId?.[0]} />;
}
