import { ConsoleShell } from "@/components/shell/console-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { AssistantSidebarRoot } from "@/features/assistant";
import { getPermissions } from "@/lib/authz";
import { isFeatureEnabled } from "@/lib/config-server-client";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [permissions, assistantEnabled] = await Promise.all([
    getPermissions(),
    isFeatureEnabled("assistant"),
  ]);

  return (
    <PermissionsProvider me={permissions}>
      <SidebarProvider defaultOpen={false}>
        {/* Not SidebarInset: the shell renders the page's one <main>, and
            SidebarInset is itself a <main>, which would nest them. This div
            carries the flex sizing the assistant's right-hand sidebar needs. */}
        <div className="h-screen min-w-0 flex-1">
          <ConsoleShell>{children}</ConsoleShell>
        </div>
        {assistantEnabled && <AssistantSidebarRoot />}
      </SidebarProvider>
    </PermissionsProvider>
  );
}
