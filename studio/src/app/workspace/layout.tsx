import { TopNav } from "@/components/shell/top-nav";
import { RuntimeStatusProvider } from "@/features/agent/runtime-status";
import { ShortcutsProvider } from "@/lib/shortcuts/use-shortcuts";

/**
 * The workspace shell: a fixed dark-green radial gradient carrying the top
 * navigation bar, with all five surfaces rendered inside one rounded card
 * that follows the theme. The gradient itself is a fixed brand colour —
 * identical in light and dark themes — so only the card interior themes.
 *
 * `RuntimeStatusProvider` stays outermost: its offline banner renders above
 * the top nav at full width. Workspace sections manage their own scrolling
 * and padding inside the card (`h-full overflow-y-auto …`).
 */
export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RuntimeStatusProvider>
      <ShortcutsProvider>
        {/* The design's green radial gradient; dark mode deepens each stop so
            the shell recedes behind the dark card instead of outglowing it. */}
        <div className="flex h-dvh min-w-0 flex-col bg-[radial-gradient(120%_140%_at_20%_30%,#006652_0%,#03433e_50%,#06202a_100%)] dark:bg-[radial-gradient(120%_140%_at_20%_30%,#023d31_0%,#022723_50%,#02141b_100%)]">
          <TopNav />
          {/* relative makes the card the containing block for absolutely-
              positioned descendants with no positioned ancestor of their own
              — notably the hidden form-integration checkbox Radix renders
              beside each Switch inside a <form>. Without it those boxes
              resolve to the document and grow the page itself. */}
          <main className="relative mx-2.5 mb-2.5 min-h-0 flex-1 overflow-hidden rounded-[20px] bg-background text-foreground min-[500px]:mx-5 min-[500px]:mb-5">
            {children}
          </main>
        </div>
      </ShortcutsProvider>
    </RuntimeStatusProvider>
  );
}
