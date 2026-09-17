import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Every button is pill-shaped (product decision, Sept 2026: the settings'
  // "Save and restart"-style buttons read as pills, so the whole family does).
  // Height/padding/type from the design system's `.btn` family: default =
  // `.btn` (2.25rem / 0 1.1rem / 0.825rem), sm/icon = `.btn-sm` (2rem /
  // 0 0.85rem / 0.8rem).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[0.825rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    // `size` is declared before `variant` so the `action` variant's own
    // metrics win the tailwind-merge conflict. `action` is the brand pill
    // (`.btn` + `.btn-primary`): it carries its own fixed height, padding, and
    // font size (2.25rem / 0 1.1rem / 0.825rem), so those must override
    // whichever `size` the call site resolves to.
    variants: {
      size: {
        default: "h-9 px-[1.1rem] py-2",
        sm: "h-8 rounded-full px-[0.85rem] text-[0.8rem]",
        lg: "h-11 rounded-full px-8",
        icon: "h-8 w-8",
      },
      variant: {
        // Primary actions are the brand green (product decision, Sept 2026),
        // the same --btn-primary tokens the `action` variant uses.
        default: "bg-btn-primary text-white hover:bg-btn-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // `.btn-primary`: brand fill in light, darker fills in dark — both
        // sides live in the --btn-primary(-hover) tokens.
        action:
          "bg-btn-primary text-white hover:bg-btn-primary-hover rounded-full h-9 px-[1.1rem] text-[0.825rem]",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
