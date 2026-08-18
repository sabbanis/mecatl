import { pageTitleClass } from "@/lib/typography";
import { SettingsNav } from "./_components/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-6">
        <h1 className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}>
          Settings
        </h1>
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
          <SettingsNav />
          <div className="min-w-0 flex-1 space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
