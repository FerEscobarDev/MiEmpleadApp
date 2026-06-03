import {
  obtenerConfiguracionDeEmpleada,
  guardarConfiguracion as guardarConfiguracionRepo,
} from "@/features/config/data/empleada-repository";
import type { ConfiguracionInputDto } from "./schemas";

// Servicio de aplicación de la configuración (architecture.md §2.3). Orquesta el
// repositorio (§2.5). Aplica el default RN-18 en lectura cuando aún no hay
// configuración persistida (sin materializarla en base).

// Default de salario base (RN-18 — business_requirements.md).
export const SALARIO_BASE_DEFAULT = 700000;

// DTO Configuracion del contrato (salida de la frontera).
export interface ConfiguracionDto {
  salarioBase: number;
  diasLaborales: string[];
}

export async function obtenerConfiguracion(
  empleadaId: string,
): Promise<ConfiguracionDto> {
  const config = await obtenerConfiguracionDeEmpleada(empleadaId);
  if (!config) {
    // RN-18: default cuando no hay configuración aún. No se persiste.
    return { salarioBase: SALARIO_BASE_DEFAULT, diasLaborales: [] };
  }
  return {
    salarioBase: config.salarioBase,
    diasLaborales: config.diasLaborales as string[],
  };
}

export async function guardarConfiguracion(
  empleadaId: string,
  datos: ConfiguracionInputDto,
): Promise<ConfiguracionDto> {
  const config = await guardarConfiguracionRepo(empleadaId, {
    salarioBase: datos.salarioBase,
    diasLaborales: datos.diasLaborales,
  });
  return {
    salarioBase: config.salarioBase,
    diasLaborales: config.diasLaborales as string[],
  };
}
