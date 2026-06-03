import {
  obtenerMenuConfig,
  listarEntradas,
  guardarMenuConfig,
  asegurarMenuConfig,
  reemplazarEntradas,
  type MenuConfigData,
} from "@/features/menu/data/menu-repository";
import type { MenuConfigInputDto, MenuEntradaInputDto } from "./schemas";

// Servicio de aplicación del menú (architecture.md §2.3). Orquesta el repositorio
// (§2.5) y aplica las reglas dependientes de la configuración: default de lectura
// (RN-19), rango de semana por periodicidad (RN-14) y acoplamiento comida ∈
// comidas configuradas (RN-19). Sin acceso directo a Prisma ni a la fecha actual.

// Default del menú cuando aún no hay configuración (RN-19). NO se persiste al leer.
export const COMIDAS_DEFAULT = ["Desayuno", "Almuerzo", "Cena"] as const;
export const PERIODICIDAD_DEFAULT = "SEMANAL";

// Número de semanas del ciclo según la periodicidad (RN-14): SEMANAL=1,
// QUINCENAL=2, MENSUAL=4. semana válida ∈ [0, semanas-1].
const SEMANAS_POR_PERIODICIDAD: Record<string, number> = {
  SEMANAL: 1,
  QUINCENAL: 2,
  MENSUAL: 4,
};

export interface MenuConfigDto {
  comidas: string[];
  periodicidad: string;
}

export interface MenuEntradaDto {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}

export interface MenuDto {
  configuracion: MenuConfigDto;
  entradas: MenuEntradaDto[];
}

// Error de validación esperable de la capa de aplicación (reglas dependientes de
// la configuración). La frontera lo traduce a 422 (conventions.md §6: retorno/throw
// explícito para errores de negocio esperables, no 500).
export class MenuValidacionError extends Error {
  readonly details: unknown;
  constructor(message: string, details: unknown) {
    super(message);
    this.name = "MenuValidacionError";
    this.details = details;
  }
}

function configPorDefecto(): MenuConfigData {
  return {
    comidas: [...COMIDAS_DEFAULT],
    periodicidad: PERIODICIDAD_DEFAULT,
  };
}

function toEntradaDto(e: {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}): MenuEntradaDto {
  return {
    semana: e.semana,
    diaSemana: e.diaSemana,
    comida: e.comida,
    descripcion: e.descripcion,
  };
}

export async function obtenerMenu(empleadaId: string): Promise<MenuDto> {
  const config = await obtenerMenuConfig(empleadaId);
  if (!config) {
    // RN-19: default cuando no hay configuración aún. No se persiste.
    return {
      configuracion: configPorDefecto(),
      entradas: [],
    };
  }
  const entradas = await listarEntradas(config.id);
  return {
    configuracion: {
      comidas: config.comidas as string[],
      periodicidad: config.periodicidad,
    },
    entradas: entradas.map(toEntradaDto),
  };
}

export async function guardarConfiguracionMenu(
  empleadaId: string,
  input: MenuConfigInputDto,
): Promise<MenuConfigDto> {
  const config = await guardarMenuConfig(empleadaId, {
    comidas: input.comidas,
    periodicidad: input.periodicidad,
  });
  return {
    comidas: config.comidas as string[],
    periodicidad: config.periodicidad,
  };
}

// Valida las entradas contra la configuración vigente (rango de semana por
// periodicidad y comida ∈ comidas) y reemplaza por completo la plantilla.
export async function actualizarEntradasMenu(
  empleadaId: string,
  entradas: MenuEntradaInputDto[],
): Promise<MenuEntradaDto[]> {
  // Asegura la config (con el default si falta) para conocer periodicidad/comidas
  // y para colgar las entradas.
  const config = await asegurarMenuConfig(empleadaId, configPorDefecto());
  const comidasValidas = new Set(config.comidas as string[]);
  const semanasCiclo = SEMANAS_POR_PERIODICIDAD[config.periodicidad] ?? 1;

  const errores: Array<{ indice: number; problema: string }> = [];
  entradas.forEach((entrada, indice) => {
    if (entrada.semana > semanasCiclo - 1) {
      errores.push({
        indice,
        problema: `La semana ${entrada.semana} excede el rango de la periodicidad ${config.periodicidad} (0..${semanasCiclo - 1}).`,
      });
    }
    if (!comidasValidas.has(entrada.comida)) {
      errores.push({
        indice,
        problema: `La comida "${entrada.comida}" no está entre las comidas configuradas.`,
      });
    }
  });

  if (errores.length > 0) {
    throw new MenuValidacionError("Entradas de menú inválidas.", errores);
  }

  const guardadas = await reemplazarEntradas(
    config.id,
    entradas.map((e) => ({
      semana: e.semana,
      diaSemana: e.diaSemana,
      comida: e.comida,
      descripcion: e.descripcion,
    })),
  );
  return guardadas.map(toEntradaDto);
}
