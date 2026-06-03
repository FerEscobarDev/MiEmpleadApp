import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./Label";

// Textarea del Design System (design_system.md §3 — Textarea).
// Para notas del mes y descripciones largas; estados de error.
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, label, error, ...props }, ref) => {
    const reactId = React.useId();
    const areaId = id ?? reactId;
    const errorId = `${areaId}-error`;
    return (
      <div className="flex flex-col gap-xs">
        {label ? <Label htmlFor={areaId}>{label}</Label> : null}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "min-h-[96px] w-full rounded-md border border-border bg-surface px-md py-sm " +
              "text-body text-foreground placeholder:text-foreground-muted " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              "focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
              "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-error focus-visible:ring-error",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-caption text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
