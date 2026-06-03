import * as React from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

// TaskChecklist del Design System (design_system.md §4 — TaskChecklist).
// Lista de tareas del día con casilla, descripción y horario opcional; orden
// respetado. En modo `editable` las casillas son marcables (única escritura de
// la empleada); en solo-lectura no invocan callback. Shell por props.
export interface TareaDelDia {
  rutinaTareaId: string;
  descripcion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  hecha: boolean;
}

export interface TaskChecklistProps {
  tareas: TareaDelDia[];
  editable?: boolean;
  onToggle?: (rutinaTareaId: string, hecha: boolean) => void;
  className?: string;
}

function horario(t: TareaDelDia): string | null {
  if (!t.horaInicio && !t.horaFin) return null;
  if (t.horaInicio && t.horaFin) return `${t.horaInicio}–${t.horaFin}`;
  return t.horaInicio ?? t.horaFin ?? null;
}

export function TaskChecklist({ tareas, editable, onToggle, className }: TaskChecklistProps) {
  return (
    <ul className={cn("flex flex-col gap-xs", className)}>
      {tareas.map((t) => {
        const hora = horario(t);
        const label = (
          <span className="flex items-center gap-sm">
            <span className={cn(t.hecha && "text-foreground-muted line-through")}>
              {t.descripcion}
            </span>
            {hora ? (
              <span className="text-caption tabular-nums text-foreground-muted">{hora}</span>
            ) : null}
          </span>
        );
        return (
          <li key={t.rutinaTareaId}>
            <Checkbox
              label={label}
              checked={t.hecha}
              disabled={!editable}
              onCheckedChange={
                editable && onToggle
                  ? (checked) => onToggle(t.rutinaTareaId, checked === true)
                  : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
