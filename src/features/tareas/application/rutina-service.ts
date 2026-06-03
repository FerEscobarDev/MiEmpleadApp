import type { RutinaTarea } from "@prisma/client";
import {
  listarRutina,
  reemplazarRutina,
} from "@/features/tareas/data/rutina-repository";
import type { RutinaTareaInputDto } from "./schemas";

// Servicio de aplicación de la rutina de tareas (architecture.md §2.3). Orquesta el
// repositorio (§2.5) y mapea las entidades persistidas al DTO del contrato
// (RutinaTarea). Sin acceso directo a Prisma ni a la fecha actual (conventions.md §4).

export interface RutinaTareaDto {
  id: string;
  diaSemana: string;
  descripcion: string;
  horaInicio: string | null;
  horaFin: string | null;
  orden: number;
}

function toDto(t: RutinaTarea): RutinaTareaDto {
  return {
    id: t.id,
    diaSemana: t.diaSemana,
    descripcion: t.descripcion,
    horaInicio: t.horaInicio ?? null,
    horaFin: t.horaFin ?? null,
    orden: t.orden,
  };
}

export async function obtenerRutina(empleadaId: string): Promise<RutinaTareaDto[]> {
  const tareas = await listarRutina(empleadaId);
  return tareas.map(toDto);
}

// Reemplazo total de la rutina (BR-4): la rutina resultante es exactamente el arreglo
// recibido. Normaliza horarios ausentes a null para la persistencia.
export async function reemplazarRutinaTareas(
  empleadaId: string,
  inputs: RutinaTareaInputDto[],
): Promise<RutinaTareaDto[]> {
  const tareas = await reemplazarRutina(
    empleadaId,
    inputs.map((t) => ({
      diaSemana: t.diaSemana,
      descripcion: t.descripcion,
      horaInicio: t.horaInicio ?? null,
      horaFin: t.horaFin ?? null,
      orden: t.orden,
    })),
  );
  return tareas.map(toDto);
}
