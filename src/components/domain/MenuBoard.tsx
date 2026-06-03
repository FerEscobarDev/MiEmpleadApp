import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

// MenuBoard del Design System (design_system.md §4 — MenuBoard).
// Tablero de menú: filas = días, columnas = comidas, por semana del ciclo.
// Shell presentacional por props; el "hoy" se resalta. Sin data fetching.
export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";

export interface MenuEntrada {
  semana: number;
  diaSemana: DiaSemana;
  comida: string;
  descripcion: string;
}

export interface MenuBoardProps {
  comidas: string[];
  entradas: MenuEntrada[];
  semana?: number;
  diaHoy?: DiaSemana;
  className?: string;
}

const DIAS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
];

const DIA_LABEL: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export function MenuBoard({
  comidas,
  entradas,
  semana = 0,
  diaHoy,
  className,
}: MenuBoardProps) {
  const lookup = (dia: DiaSemana, comida: string) =>
    entradas.find((e) => e.semana === semana && e.diaSemana === dia && e.comida === comida)
      ?.descripcion ?? "";

  return (
    <Table className={cn(className)}>
      <TableHeader>
        <TableRow>
          <TableHead>Día</TableHead>
          {comidas.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {DIAS.map((dia) => (
          <TableRow
            key={dia}
            className={cn(diaHoy === dia && "bg-primary-soft")}
            aria-current={diaHoy === dia ? "date" : undefined}
          >
            <TableCell className="font-semibold">{DIA_LABEL[dia]}</TableCell>
            {comidas.map((c) => (
              <TableCell key={c} className="text-foreground-muted">
                {lookup(dia, c) || "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
