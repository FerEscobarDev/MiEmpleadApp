import * as React from "react";
import { formatCOP } from "@/lib/currency";
import { cn } from "@/lib/utils";

// CurrencyDisplay del Design System (design_system.md §4 — CurrencyDisplay).
// ÚNICO punto de formateo de moneda en la UI: delega en formatCOP (es-CO, COP,
// sin decimales). Usa números tabulares para alinear montos.
export interface CurrencyDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
}

export function CurrencyDisplay({ amount, className, ...props }: CurrencyDisplayProps) {
  return (
    <span className={cn("tabular-nums font-semibold", className)} {...props}>
      {formatCOP(amount)}
    </span>
  );
}
