import type { Liquidacion } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio delgado de liquidación (architecture.md §2.5). Solo persistencia,
// sin lógica de negocio (cálculo/congelamiento van en Milestones 2 y 5). La
// unicidad (empleadaId, anio, mes) (RN-10) la impone el índice del schema; aquí
// exponemos la consulta por mes para que la capa de aplicación implemente
// "una sola por mes/año" sin duplicar la query.

export interface CrearLiquidacionInput {
  empleadaId: string;
  anio: number;
  mes: number;
  estado?: string;
  notas?: string | null;
}

export async function crearLiquidacion(
  input: CrearLiquidacionInput,
): Promise<Liquidacion> {
  return db.liquidacion.create({
    data: {
      empleadaId: input.empleadaId,
      anio: input.anio,
      mes: input.mes,
      estado: input.estado ?? "BORRADOR",
      notas: input.notas ?? null,
    },
  });
}

export async function buscarLiquidacionPorMes(
  empleadaId: string,
  anio: number,
  mes: number,
): Promise<Liquidacion | undefined> {
  const liquidacion = await db.liquidacion.findUnique({
    where: { empleadaId_anio_mes: { empleadaId, anio, mes } },
  });
  return liquidacion ?? undefined;
}

export async function listarLiquidacionesDeEmpleada(
  empleadaId: string,
): Promise<Liquidacion[]> {
  return db.liquidacion.findMany({
    where: { empleadaId },
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });
}
