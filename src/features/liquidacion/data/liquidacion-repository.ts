import type { Liquidacion } from "@prisma/client";
import { db } from "@/lib/db";
import { toIsoDate } from "@/features/config/application/date-iso";

// Repositorio delgado de liquidación (architecture.md §2.5). Solo persistencia,
// sin lógica de negocio (cálculo/congelamiento van en el dominio y la aplicación).
// La unicidad (empleadaId, anio, mes) (RN-10) la impone el índice del schema; aquí
// exponemos la consulta por mes para que la capa de aplicación implemente
// "una sola por mes/año" sin duplicar la query, y la lectura/escritura de novedades.

export interface CrearLiquidacionInput {
  empleadaId: string;
  anio: number;
  mes: number;
  estado?: string;
  notas?: string | null;
}

export async function crearLiquidacion(input: CrearLiquidacionInput): Promise<Liquidacion> {
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

export async function listarLiquidacionesDeEmpleada(empleadaId: string): Promise<Liquidacion[]> {
  return db.liquidacion.findMany({
    where: { empleadaId },
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });
}

// Item de la liquidación cargado para el cálculo en vivo: el snapshot persistido
// (nombre/valorUnitario) más el itemId para el DTO. cantidad para subtotales.
export interface NovedadItem {
  itemId: string | null;
  nombre: string;
  valorUnitario: number;
  cantidad: number;
}

export interface NovedadMontoPuntual {
  id: string;
  descripcion: string;
  monto: number;
}

// Novedades persistidas de una liquidación (fechas como YYYY-MM-DD para el dominio).
export interface NovedadesLiquidacion {
  inasistencias: string[];
  items: NovedadItem[];
  montosPuntuales: NovedadMontoPuntual[];
}

export async function cargarNovedades(liquidacionId: string): Promise<NovedadesLiquidacion> {
  const [inasistencias, items, montosPuntuales] = await Promise.all([
    db.inasistencia.findMany({ where: { liquidacionId } }),
    db.liquidacionItem.findMany({ where: { liquidacionId } }),
    db.montoPuntual.findMany({ where: { liquidacionId } }),
  ]);
  return {
    inasistencias: inasistencias.map((i) => toIsoDate(i.fecha)),
    items: items.map((it) => ({
      itemId: it.itemId,
      nombre: it.nombre,
      valorUnitario: it.valorUnitario,
      cantidad: it.cantidad,
    })),
    montosPuntuales: montosPuntuales.map((m) => ({
      id: m.id,
      descripcion: m.descripcion,
      monto: m.monto,
    })),
  };
}

// Datos persistibles de un item de la liquidación (snapshot de nombre/valor).
export interface ReemplazoItem {
  itemId: string | null;
  nombre: string;
  valorUnitario: number;
  cantidad: number;
}

export interface ReemplazoMontoPuntual {
  descripcion: string;
  monto: number;
}

// Reemplaza (set, no append) las novedades de una liquidación por las provistas.
// Solo se tocan las categorías presentes (undefined ⇒ no se modifica). notas se
// actualiza solo si se provee. Atómico vía transacción Prisma.
export interface ReemplazoNovedades {
  inasistencias?: string[];
  items?: ReemplazoItem[];
  montosPuntuales?: ReemplazoMontoPuntual[];
  notas?: string | null;
}

export async function reemplazarNovedades(
  liquidacionId: string,
  reemplazo: ReemplazoNovedades,
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (reemplazo.inasistencias !== undefined) {
      await tx.inasistencia.deleteMany({ where: { liquidacionId } });
      const unicas = Array.from(new Set(reemplazo.inasistencias));
      if (unicas.length > 0) {
        await tx.inasistencia.createMany({
          data: unicas.map((fecha) => ({
            liquidacionId,
            fecha: new Date(`${fecha}T00:00:00.000Z`),
          })),
        });
      }
    }

    if (reemplazo.items !== undefined) {
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });
      if (reemplazo.items.length > 0) {
        await tx.liquidacionItem.createMany({
          data: reemplazo.items.map((it) => ({
            liquidacionId,
            itemId: it.itemId,
            nombre: it.nombre,
            valorUnitario: it.valorUnitario,
            cantidad: it.cantidad,
          })),
        });
      }
    }

    if (reemplazo.montosPuntuales !== undefined) {
      await tx.montoPuntual.deleteMany({ where: { liquidacionId } });
      if (reemplazo.montosPuntuales.length > 0) {
        await tx.montoPuntual.createMany({
          data: reemplazo.montosPuntuales.map((m) => ({
            liquidacionId,
            descripcion: m.descripcion,
            monto: m.monto,
          })),
        });
      }
    }

    if (reemplazo.notas !== undefined) {
      await tx.liquidacion.update({
        where: { id: liquidacionId },
        data: { notas: reemplazo.notas },
      });
    }
  });
}
