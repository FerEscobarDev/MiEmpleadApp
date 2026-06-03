import * as React from "react";
import { cn } from "@/lib/utils";

// Calendar base del Design System (design_system.md §3 — DatePicker/Selector).
// Cuadrícula mensual accesible y reutilizable; el dominio (MonthCalendar) la
// envuelve con los colores de tipo de día. Sin lógica de festivos/cálculo aquí.
const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;

export interface CalendarDayCell {
  day: number;
  /** Etiqueta accesible completa de la celda (ej. "5 de junio — Trabajado"). */
  ariaLabel: string;
  className?: string;
  content?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface CalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Índice del día de semana (0=Lunes) en que cae el día 1 del mes. */
  leadingBlankCells: number;
  cells: CalendarDayCell[];
  caption?: string;
}

export function Calendar({
  leadingBlankCells,
  cells,
  caption,
  className,
  ...props
}: CalendarProps) {
  return (
    <div className={cn("w-full", className)} role="grid" aria-label={caption} {...props}>
      <div className="mb-xs grid grid-cols-7 gap-xs" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-caption font-medium text-foreground-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-xs">
        {Array.from({ length: leadingBlankCells }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {cells.map((cell) => {
          const interactive = Boolean(cell.onSelect) && !cell.disabled;
          const Comp = interactive ? "button" : "div";
          return (
            <Comp
              key={cell.day}
              type={interactive ? "button" : undefined}
              role="gridcell"
              aria-label={cell.ariaLabel}
              aria-disabled={cell.disabled || undefined}
              onClick={interactive ? cell.onSelect : undefined}
              className={cn(
                "relative flex aspect-square min-h-[44px] flex-col items-center justify-center " +
                  "rounded-md text-body focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-ring",
                interactive && "cursor-pointer",
                cell.className,
              )}
            >
              <span className="font-semibold">{cell.day}</span>
              {cell.content}
            </Comp>
          );
        })}
      </div>
    </div>
  );
}
