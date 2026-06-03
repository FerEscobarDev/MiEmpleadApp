import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Badge del Design System (design_system.md §3 — Badge).
// SIEMPRE texto + color, nunca solo color (BR-2, accesibilidad/daltonismo).
const badgeVariants = cva(
  "inline-flex items-center gap-xs rounded-full px-sm py-0.5 text-caption font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-foreground-muted",
        primary: "bg-primary-soft text-primary-600",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        error: "bg-error/15 text-error",
        info: "bg-info/15 text-info",
        accent: "bg-accent/20 text-accent-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
