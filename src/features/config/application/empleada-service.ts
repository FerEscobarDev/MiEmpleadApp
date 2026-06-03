import {
  buscarEmpleadaPorId,
  actualizarFichaEmpleada,
} from "@/features/config/data/empleada-repository";
import { isoToDate, toIsoDate } from "./date-iso";
import type { EmpleadaInput } from "./schemas";

// Servicio de aplicación de la ficha de la empleada (architecture.md §2.3).
// Orquesta el repositorio (§2.5) y mapea entre el DTO de la frontera (fechas como
// string YYYY-MM-DD) y la persistencia (Date). Sin lógica de negocio compleja:
// solo orquestación + mapeo. NO toca Prisma directamente.

// DTO Empleada del contrato (salida de la frontera).
export interface EmpleadaDto {
  nombre: string;
  fechaNacimiento: string;
  fechaInicioContrato: string;
  fechaFinContrato: string | null;
}

export async function obtenerEmpleada(
  empleadaId: string,
): Promise<EmpleadaDto | undefined> {
  const empleada = await buscarEmpleadaPorId(empleadaId);
  if (!empleada) {
    return undefined;
  }
  return {
    nombre: empleada.nombre,
    fechaNacimiento: toIsoDate(empleada.fechaNacimiento),
    fechaInicioContrato: toIsoDate(empleada.fechaInicioContrato),
    fechaFinContrato: empleada.fechaFinContrato
      ? toIsoDate(empleada.fechaFinContrato)
      : null,
  };
}

export async function guardarEmpleada(
  empleadaId: string,
  datos: EmpleadaInput,
): Promise<EmpleadaDto> {
  const empleada = await actualizarFichaEmpleada(empleadaId, {
    nombre: datos.nombre,
    fechaNacimiento: isoToDate(datos.fechaNacimiento),
    fechaInicioContrato: isoToDate(datos.fechaInicioContrato),
    fechaFinContrato: datos.fechaFinContrato
      ? isoToDate(datos.fechaFinContrato)
      : null,
  });
  return {
    nombre: empleada.nombre,
    fechaNacimiento: toIsoDate(empleada.fechaNacimiento),
    fechaInicioContrato: toIsoDate(empleada.fechaInicioContrato),
    fechaFinContrato: empleada.fechaFinContrato
      ? toIsoDate(empleada.fechaFinContrato)
      : null,
  };
}
