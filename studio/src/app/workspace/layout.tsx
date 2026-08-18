import { ConsoleShell } from "@/components/shell/console-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RuntimeStatusProvider } from "@/features/agent/runtime-status";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RuntimeStatusProvider>
      <SidebarProvider defaultOpen={false}>
        {/* Not SidebarInset: the shell renders the page's one <main>, and
            SidebarInset is itself a <main>, which would nest them. This div
            carries the flex sizing the shell layout needs. */}
        <div className="h-screen min-w-0 flex-1">
          <ConsoleShell>{children}</ConsoleShell>
        </div>
      </SidebarProvider>
    </RuntimeStatusProvider>
  );
}
