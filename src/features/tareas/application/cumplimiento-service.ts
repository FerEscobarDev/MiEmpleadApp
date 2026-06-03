import { diaSemanaDe } from "@/features/liquidacion/domain/dias-laborales";
import { isoToDate, toIsoDate } from "@/features/config/application/date-iso";
import {
  listarRutinaPorDia,
  listarCumplimientosDeFecha,
  rutinaTareaPertenece,
  upsertCumplimiento,
  listarHistorico,
} from "@/features/tareas/data/cumplimiento-repository";
import type { MarcarTareaInputDto } from "./schemas";

// Servicio de aplicación del cumplimiento de tareas (architecture.md §2.3). Orquesta
// el dominio puro (diaSemanaDe: mapeo fecha→día de la semana TZ-safe, America/Bogotá)
// con el repositorio (§2.5). Sin acceso directo a Prisma ni a la fecha actual
// (conventions.md §4): la fecha llega como parámetro desde la frontera.

export interface TareaDelDiaDto {
  rutinaTareaId: string;
  descripcion: string;
  horaInicio: string | null;
  horaFin: string | null;
  hecha: boolean;
}

export interface CumplimientoTareaDto {
  fecha: string;
  rutinaTareaId: string;
  descripcion: string;
  hecha: boolean;
}

// Error de aplicación esperable: la tarea no pertenece a la empleada (o no existe).
// La frontera lo traduce a 404 (conventions.md §6).
export class TareaNoEncontradaError extends Error {
  constructor() {
    super("La tarea no pertenece a la empleada o no existe.");
    this.name = "TareaNoEncontradaError";
  }
}

// Checklist del día: tareas de la rutina del día de la semana de `fecha`, cada una
// con su estado `hecha` para esa fecha exacta (default false si no hay registro).
export async function obtenerTareasDelDia(
  empleadaId: string,
  fecha: string,
): Promise<TareaDelDiaDto[]> {
  const diaSemana = diaSemanaDe(fecha);
  const tareas = await listarRutinaPorDia(empleadaId, diaSemana);
  const cumplimientos = await listarCumplimientosDeFecha(empleadaId, isoToDate(fecha));
  const hechaPorTarea = new Map(
    cumplimientos.map((c) => [c.rutinaTareaId, c.hecha]),
  );
  return tareas.map((t) => ({
    rutinaTareaId: t.id,
    descripcion: t.descripcion,
    horaInicio: t.horaInicio ?? null,
    horaFin: t.horaFin ?? null,
    hecha: hechaPorTarea.get(t.id) ?? false,
  }));
}

// Marca (upsert) el cumplimiento de una tarea en una fecha. Verifica que la tarea
// pertenece a la empleada del contexto (RN-13 / aislamiento). Única escritura de la
// empleada.
export async function marcarTarea(
  empleadaId: string,
  input: MarcarTareaInputDto,
): Promise<CumplimientoTareaDto> {
  const tarea = await rutinaTareaPertenece(input.rutinaTareaId, empleadaId);
  if (!tarea) {
    throw new TareaNoEncontradaError();
  }
  const cumplimiento = await upsertCumplimiento(
    input.rutinaTareaId,
    isoToDate(input.fecha),
    input.hecha,
  );
  return {
    fecha: input.fecha,
    rutinaTareaId: input.rutinaTareaId,
    descripcion: tarea.descripcion,
    hecha: cumplimiento.hecha,
  };
}

// Histórico de cumplimiento de la empleada en un rango [desde, hasta] inclusive.
export async function obtenerHistorico(
  empleadaId: string,
  desde: string,
  hasta: string,
): Promise<CumplimientoTareaDto[]> {
  const cumplimientos = await listarHistorico(
    empleadaId,
    isoToDate(desde),
    isoToDate(hasta),
  );
  return cumplimientos.map((c) => ({
    fecha: toIsoDate(c.fecha),
    rutinaTareaId: c.rutinaTareaId,
    descripcion: c.rutinaTarea.descripcion,
    hecha: c.hecha,
  }));
}
