import { SettingsHeader } from "./_components/settings-header";
import { SettingsNav } from "./_components/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-6">
        <SettingsHeader />
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
          <SettingsNav />
          <div className="min-w-0 flex-1 space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
