import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./Label";

// Input del Design System (design_system.md §3 — Input / NumberInput / CurrencyInput).
// label encima, helper text debajo, error con ícono y asociación aria.
// La variante `currency` alinea a la derecha y usa números tabulares.
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  currency?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, label, helperText, error, currency, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const helpId = `${inputId}-help`;
    const errorId = `${inputId}-error`;
    const describedBy = error ? errorId : helperText ? helpId : undefined;

    return (
      <div className="flex flex-col gap-xs">
        {label ? <Label htmlFor={inputId}>{label}</Label> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-md border border-border bg-surface px-md text-body " +
              "text-foreground placeholder:text-foreground-muted focus-visible:outline-none " +
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
              "focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            currency && "text-right tabular-nums",
            error && "border-error focus-visible:ring-error",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="flex items-center gap-xs text-caption text-error">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : helperText ? (
          <p id={helpId} className="text-caption text-foreground-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
