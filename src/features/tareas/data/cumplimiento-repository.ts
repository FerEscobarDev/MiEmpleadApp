import type { CumplimientoTarea, RutinaTarea } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio del cumplimiento de tareas (architecture.md §2.5). Traduce a llamadas
// Prisma vía el cliente único; sin lógica de negocio (conventions.md §4). El
// CumplimientoTarea se almacena por fecha exacta (DateTime anclado a medianoche UTC).

export type CumplimientoConRutina = CumplimientoTarea & { rutinaTarea: RutinaTarea };

// Lista las tareas de la rutina de una empleada para un día de la semana, ordenadas
// por orden (proyección del checklist del día).
export async function listarRutinaPorDia(
  empleadaId: string,
  diaSemana: string,
): Promise<RutinaTarea[]> {
  return db.rutinaTarea.findMany({
    where: { empleadaId, diaSemana },
    orderBy: { orden: "asc" },
  });
}

// Cumplimientos de la empleada para una fecha exacta (para conocer el estado `hecha`
// de cada tarea del día).
export async function listarCumplimientosDeFecha(
  empleadaId: string,
  fecha: Date,
): Promise<CumplimientoTarea[]> {
  return db.cumplimientoTarea.findMany({
    where: { fecha, rutinaTarea: { empleadaId } },
  });
}

// ¿La rutinaTarea pertenece a la empleada? (RN-13 / aislamiento por empleada).
export async function rutinaTareaPertenece(
  rutinaTareaId: string,
  empleadaId: string,
): Promise<RutinaTarea | undefined> {
  const tarea = await db.rutinaTarea.findFirst({
    where: { id: rutinaTareaId, empleadaId },
  });
  return tarea ?? undefined;
}

// Upsert del cumplimiento de (rutinaTareaId, fecha): un único registro por par.
// CumplimientoTarea no tiene @@unique(rutinaTareaId, fecha), así que se hace
// find-then-update/create para garantizar idempotencia (AC-10).
export async function upsertCumplimiento(
  rutinaTareaId: string,
  fecha: Date,
  hecha: boolean,
): Promise<CumplimientoTarea> {
  const existente = await db.cumplimientoTarea.findFirst({
    where: { rutinaTareaId, fecha },
  });
  if (existente) {
    return db.cumplimientoTarea.update({
      where: { id: existente.id },
      data: { hecha },
    });
  }
  return db.cumplimientoTarea.create({
    data: { rutinaTareaId, fecha, hecha },
  });
}

// Histórico de cumplimientos de la empleada en un rango [desde, hasta] inclusive,
// con su rutinaTarea (para descripcion/orden), ordenado por (fecha, orden).
export async function listarHistorico(
  empleadaId: string,
  desde: Date,
  hasta: Date,
): Promise<CumplimientoConRutina[]> {
  return db.cumplimientoTarea.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      rutinaTarea: { empleadaId },
    },
    include: { rutinaTarea: true },
    orderBy: [{ fecha: "asc" }, { rutinaTarea: { orden: "asc" } }],
  });
}
