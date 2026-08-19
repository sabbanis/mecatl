/** Shared card shell for Settings sections, so runtime and preference cards
 * read as one page. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    // On mobile the card chrome is redundant — the back bar already names
    // the section — so the box and header dissolve into the page.
    <section className="overflow-hidden rounded-xl border bg-card max-[499px]:rounded-none max-[499px]:border-0 max-[499px]:bg-transparent">
      <div className="border-b px-5 py-3 max-[499px]:hidden">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="px-5 py-4 max-[499px]:p-0">{children}</div>
    </section>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Shown in place of a form when the configuration is owned elsewhere: the
 * controller answers 409 for every write in external mode, so offering the
 * form would only manufacture errors. */
export function ExternalManagedNote() {
  return (
    <Note>
      Managed by the external mecated deployment. Configuration writes are not
      available from this UI — change the deployment&rsquo;s own settings
      instead.
    </Note>
  );
}

export function OfflineNote() {
  return (
    <Note>
      The runtime is offline — its configuration cannot be read right now.
    </Note>
  );
}
