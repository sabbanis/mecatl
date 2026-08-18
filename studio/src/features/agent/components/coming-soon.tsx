"use client";

interface ComingSoonProps {
  feature: string;
  description?: string;
}

export function ComingSoon({ feature, description }: ComingSoonProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold text-muted-foreground">
          {feature}
        </h2>
        <p className="text-sm text-muted-foreground/60">
          {description ?? "This feature is coming soon."}
        </p>
      </div>
    </div>
  );
}
