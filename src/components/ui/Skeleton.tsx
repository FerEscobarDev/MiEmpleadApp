import * as React from "react";
import { cn } from "@/lib/utils";

// Skeleton/Loading del Design System (design_system.md §3 — Skeleton).
// Esqueletos de carga; respeta prefers-reduced-motion.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
