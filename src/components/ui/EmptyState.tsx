import * as React from "react";
import { cn } from "@/lib/utils";

// EmptyState del Design System (design_system.md §3 — EmptyState).
// Mensaje guía cuando no hay datos, con acción sugerida opcional.
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-sm rounded-lg border " +
          "border-dashed border-border bg-surface p-xl text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="text-foreground-muted">{icon}</div> : null}
      <p className="text-h3 font-semibold text-foreground">{title}</p>
      {description ? <p className="text-body text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  );
}
