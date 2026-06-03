import type { RutinaTarea } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio de la rutina de tareas (architecture.md §2.5). Traduce a llamadas
// Prisma vía el cliente único; sin lógica de negocio (conventions.md §4). diaSemana
// se persiste como String (Nota SQLite). El reemplazo de la rutina es atómico
// (transacción) para no dejarla a medias. Espejo de menu-repository.reemplazarEntradas.

export interface RutinaTareaData {
  diaSemana: string;
  descripcion: string;
  horaInicio: string | null;
  horaFin: string | null;
  orden: number;
}

// Lista la rutina de una empleada ordenada por (diaSemana, orden) para una salida
// estable conforme al contrato.
export async function listarRutina(empleadaId: string): Promise<RutinaTarea[]> {
  return db.rutinaTarea.findMany({
    where: { empleadaId },
    orderBy: [{ diaSemana: "asc" }, { orden: "asc" }],
  });
}

// Reemplazo total y atómico de la rutina de una empleada: borra la actual y crea la
// nueva en una sola transacción. Devuelve la rutina resultante ya ordenada.
export async function reemplazarRutina(
  empleadaId: string,
  tareas: RutinaTareaData[],
): Promise<RutinaTarea[]> {
  await db.$transaction([
    db.rutinaTarea.deleteMany({ where: { empleadaId } }),
    db.rutinaTarea.createMany({
      data: tareas.map((t) => ({
        empleadaId,
        diaSemana: t.diaSemana,
        descripcion: t.descripcion,
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        orden: t.orden,
      })),
    }),
  ]);
  return listarRutina(empleadaId);
}
