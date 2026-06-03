import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Checkbox del Design System (design_system.md §3 — Checkbox).
// Estados: marcado | sin marcar | indeterminado | disabled. Touch target ≥44px
// (envoltura con área clicable). Etiqueta clicable asociada.
export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, id, ...props }, ref) => {
  const reactId = React.useId();
  const boxId = id ?? reactId;
  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={boxId}
      className={cn(
        "peer size-5 shrink-0 rounded-sm border border-border bg-surface " +
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-ring focus-visible:ring-offset-2 " +
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary " +
          "data-[state=checked]:text-primary-foreground " +
          "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground " +
          "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {props.checked === "indeterminate" ? (
          <Minus className="size-4" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <label
      htmlFor={boxId}
      className="flex min-h-[44px] cursor-pointer items-center gap-sm text-body text-foreground"
    >
      {box}
      <span>{label}</span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";
