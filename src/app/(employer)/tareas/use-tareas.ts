"use client";

import * as React from "react";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

// Hooks de datos de /tareas (navigation_map.md §`/tareas`, HU-23/24/25/26).
// Toda la I/O pasa por el cliente tipado; no hay lógica de negocio (la rutina,
// los horarios y el cumplimiento los valida el backend, Epic 6.2). Aquí solo se
// da forma a los datos para respetar el contrato y exponer estados de carga.

export type DiaSemana = components["schemas"]["DiaSemana"];
export type RutinaTarea = components["schemas"]["RutinaTarea"];
export type RutinaTareaInput = components["schemas"]["RutinaTareaInput"];
export type TareaDelDia = components["schemas"]["TareaDelDia"];
export type MarcarTareaInput = components["schemas"]["MarcarTareaInput"];
export type CumplimientoTarea = components["schemas"]["CumplimientoTarea"];

export type EstadoCarga = "cargando" | "ok" | "error";

export const ERROR_CARGA_RUTINA = "No pudimos cargar la rutina. Intenta de nuevo.";
export const ERROR_CARGA_DIA =
  "No pudimos cargar las tareas del día. Intenta de nuevo.";
export const ERROR_CARGA_HISTORICO =
  "No pudimos cargar el histórico. Intenta de nuevo.";

// Orden canónico de los días de la semana (RN-15): Lunes → Domingo.
export const DIAS_SEMANA: ReadonlyArray<{ valor: DiaSemana; etiqueta: string }> = [
  { valor: "LUNES", etiqueta: "Lunes" },
  { valor: "MARTES", etiqueta: "Martes" },
  { valor: "MIERCOLES", etiqueta: "Miércoles" },
  { valor: "JUEVES", etiqueta: "Jueves" },
  { valor: "VIERNES", etiqueta: "Viernes" },
  { valor: "SABADO", etiqueta: "Sábado" },
  { valor: "DOMINGO", etiqueta: "Domingo" },
];

// Fecha local en formato YYYY-MM-DD (sin desfase de zona horaria por toISOString).
export function fechaLocalISO(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Valida un HH:mm (00:00–23:59). Cadena vacía/ausente NO es inválida (opcional).
export function esHoraValida(valor: string | null | undefined): boolean {
  if (!valor) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

// Rango válido: ambos presentes ⇒ inicio ≤ fin; cualquiera ausente ⇒ válido.
export function esRangoHorarioValido(
  inicio: string | null | undefined,
  fin: string | null | undefined,
): boolean {
  if (!esHoraValida(inicio) || !esHoraValida(fin)) return false;
  if (inicio && fin) return inicio <= fin;
  return true;
}
