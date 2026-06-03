import * as React from "react";
import { cn } from "@/lib/utils";
import { Calendar, type CalendarDayCell } from "@/components/ui/Calendar";

// MonthCalendar del Design System (design_system.md §4 — MonthCalendar).
// Cuadrícula del mes coloreada por tipo de día (tokens §2.3) + leyenda SIEMPRE
// visible. Cada día expone una etiqueta textual de su tipo (nunca solo color,
// BR-2). Item adicional = indicador sobre el color base (BR-6). Shell por props,
// sin lógica de cálculo (eso vive en el dominio del backend).

export type TipoDiaCalendario =
  | "TRABAJADO"
  | "INASISTENCIA"
  | "FESTIVO"
  | "NO_LABORAL"
  | "FUERA_CONTRATO";

export interface DiaCalendario {
  fecha: string; // ISO date YYYY-MM-DD
  tipo: TipoDiaCalendario;
  itemsAdicionales?: string[];
}

export interface MonthCalendarProps {
  anio: number;
  mes: number; // 1-12
  dias: DiaCalendario[];
  onSelectDay?: (fecha: string) => void;
  className?: string;
}

const TIPO_LABEL: Record<TipoDiaCalendario, string> = {
  TRABAJADO: "Trabajado",
  INASISTENCIA: "Inasistencia",
  FESTIVO: "Festivo",
  NO_LABORAL: "No laboral",
  FUERA_CONTRATO: "Fuera de contrato",
};

// Color base por tipo (tokens cal.* §2.3) + color de texto legible (AA).
const TIPO_CLASS: Record<TipoDiaCalendario, string> = {
  TRABAJADO: "bg-cal-trabajado text-white",
  INASISTENCIA: "bg-cal-inasistencia text-white",
  FESTIVO: "bg-cal-festivo text-white",
  NO_LABORAL: "bg-cal-noLaboral text-neutral-900",
  FUERA_CONTRATO: "bg-cal-fueraContrato text-neutral-600",
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Día de semana (0=Lunes) en que cae una fecha ISO, en aritmética local simple.
function weekdayMondayBased(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom
  return (js + 6) % 7; // 0=Lun
}

export function MonthCalendar({
  anio,
  mes,
  dias,
  onSelectDay,
  className,
}: MonthCalendarProps) {
  const monthName = MONTH_NAMES[mes - 1] ?? String(mes);
  const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const leadingBlankCells = sorted.length > 0 ? weekdayMondayBased(sorted[0].fecha) : 0;

  const cells: CalendarDayCell[] = sorted.map((dia) => {
    const day = Number(dia.fecha.split("-")[2]);
    const tieneItem = (dia.itemsAdicionales?.length ?? 0) > 0;
    const itemSuffix = tieneItem ? " — con item adicional" : "";
    const ariaLabel = `${day} de ${monthName} — ${TIPO_LABEL[dia.tipo]}${itemSuffix}`;
    return {
      day,
      ariaLabel,
      className: TIPO_CLASS[dia.tipo],
      onSelect: onSelectDay ? () => onSelectDay(dia.fecha) : undefined,
      content: tieneItem ? (
        <span
          className="absolute right-1 top-1 size-2 rounded-full bg-cal-itemAdicional ring-1 ring-white"
          aria-hidden="true"
        />
      ) : undefined,
    };
  });

  // Tipos presentes en la leyenda: todos los del DS, en orden estable.
  const legendTipos: TipoDiaCalendario[] = [
    "TRABAJADO",
    "INASISTENCIA",
    "FESTIVO",
    "NO_LABORAL",
    "FUERA_CONTRATO",
  ];

  return (
    <div className={cn("flex flex-col gap-md", className)}>
      <Calendar
        leadingBlankCells={leadingBlankCells}
        cells={cells}
        caption={`Calendario de ${monthName} de ${anio}`}
      />
      <ul aria-label="Leyenda del calendario" className="flex flex-wrap gap-md">
        {legendTipos.map((tipo) => (
          <li key={tipo} className="flex items-center gap-xs text-caption text-foreground-muted">
            <span
              className={cn("inline-block size-3 rounded-sm", TIPO_CLASS[tipo].split(" ")[0])}
              aria-hidden="true"
            />
            {TIPO_LABEL[tipo]}
          </li>
        ))}
        <li className="flex items-center gap-xs text-caption text-foreground-muted">
          <span
            className="inline-block size-3 rounded-full bg-cal-itemAdicional"
            aria-hidden="true"
          />
          Item adicional
        </li>
      </ul>
    </div>
  );
}
